import { useEffect, useMemo, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import { TargetIcon, RouteIcon } from './icons.jsx';
import { useAppState } from '../state/AppState.jsx';
import { useSettings, useT } from '../state/SettingsProvider.jsx';
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
function MapController({
  route,
  center,
  sheetFraction,
  locateSignal,
  locateTarget,
  fitSignal,
  onCentered,
}) {
  const map = useMap();
  // Stable dependency for the route geometry (null when no route yet).
  const routeKey = route ? route.map((p) => p.join(',')).join('|') : null;

  // Fit the route into view, padded to clear the header and the sheet.
  const fitRoute = () => {
    const bottomPx = sheetFraction * map.getSize().y;
    map.flyToBounds(route, {
      paddingTopLeft: [24, 90], // clear the floating header
      paddingBottomRight: [24, bottomPx + 24], // clear the sheet
      duration: 0.4,
    });
  };

  // Auto: fit a freshly generated route; otherwise center on the start point as
  // soon as it's known (covered by the loading overlay on first load). Also
  // re-runs when the sheet resizes so the content stays visible above it.
  useEffect(() => {
    if (!map) return;
    if (route && route.length) {
      fitRoute();
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
  }, [routeKey, center?.lat, center?.lng, sheetFraction, map]);

  // Manual "my location": fly to the user's position regardless of any route.
  useEffect(() => {
    if (!map || !locateSignal || !locateTarget) return;
    map.flyTo([locateTarget.lat, locateTarget.lng], Math.max(map.getZoom(), 15), {
      duration: 0.4,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locateSignal]);

  // Manual "show route": re-fit the current route's bounds.
  useEffect(() => {
    if (!map || !fitSignal || !(route && route.length)) return;
    fitRoute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitSignal]);

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
  const { t } = useT();
  const tile = getStyle(mapStyle);
  const { request } = useGeolocation();
  const [locateSignal, setLocateSignal] = useState(0);
  const [fitSignal, setFitSignal] = useState(0);

  // The generated route once available; otherwise null (no fake placeholder).
  const route = useMemo(() => generatedRoute?.coords ?? null, [generatedRoute]);

  // Styled map pins (teardrop SVG, colored per role, white outline + inner glyph)
  // and the live GPS dot with a pulsing ring. Built once — stable identities.
  const { startIcon, viaIcon, endIcon, geoIcon } = useMemo(() => {
    const pin = (color, inner) =>
      `<svg width="30" height="38" viewBox="0 0 30 38" xmlns="http://www.w3.org/2000/svg">` +
      `<path d="M15 1C8 1 2.5 6.5 2.5 13.5 2.5 23 15 37 15 37S27.5 23 27.5 13.5C27.5 6.5 22 1 15 1Z" ` +
      `fill="${color}" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/>${inner}</svg>`;
    const DOT = '<circle cx="15" cy="14" r="4.6" fill="#fff"/>';
    const FLAG =
      '<rect x="11" y="7.5" width="1.5" height="9.5" rx="0.7" fill="#fff"/>' +
      '<path d="M12.8 8.2h6.4l-1.8 2.4 1.8 2.4h-6.4z" fill="#fff"/>';
    const make = (html, size, anchor, className) =>
      L.divIcon({ html, className, iconSize: size, iconAnchor: anchor });
    return {
      startIcon: make(pin('#3e9b76', DOT), [30, 38], [15, 37], 'rr-pin'),
      viaIcon: make(pin('#4a5a6b', DOT), [30, 38], [15, 37], 'rr-pin'),
      endIcon: make(pin('#2f3a45', FLAG), [30, 38], [15, 37], 'rr-pin'),
      geoIcon: make('<span class="rr-geodot"></span>', [18, 18], [9, 9], 'rr-geodot-wrap'),
    };
  }, []);

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
  const overlayText = locating || awaitingCenter ? t('map.locating') : t('map.loading');

  // Where "my location" jumps to: the live GPS dot if we have one, else the
  // chosen start point.
  const locateTarget = currentPosition ?? effectiveStart;

  const goToMyLocation = () => {
    request(); // refresh the GPS fix
    setLocateSignal((s) => s + 1); // fly to it
  };
  const showRoute = () => setFitSignal((s) => s + 1); // fit the route bounds

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
        {/* Route — only when a real route exists (no fake placeholder). Three
            stacked lines: a white casing (pops on dark/satellite), the solid
            mint route, and a light dashed overlay that animates a directional
            "flow" along the path. */}
        {route && (
          <>
            <Polyline
              positions={route}
              pathOptions={{
                color: '#ffffff',
                weight: 9,
                opacity: 0.95,
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
            <Polyline
              positions={route}
              pathOptions={{
                color: '#eaf7f0',
                weight: 5,
                opacity: 0.9,
                lineCap: 'round',
                lineJoin: 'round',
                dashArray: '10 16',
                className: 'rr-route-flow',
              }}
            />
          </>
        )}

        {/* Live location: blue dot with a pulsing ring. */}
        {currentPosition && (
          <Marker
            position={[currentPosition.lat, currentPosition.lng]}
            icon={geoIcon}
            interactive={false}
            keyboard={false}
          />
        )}

        {/* Start pin (only when it differs from the live location). */}
        {!usingCurrentLocation && startPosition && (
          <Marker
            position={[startPosition.lat, startPosition.lng]}
            icon={startIcon}
            interactive={false}
            keyboard={false}
          />
        )}

        {/* Via-point the loop must pass through (slate pin). */}
        {viaPoint && (
          <Marker
            position={[viaPoint.lat, viaPoint.lng]}
            icon={viaIcon}
            interactive={false}
            keyboard={false}
          />
        )}

        {/* End-point for A→B (ink flag pin). */}
        {endPoint && (
          <Marker
            position={[endPoint.lat, endPoint.lng]}
            icon={endIcon}
            interactive={false}
            keyboard={false}
          />
        )}

        <MapController
          route={route}
          center={effectiveStart}
          sheetFraction={sheetFraction}
          locateSignal={locateSignal}
          locateTarget={locateTarget}
          fitSignal={fitSignal}
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

      {/* Map controls, floating just above the sheet's top edge: a button to
          fit the route (only when one exists) and a button to jump to the
          user's own location. */}
      <div
        className="map-fabs"
        style={{ bottom: `calc(${sheetFraction * 100}% + 12px)` }}
      >
        {route && (
          <button
            className="recenter-fab route-fab"
            type="button"
            onClick={showRoute}
            aria-label={t('map.showRoute')}
            title={t('map.showRoute')}
          >
            <RouteIcon size={22} />
          </button>
        )}
        <button
          className={`recenter-fab ${geoStatus === 'locating' ? 'locating' : ''}`}
          type="button"
          onClick={goToMyLocation}
          aria-label={t('map.myLocation')}
          title={t('map.myLocationTitle')}
        >
          <TargetIcon />
        </button>
      </div>
    </div>
  );
}
