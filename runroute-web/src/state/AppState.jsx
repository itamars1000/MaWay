import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  loadSaved,
  persist,
  addRoute,
  removeRoute,
  renameRoute,
} from '../lib/savedRoutes.js';
import {
  fetchCloudRoutes,
  upsertCloudRoute,
  deleteCloudRoute,
  clearCloudRoutes,
} from '../lib/cloudRoutes.js';
import { useAuth } from './AuthProvider.jsx';

// Cloud sync is best-effort: log and move on (localStorage already updated).
const cloudWarn = (err) => console.warn('route sync skipped:', err?.message || err);

// Top navigation tabs.
export const TABS = { ROUTE: 'route', SAVED: 'saved' };

// Shape of the generated route.
export const ROUTE_TYPES = { LOOP: 'loop', ONE_WAY: 'oneWay' };

export const MIN_DISTANCE = 1; // km
export const MAX_DISTANCE = 21.1; // km — half marathon (engine cap for now)

// Label used while the start point tracks the live GPS position.
export const CURRENT_LOCATION_LABEL = 'מיקום נוכחי';

const AppStateContext = createContext(null);

/**
 * Single source of truth for the shell's interactive state.
 * Kept intentionally small and UI-focused; real routing logic can be layered
 * on later (e.g. a generateRoute() that fills the polyline).
 */
