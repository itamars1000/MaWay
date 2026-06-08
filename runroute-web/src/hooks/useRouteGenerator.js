import { useCallback, useRef } from 'react';
import { useAppState, ROUTE_TYPES } from '../state/AppState.jsx';
import { generateFromEngine, EngineError } from '../lib/engine.js';

// Friendly Hebrew messages keyed by EngineError.code.
const MESSAGES = {
  'no-start': 'קבע נקודת התחלה (אפשר מיקום או חפש כתובת).',
  offline: 'מנוע המסלולים לא זמין — ודא שהשרת רץ (uvicorn route_engine.api:app).',
  http: 'יצירת המסלול נכשלה. נסה מרחק אחר או שוב בעוד רגע.',
  empty: 'לא נמצא מסלול מתאים מהנקודה הזו. נסה מרחק אחר.',
  'no-quality':
    'לא נמצא מסלול עם פחות מ-3 פניות לק"מ באזור הזה. נסה מרחק אחר או נקודת התחלה אחרת.',
  timeout:
    'יצירת המסלול ארכה יותר מדי — נסה מרחק קצר יותר, או שוב בעוד רגע.',
  'via-too-far':
    'נקודת המעבר רחוקה מדי לסיבוב באורך הזה — קרב אותה או הגדל את המרחק.',
  'no-via':
    'לא נמצא סיבוב שעובר דרך נקודת המעבר. נסה נקודה אחרת או מרחק אחר.',
  'no-end': 'בחר נקודת סיום (הקש על המפה או חפש כתובת).',
  'end-uncovered': 'היעד מחוץ לאזור הזמין כרגע — נסה יעד קרוב יותר.',
  'no-path': 'לא נמצא מסלול מ-A ל-B. נסה יעד אחר או מרחק אחר.',
  default: 'משהו השתבש ביצירת המסלול. נסה שוב.',
};

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
      });
      setRouteCandidates(ranked);
      setRouteIndex(0); // show the best
      setRouteStatus('idle');
    } catch (err) {
      if (err.name === 'AbortError') return; // superseded by a newer request
      const code = err instanceof EngineError ? err.code : 'default';
      setRouteError(MESSAGES[code] ?? MESSAGES.default);
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
  ]);

  return { generate };
}
