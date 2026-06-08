import { useCallback } from 'react';
import { useAppState } from '../state/AppState.jsx';

/**
 * Wraps the browser Geolocation API and writes the result into AppState.
 *
 * NOTE: navigator.geolocation only works in a secure context (HTTPS or
 * localhost). On plain http://<LAN-IP> the call fails — handled here by
 * setting geoStatus to 'unavailable'/'denied' so the UI degrades gracefully.
 */
export function useGeolocation() {
  const { setCurrentPosition, setGeoStatus } = useAppState();

  const request = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoStatus('unavailable');
      return;
    }

    setGeoStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCurrentPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setGeoStatus('granted');
      },
      (err) => {
        // 1 = PERMISSION_DENIED, others = position unavailable / timeout.
        setGeoStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  }, [setCurrentPosition, setGeoStatus]);

  return { request };
}
