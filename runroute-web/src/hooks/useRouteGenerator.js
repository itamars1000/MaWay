import { useCallback, useRef } from 'react';
import { useAppState, ROUTE_TYPES } from '../state/AppState.jsx';
import { useT } from '../state/SettingsProvider.jsx';
import { generateFromEngine, EngineError } from '../lib/engine.js';

/**
 * Asks the Python route engine for a low-turn loop and stores it in state.
 * Aborts any in-flight request on re-press.
 */
export function useRouteGenerator() {
  const {
    effectiveStart,
    selectedDistance,
    routeType,
    viaPoint,
    endPoint,
    setRouteCandidates,
    setRouteIndex,
    setRouteStatus,
    setRouteError,
  } = useAppState();
  const { t } = useT();
  const abortRef = useRef(null);

  const generate = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setRouteError(null);
    setRouteStatus('loading');
    try {
      const oneWay = routeType === ROUTE_TYPES.ONE_WAY;
      const ranked = await generateFromEngine({
        start: effectiveStart,
        distanceKm: selectedDistance,
        via: oneWay ? null : viaPoint,
        end: oneWay ? endPoint : null,
        signal: controller.signal,
        onBuilding: () => {
          if (abortRef.current === controller) setRouteStatus('building');
        },
      });
      setRouteCandidates(ranked);
      setRouteIndex(0);
      setRouteStatus('idle');
    } catch (err) {
      if (err.name === 'AbortError') return;
      const code = err instanceof EngineError ? err.code : 'default';
      setRouteError(t(`err.${code}`) ?? t('err.default'));
      setRouteStatus('error');
    }
  }, [
    effectiveStart,
    selectedDistance,
    routeType,
    viaPoint,
    endPoint,
    setRouteCandidates,
    setRouteIndex,
    setRouteStatus,
    setRouteError,
    t,
  ]);

  return { generate };
}
