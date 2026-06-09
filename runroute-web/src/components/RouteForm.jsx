import { useState } from 'react';
import {
  useAppState,
  ROUTE_TYPES,
  MIN_DISTANCE,
  MAX_DISTANCE,
  CURRENT_LOCATION_LABEL,
} from '../state/AppState.jsx';
import { useRouteGenerator } from '../hooks/useRouteGenerator.js';
import { sendFeedback } from '../lib/engine.js';
import { downloadGpx } from '../lib/gpx.js';
import AddressAutocomplete from './AddressAutocomplete.jsx';
import {
  LoopIcon,
  AbIcon,
  RouteIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  BookmarkIcon,
  DownloadIcon,
} from './icons.jsx';

/** The form shown under the "מסלול" (Route) tab. */
export default function RouteForm() {
  const {
    routeType,
    setRouteType,
    selectedDistance,
    setSelectedDistance,
    geoStatus,
    generatedRoute,
    routeStatus,
    routeError,
    routeCount,
    showNextRoute,
    // start field
    startLocation,
    setStartLocation,
    selectAddress,
    useCurrentLocationAsStart,
    // via / end / picking
    viaPoint,
    endPoint,
    endLocation,
    setEndLocation,
    selectEndAddress,
    pickingMode,
    setPickingMode,
    clearViaPoint,
    clearEndPoint,
    // saving
    saveCurrentRoute,
    justSaved,
    setJustSaved,
  } = useAppState();
  const { generate } = useRouteGenerator();
  const [feedbackGiven, setFeedbackGiven] = useState(null); // 'up' | 'down' | null

  // Fill percentage for the mint track of the range input.
  const fillPct = Math.round(
    ((selectedDistance - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE)) * 100,
  );

  const rate = (liked) => {
    if (!generatedRoute) return;
    sendFeedback(generatedRoute, selectedDistance, liked);
    setFeedbackGiven(liked ? 'up' : 'down');
  };

  const loading = routeStatus === 'loading';
  const hasRoute = routeStatus !== 'error' && Boolean(generatedRoute);

  return (
    <div className="route-form">
      {/* route type */}
      <div>
        <span className="section-label">סוג מסלול</span>
        <div className="pill-row">
          <button
            type="button"
            className={`pill ${routeType === ROUTE_TYPES.LOOP ? 'active' : ''}`}
            onClick={() => setRouteType(ROUTE_TYPES.LOOP)}
          >
            <LoopIcon />
            <span>סיבוב</span>
          </button>
          <button
            type="button"
            className={`pill ${routeType === ROUTE_TYPES.ONE_WAY ? 'active' : ''}`}
            onClick={() => setRouteType(ROUTE_TYPES.ONE_WAY)}
          >
            <AbIcon />
            <span>A → B</span>
          </button>
        </div>
      </div>

      {/* start location */}
      <div>
        <span className="section-label">נקודת התחלה</span>
        <AddressAutocomplete
          variant="start"
          value={startLocation}
          onChange={setStartLocation}
          onPick={selectAddress}
          onUseCurrent={useCurrentLocationAsStart}
          committedInit={CURRENT_LOCATION_LABEL}
          placeholder="חפש כתובת או נקודת התחלה"
        />
        {geoStatus === 'denied' && (
          <span className="geo-hint">
            הגישה למיקום נחסמה — חפש כתובת ידנית או אפשר מיקום בדפדפן.
          </span>
        )}
        {geoStatus === 'unavailable' && (
          <span className="geo-hint">
            מיקום אינו זמין (נדרש חיבור מאובטח) — חפש כתובת ידנית.
          </span>
        )}
        <button
          type="button"
          className={`via-pick ${pickingMode === 'start' ? 'armed' : ''}`}
          style={{ marginTop: 8 }}
          onClick={() => setPickingMode((m) => (m === 'start' ? null : 'start'))}
        >
          {pickingMode === 'start'
            ? 'הקש על המפה לבחירת ההתחלה…'
            : '📍 בחר התחלה על המפה'}
        </button>
      </div>

      {/* end point (A→B mode): address search OR a tapped map point */}
      {routeType === ROUTE_TYPES.ONE_WAY && (
        <div>
          <span className="section-label">נקודת סיום</span>
          <AddressAutocomplete
            variant="end"
            value={endLocation}
            onChange={setEndLocation}
            onPick={selectEndAddress}
            placeholder="חפש יעד"
          />
          <button
            type="button"
            className={`via-pick ${pickingMode === 'end' ? 'armed' : ''}`}
            style={{ marginTop: 8 }}
            onClick={() =>
              endPoint
                ? clearEndPoint()
                : setPickingMode((m) => (m === 'end' ? null : 'end'))
            }
          >
            {endPoint
              ? '✕ הסר יעד'
              : pickingMode === 'end'
              ? 'הקש על המפה לבחירת היעד…'
              : '🏁 בחר יעד על המפה'}
          </button>
        </div>
      )}

      {/* via-point (loop mode only): pass the loop through a tapped map point */}
      {routeType === ROUTE_TYPES.LOOP && (
        <div>
          <span className="section-label">נקודת מעבר (אופציונלי)</span>
          {viaPoint ? (
            <div className="via-chip">
              <span>📍 הסיבוב יעבור דרך הנקודה שבחרת</span>
              <button
                type="button"
                className="via-clear"
                onClick={clearViaPoint}
                aria-label="הסר נקודת מעבר"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={`via-pick ${pickingMode === 'via' ? 'armed' : ''}`}
              onClick={() => setPickingMode((m) => (m === 'via' ? null : 'via'))}
            >
              {pickingMode === 'via'
                ? 'הקש על המפה לבחירת נקודה…'
                : '➕ בחר נקודת מעבר על המפה'}
            </button>
          )}
        </div>
      )}

      {/* distance */}
      <div>
        <div className="distance-head">
          <span className="section-label">מרחק</span>
          <span className="dist-value">
            <b>{Math.round(selectedDistance)}</b> <span>ק״מ</span>
          </span>
        </div>
        <input
          type="range"
          className="slider"
          min={MIN_DISTANCE}
          max={MAX_DISTANCE}
          step={1}
          value={selectedDistance}
          onChange={(e) => setSelectedDistance(Number(e.target.value))}
          style={{ '--fill': `${fillPct}%` }}
        />
        <div className="slider-ticks">
          <span>1</span>
          <span>7</span>
          <span>14</span>
          <span>21</span>
        </div>
      </div>

      {/* stat chips (after a route exists) */}
      {hasRoute && (
        <div className="stat-row">
          <div className="stat stat--mint">
            <div className="stat-top" style={{ color: 'var(--mint-deep)' }}>
              <RouteIcon size={18} />
              <span className="stat-value">
                {generatedRoute.distanceKm.toFixed(1)}
              </span>
            </div>
            <div className="stat-label">ק״מ</div>
          </div>
          <div className="stat stat--sky">
            <div className="stat-top" style={{ color: 'var(--sky)' }}>
              <ArrowUpIcon size={18} />
              <span className="stat-value">
                {generatedRoute.ascentM ?? '—'}
              </span>
            </div>
            <div className="stat-label">מ׳ עלייה</div>
          </div>
          <div className="stat stat--amber">
            <div className="stat-top" style={{ color: 'var(--amber)' }}>
              <ArrowDownIcon size={18} />
              <span className="stat-value">
                {generatedRoute.descentM ?? '—'}
              </span>
            </div>
            <div className="stat-label">מ׳ ירידה</div>
          </div>
        </div>
      )}

      {/* CTA */}
      <button
        className="action-button"
        type="button"
        onClick={() => {
          setFeedbackGiven(null);
          setJustSaved(false);
          generate();
        }}
        disabled={loading}
      >
        <RouteIcon size={20} />
        {loading ? 'מחשב מסלול…' : hasRoute ? 'מסלול חדש' : 'צור מסלול'}
      </button>

      {routeStatus === 'error' && routeError && (
        <p className="route-error">{routeError}</p>
      )}

      {hasRoute && (
        <>
          {generatedRoute.belowRequested && (
            <p className="route-warn">
              ⚠️ לא נמצא מסלול באורך המבוקש כאן — זהו הארוך ביותר (
              {generatedRoute.distanceKm.toFixed(1)} ק״מ)
            </p>
          )}
          {generatedRoute.directOnly && (
            <p className="route-warn">
              ℹ️ זהו המסלול הישיר ל-B ({generatedRoute.distanceKm.toFixed(1)} ק״מ)
              — ארוך מהמבוקש
            </p>
          )}

          {routeCount > 1 && (
            <button
              className="next-route"
              type="button"
              onClick={() => {
                setFeedbackGiven(null);
                setJustSaved(false);
                showNextRoute();
              }}
            >
              מסלול הבא ›
            </button>
          )}

          {/* Save to device + export GPX */}
          <div className="result-actions">
            <button
              type="button"
              className={`result-btn ${justSaved ? 'saved' : ''}`}
              onClick={() => saveCurrentRoute()}
              disabled={justSaved}
            >
              <BookmarkIcon filled={justSaved} />
              {justSaved ? 'נשמר' : 'שמור'}
            </button>
            <button
              type="button"
              className="result-btn"
              onClick={() =>
                downloadGpx({
                  name: `MaWay ${generatedRoute.distanceKm.toFixed(1)}ק״מ`,
                  coords: generatedRoute.coords,
                })
              }
            >
              <DownloadIcon />
              GPX
            </button>
          </div>
          <p
            className={`turn-rate ${
              generatedRoute.meetsTurnTarget ? 'ok' : 'over'
            }`}
          >
            {generatedRoute.meetsTurnTarget ? '✓ ' : ''}
            {generatedRoute.turnsPerKm.toFixed(1)} פניות לק"מ
            {generatedRoute.meetsTurnTarget ? '' : ' (יעד ≤3)'}
          </p>
          <div className="feedback-row">
            {feedbackGiven ? (
              <span className="feedback-thanks">
                תודה! זה ישפר את המסלולים הבאים 🙏
              </span>
            ) : (
              <>
                <span className="feedback-q">איך המסלול?</span>
                <button
                  className="feedback-btn"
                  type="button"
                  onClick={() => rate(true)}
                  aria-label="מסלול טוב"
                >
                  👍
                </button>
                <button
                  className="feedback-btn"
                  type="button"
                  onClick={() => rate(false)}
                  aria-label="מסלול לא טוב"
                >
                  👎
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
