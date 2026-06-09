import { useEffect, useState } from 'react';
import { AppStateProvider } from './state/AppState.jsx';
import { AuthProvider } from './state/AuthProvider.jsx';
import { useGeolocation } from './hooks/useGeolocation.js';
import MapView from './components/MapView.jsx';
import FloatingHeader from './components/FloatingHeader.jsx';
import BottomSheet, { SNAP } from './components/BottomSheet.jsx';

/** Requests the user's location once on mount. */
function GeolocationBootstrap() {
  const { request } = useGeolocation();
  useEffect(() => {
    request();
  }, [request]);
  return null;
}

/**
 * The single screen. Composes three stacked layers:
 *   1. MapView        (base, fills the screen)
 *   2. FloatingHeader (top, transparent, overlaps the map)
 *   3. BottomSheet    (interaction, snapping draggable sheet)
 *
 * `sheetFraction` (0..1 of viewport height) is lifted here so the map can lift
 * its visible center above the sheet and the recenter button can track its edge.
 */
export default function App() {
  const [sheetFraction, setSheetFraction] = useState(SNAP.anchor);

  return (
    <AuthProvider>
      <AppStateProvider>
        <GeolocationBootstrap />
        <div className="app">
          <MapView sheetFraction={sheetFraction} />
          <FloatingHeader />
          <BottomSheet onFractionChange={setSheetFraction} />
        </div>
      </AppStateProvider>
    </AuthProvider>
  );
}