export function AppStateProvider({ children }) {
  const [currentTab, setCurrentTab] = useState(TABS.ROUTE);
  const [routeType, setRouteType] = useState(ROUTE_TYPES.LOOP);
  const [selectedDistance, setDistanceRaw] = useState(5);
  const [startLocation, setStartLocation] = useState(CURRENT_LOCATION_LABEL);

  // Real geolocation fix (null until granted) and the route's start point.
  const [currentPosition, setCurrentPosition] = useState(null);
  const [startPosition, setStartPosition] = useState(null);
  const [geoStatus, setGeoStatus] = useState('idle'); // idle|locating|granted|denied|unavailable

  // Optional via-point (loop) / end-point (A→B) + a "tap the map" arming mode.
  const [viaPoint, setViaPoint] = useState(null); // {lat,lng} | null
  const [endPoint, setEndPoint] = useState(null); // {lat,lng} | null
  const [endLocation, setEndLocation] = useState(''); // label in the end field
  const [pickingMode, setPickingMode] = useState(null); // null | 'via' | 'end'

  // Generated routes: a best-first ranked list of candidates + which one is shown.
  const [routeCandidates, setRouteCandidates] = useState([]);
  const [routeIndex, setRouteIndex] = useState(0);
  const [routeStatus, setRouteStatus] = useState('idle'); // idle|loading|error
  const [routeError, setRouteError] = useState(null);

  // Saved routes: localStorage is the local source of truth; when signed in they
  // also sync to Supabase (mirror) so they follow the user across devices.
  const [savedRoutes, setSavedRoutes] = useState(loadSaved);
  const [justSaved, setJustSaved] = useState(false);

  // Who's signed in (null = guest). Drives cloud sync below.
  const { user } = useAuth();

  // On sign-in, merge local + cloud routes: upload any local-only ones, then
  // show the union (newest first). Best-effort — failures keep local working.
  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      try {
        const cloud = await fetchCloudRoutes();
        const local = loadSaved();
        const cloudIds = new Set(cloud.map((r) => r.id));
        const localOnly = local.filter((r) => !cloudIds.has(r.id));
        await Promise.all(localOnly.map((r) => upsertCloudRoute(user.id, r)));
        // Union by id (cloud data wins for shared ids), newest first.
        const byId = new Map();
        [...localOnly, ...cloud].forEach((r) => byId.set(r.id, r));
        const merged = [...byId.values()].sort(
          (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
        );
        if (!active) return;
        persist(merged);
        setSavedRoutes(merged);
      } catch (err) {
        // Table missing / offline / RLS — keep using local silently.
        console.warn('route sync skipped:', err?.message || err);
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

  const setSelectedDistance = (km) =>
    setDistanceRaw(Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, km)));

  const value = useMemo(() => {
    const sheetTitle =
      currentTab === TABS.ROUTE ? 'מסלול חדש' : 'המסלולים שלי';

    // True while the start point should follow the live GPS position.
    const usingCurrentLocation = startLocation === CURRENT_LOCATION_LABEL;

    // The effective start: an explicitly chosen address, otherwise the GPS fix.
    const effectiveStart = usingCurrentLocation ? currentPosition : startPosition;

    // Pick an address suggestion as the start point.
    const selectAddress = ({ label, lat, lng }) => {
      setStartLocation(label);
      setStartPosition({ lat, lng });
    };

    // Reset the start point back to the live GPS position.
    const useCurrentLocationAsStart = () => {
      setStartLocation(CURRENT_LOCATION_LABEL);
      setStartPosition(null);
    };

    // A map tap fills the point for whichever mode is armed.
    const placeMapPoint = ({ lat, lng }) => {
      if (pickingMode === 'via') setViaPoint({ lat, lng });
      else if (pickingMode === 'end') {
        setEndPoint({ lat, lng });
        setEndLocation('נקודה על המפה');
      } else if (pickingMode === 'start') {
        setStartPosition({ lat, lng });
        setStartLocation('נקודה על המפה'); // a non-CURRENT label → uses this point
      }
      setPickingMode(null);
    };
    const clearViaPoint = () => {
      setViaPoint(null);
      setPickingMode((m) => (m === 'via' ? null : m));
    };
    const clearEndPoint = () => {
      setEndPoint(null);
      setEndLocation('');
      setPickingMode((m) => (m === 'end' ? null : m));
    };
    // Pick an address suggestion as the end point (A→B).
    const selectEndAddress = ({ label, lat, lng }) => {
      setEndLocation(label);
      setEndPoint({ lat, lng });
    };

    // The currently shown route (best-ranked by default).
    const generatedRoute = routeCandidates[routeIndex] ?? null;

    // Cycle to the next candidate in the ranking (wraps around).
    const showNextRoute = () => {
      if (routeCandidates.length < 2) return;
      setRouteIndex((i) => (i + 1) % routeCandidates.length);
    };

    // ---- Saved routes ----------------------------------------------------
    // Save the currently-shown route to the device (auto-named).
    const saveCurrentRoute = () => {
      if (!generatedRoute) return;
      const typeLabel = routeType === ROUTE_TYPES.LOOP ? 'סיבוב' : 'A→B';
      const item = {
        id: `r${Date.now()}`,
        name: `${typeLabel} · ${generatedRoute.distanceKm.toFixed(1)} ק"מ`,
        createdAt: Date.now(),
        type: routeType,
        distanceKm: generatedRoute.distanceKm,
        durationMin: generatedRoute.durationMin,
        turnsPerKm: generatedRoute.turnsPerKm,
        meetsTurnTarget: generatedRoute.meetsTurnTarget,
        pleasantFrac: generatedRoute.pleasantFrac ?? 0,
        scenicFrac: generatedRoute.scenicFrac ?? 0,
        ascentM: generatedRoute.ascentM ?? null,
        descentM: generatedRoute.descentM ?? null,
        coords: generatedRoute.coords,
      };
      setSavedRoutes((list) => {
        const next = addRoute(list, item);
        persist(next);
        return next;
      });
      setJustSaved(true);
      if (user) upsertCloudRoute(user.id, item).catch(cloudWarn);
    };

    const deleteSavedRoute = (id) => {
      setSavedRoutes((list) => {
        const next = removeRoute(list, id);
        persist(next);
        return next;
      });
      if (user) deleteCloudRoute(id).catch(cloudWarn);
    };

    const clearAllSavedRoutes = () => {
      persist([]);
      setSavedRoutes([]);
      if (user) clearCloudRoutes(user.id).catch(cloudWarn);
    };

    const renameSavedRoute = (id, name) =>
      setSavedRoutes((list) => {
        const next = renameRoute(list, id, name);
        persist(next);
        const renamed = next.find((r) => r.id === id);
        if (user && renamed) upsertCloudRoute(user.id, renamed).catch(cloudWarn);
        return next;
      });

    // Load a saved route back onto the map (as the single shown candidate).
    const openSavedRoute = (item) => {
      const turns = Math.round((item.turnsPerKm || 0) * (item.distanceKm || 0));
      setRouteCandidates([
        {
          coords: item.coords,
          distanceKm: item.distanceKm,
          durationMin: item.durationMin,
          turns,
          turnsPerKm: item.turnsPerKm,
          meetsTurnTarget: item.meetsTurnTarget,
          pleasantFrac: item.pleasantFrac ?? 0,
          scenicFrac: item.scenicFrac ?? 0,
          ascentM: item.ascentM ?? null,
          descentM: item.descentM ?? null,
          score: 1,
        },
      ]);
      setRouteIndex(0);
      setRouteType(item.type);
      setRouteStatus('idle');
      setRouteError(null);
      setCurrentTab(TABS.ROUTE);
    };

    return {
      currentTab,
      setCurrentTab,
      routeType,
      setRouteType,
      selectedDistance,
      setSelectedDistance,
      startLocation,
      setStartLocation,
      sheetTitle,
      // location
      currentPosition,
      setCurrentPosition,
      startPosition,
      setStartPosition,
      geoStatus,
      setGeoStatus,
      usingCurrentLocation,
      effectiveStart,
      selectAddress,
      useCurrentLocationAsStart,
      // via-point / end-point + map picking
      viaPoint,
      endPoint,
      endLocation,
      setEndLocation,
      pickingMode,
      setPickingMode,
      placeMapPoint,
      clearViaPoint,
      clearEndPoint,
      selectEndAddress,
      // generated routes
      generatedRoute,
      routeCandidates,
      setRouteCandidates,
      routeIndex,
      setRouteIndex,
      showNextRoute,
      routeCount: routeCandidates.length,
      routeStatus,
      setRouteStatus,
      routeError,
      setRouteError,
      // saved routes
      savedRoutes,
      justSaved,
      setJustSaved,
      saveCurrentRoute,
      deleteSavedRoute,
      clearAllSavedRoutes,
      renameSavedRoute,
      openSavedRoute,
    };
  }, [
    currentTab,
    routeType,
    selectedDistance,
    startLocation,
    currentPosition,
    startPosition,
    geoStatus,
    viaPoint,
    endPoint,
    endLocation,
    pickingMode,
    routeCandidates,
    routeIndex,
    routeStatus,
    routeError,
    savedRoutes,
    justSaved,
    user,
  ]);

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return ctx;
}
