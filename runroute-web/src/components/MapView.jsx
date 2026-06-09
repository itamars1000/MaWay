import { useEffect, useMemo, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import { TargetIcon } from './icons.jsx';
import { useAppState } from '../state/AppState.jsx';
import { useSettings } from '../state/SettingsProvider.jsx';
import { useGeolocation } from '../hooks/useGeolocation.js';
import { DEFAULT_CENTER } from '../lib/route.js';
import { getStyle } from '../lib/mapStyles.js';

const DEFAULT_LATLNG = [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng];

/**
 * Keeps the relevant area visible above the bottom sheet. When a route exists
 * it re-fits the route bounds; otherwise it centers on the start point (the
 * live GPS fix or a chosen address) as soon as one is known — so the map
 * follows the user instead of sitting on a default location.
 */
function MapController({ route, center, sheetFraction, recenterSignal, onCentered }) {
  const map = useMap();
  // Stable dependency for the route geometry (null when no route yet).
  const routeKey = route ? route.map((p) => p.join(',')).join('|') : null;

  useEffect(() => {
    if (!map) return;
    if (route && route.length) {
      const bottomPx = sheetFraction * map.getSize().y;
      map.flyToBounds(route, {
        paddingTopLeft: [24, 90], // clear the floating header
        paddingBottomRight: [24, bottomPx + 24], // clear the sheet
        duration: 0.4,
      });
    } else if (center) {
      // Jump straight to the location with NO visible animation, while the
      // loading overlay still covers the map. Then signal so the overlay lifts
      // to reveal a map already centered on the user — no perceptible move.
      map.setView([center.lat, center.lng], Math.max(map.getZoom(), 15), {
        animate: false,
      });
      if (onCentered) onCentered();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey, center?.lat, center?.lng, sheetFraction, recenterSignal, map]);

  // Leaflet needs a nudge once its container has its final size.
  useEffect(() => {
    const t = setTimeout(() => map && map.invalidateSize(), 200);
    return () => clearTimeout(t);
  }, [map]);

  return null;
}

/** Captures a map tap to set the via-point while "pick" mode is armed. */
function ViaPicker({ active, onPick }) {
  useMapEvents({
    click(e) {
      if (active) onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

/**
 * Base layer: the full-screen Leaflet map (OpenStreetMap tiles), the route
 * polyline anchored at the start point, the blue current-location dot, an
 * optional charcoal start marker, and a white "recenter" button that floats
 * just above the sheet's top edge.
 */
export default function MapView({ sheetFraction }) {
  const {
    currentPosition,
    startPosition,
    effectiveStart,
    usingCurrentLocation,
    geoStatus,
    generatedRoute,
    viaPoint,
    endPoint,
    pickingMode,
    placeMapPoint,
  } = useAppState();
  const { mapStyle } = useSettings();
  const tile = getStyle(mapStyle);
  const { request } = useGeolocation();
  const [recenterSignal, setRecenterSignal] = useState(0);

  // The generated route once available; otherwise null (no fake placeholder).
  const route = useMemo(() => generatedRoute?.coords ?? null, [generatedRoute]);

  // Map "ready" once its first tiles have painted. A safety timeout flips it
  // true regardless, so we never get stuck (e.g. tiles fail to load offline).
  const [mapReady, setMapReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMapReady(true), 6000);
    return () => clearTimeout(t);
  }, []);

  // Has the map finished flying to the located start? Kept up so the overlay
  // covers the jump. Safety timeout so we never wait forever (e.g. flyTo no-op).
  const [locationCentered, setLocationCentered] = useState(false);
  useEffect(() => {
    if (!effectiveStart) return undefined;
    const t = setTimeout(() => setLocationCentered(true), 2500);
    return () => clearTimeout(t);
  }, [effectiveStart?.lat, effectiveStart?.lng]);

  // Still trying to get the user's location (no start point yet).
  const locating =
    !effectiveStart && (geoStatus === 'idle' || geoStatus === 'locating');
  // Have a start point but the map hasn't centered on it yet.
  const awaitingCenter = Boolean(effectiveStart) && !locationCentered;

  // Show the loading overlay until the map has painted AND we've either centered
  // on the user's location (covering the fly-to jump) or location was
  // denied/unavailable. Never shown once a route exists.
  const showOverlay = !route && (!mapReady || locating || awaitingCenter);
  const overlayText = locating || awaitingCenter ? 'מאתר מיקום…' : 'טוען מפה…';

  const recenter = () => {
    request(); // refresh the GPS fix
    setRecenterSignal((s) => s + 1); // re-fit the map
  };

  return (
    <div className={`map-layer ${pickingMode ? 'picking-via' : ''}`}>
      <MapContainer
        center={DEFAULT_LATLNG}
        zoom={14}
        className="map"
        zoomControl={false}
      >
        <ViaPicker active={Boolean(pickingMode)} onPick={placeMapPoint} />
        {/* Basemap — the user's chosen style (key swaps the layer on change). */}
        <TileLayer
          key={tile.id}
          attribution={tile.attribution}
          url={tile.url}
          subdomains={tile.subdomains || 'abc'}
          maxZoom={tile.maxZoom}
          eventHandlers={{ load: () => setMapReady(true) }}
        />
        {/* Route polyline — only when a real route exists (no fake placeholder). */}
        {route && (
          <>
            {/* Soft mint glow behind the route. */}
            <Polyline
              positions={route}
              pathOptions={{
                color: '#2e785a',
                weight: 9,
                opacity: 0.18,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            <Polyline
              positions={route}
              pathOptions={{
                color: '#3e9b76',
                weight: 5,
                lineCap: 'round',
                lineJoin: 'round',
                className: 'rr-route-line',
              }}
            />
          </>
        )}

        {/* Current location: blue dot with a white ring. */}
        {currentPosition && (
          <CircleMarker
            center={[currentPosition.lat, currentPosition.lng]}
            radius={8}
            pathOptions={{
              color: '#ffffff',
              weight: 3,
              opacity: 1,
              fillColor: '#1d9bf0',
              fillOpacity: 1,
            }}
          />
        )}

        {/* Start point (only when it differs from the live location). */}
        {!usingCurrentLocation && startPosition && (
          <CircleMarker
            center={[startPosition.lat, startPosition.lng]}
            radius={7}
            pathOptions={{
              color: '#ffffff',
              weight: 3,
              opacity: 1,
              fillColor: '#3e9b76',
              fillOpacity: 1,
            }}
          />
        )}

        {/* Via-point the loop must pass through (slate). */}
        {viaPoint && (
          <CircleMarker
            center={[viaPoint.lat, viaPoint.lng]}
            radius={8}
            pathOptions={{
              color: '#ffffff',
              weight: 3,
              opacity: 1,
              fillColor: '#4a5a6b',
              fillOpacity: 1,
            }}
          />
        )}

        {/* End-point for A→B (ink/charcoal). */}
        {endPoint && (
          <CircleMarker
            center={[endPoint.lat, endPoint.lng]}
            radius={8}
            pathOptions={{
              color: '#ffffff',
              weight: 3,
              opacity: 1,
              fillColor: '#2f3a45',
              fillOpacity: 1,
            }}
          />
        )}

        <MapController
          route={route}
          center={effectiveStart}
          sheetFraction={sheetFraction}
          recenterSignal={recenterSignal}
          onCentered={() => {
            // Map view is already set; give the destination tiles a beat to
            // paint under the overlay before lifting it.
            window.setTimeout(() => setLocationCentered(true), 300);
          }}
        />
      </MapContainer>

      {/* Loading overlay: while the map paints and the location resolves. */}
      {showOverlay && (
        <div className="map-loading" role="status" aria-live="polite">
          <div className="map-loading-card">
            <span className="map-spinner" />
            <span>{overlayText}</span>
          </div>
        </div>
      )}

      <button
        className={`recenter-fab ${geoStatus === 'locating' ? 'locating' : ''}`}
        style={{ bottom: `calc(${sheetFraction * 100}% + 12px)` }}
        onClick={recenter}
        aria-label="מרכז מיקום"
      >
        <TargetIcon />
      </button>
    </div>
  );
}
