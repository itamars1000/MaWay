import { useState } from 'react';
import {
  useAppState,
  ROUTE_TYPES,
  MIN_DISTANCE,
  MAX_DISTANCE,
  CURRENT_LOCATION_LABEL,
  MAP_POINT_LABEL,
} from '../state/AppState.jsx';
import { useT } from '../state/SettingsProvider.jsx';
import { useRouteGenerator } from '../hooks/useRouteGenerator.js';
import { sendFeedback } from '../lib/engine.js';
import { downloadGpx } from '../lib/gpx.js';
import AddressAutocomplete from './AddressAutocomplete.jsx';
import BuildingPanel from './BuildingPanel.jsx';
import {
  LoopIcon,
  AbIcon,
  RouteIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  BookmarkIcon,
  DownloadIcon,
  TrashIcon,
} from './icons.jsx';

/** The form shown under the "Route" tab. */
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
    clearRoute,
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
  const { t, lang } = useT();
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

  const building = routeStatus === 'building';
  const loading = routeStatus === 'loading' || building;
  const hasRoute = routeStatus !== 'error' && Boolean(generatedRoute);

  // Resolve sentinel values to translated display labels.
  const startDisplay =
    startLocation === CURRENT_LOCATION_LABEL
      ? t('location.current')
      : startLocation === MAP_POINT_LABEL
      ? t('location.mapPoint')
      : startLocation;
  const endDisplay =
    endLocation === MAP_POINT_LABEL ? t('location.mapPoint') : endLocation;

  return (
    <div className="route-form">
      {/* route type */}
      <div>
        <span className="section-label">{t('form.routeType')}</span>
        <div className="pill-row">
          <button
            type="button"
            className={`pill ${routeType === ROUTE_TYPES.LOOP ? 'active' : ''}`}
            onClick={() => setRouteType(ROUTE_TYPES.LOOP)}
          >
            <LoopIcon />
            <span>{t('form.loop')}</span>
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
        <span className="section-label">{t('form.startPoint')}</span>
        {/*
          key forces a remount when the language changes while the sentinel is
          active — so committedInit refreshes to the new translated label.
        */}
        <AddressAutocomplete
          key={startLocation === CURRENT_LOCATION_LABEL ? `start-${lang}` : 'start'}
          variant="start"
          value={startDisplay}
          onChange={setStartLocation}
          onPick={selectAddress}
          onUseCurrent={useCurrentLocationAsStart}
          committedInit={startDisplay}
          placeholder={t('form.startPlaceholder')}
        />
        {geoStatus === 'denied' && (
          <span className="geo-hint">{t('form.geoDenied')}</span>
        )}
        {geoStatus === 'unavailable' && (
          <span className="geo-hint">{t('form.geoUnavailable')}</span>
        )}
        <button
          type="button"
          className={`via-pick ${pickingMode === 'start' ? 'armed' : ''}`}
          style={{ marginTop: 8 }}
          onClick={() => setPickingMode((m) => (m === 'start' ? null : 'start'))}
        >
          {pickingMode === 'start' ? t('form.tapMapStart') : t('form.pickStart')}
        </button>
      </div>

      {/* end point (A→B mode) */}
      {routeType === ROUTE_TYPES.ONE_WAY && (
        <div>
          <span className="section-label">{t('form.endPoint')}</span>
          <AddressAutocomplete
            variant="end"
            value={endDisplay}
            onChange={setEndLocation}
            onPick={selectEndAddress}
            placeholder={t('form.endPlaceholder')}
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
              ? t('form.removeEnd')
              : pickingMode === 'end'
              ? t('form.tapMapEnd')
              : t('form.pickEnd')}
          </button>
        </div>
      )}

      {/* via-point (loop mode only) */}
      {routeType === ROUTE_TYPES.LOOP && (
        <div>
          <span className="section-label">{t('form.viaPoint')}</span>
          {viaPoint ? (
            <div className="via-chip">
              <span>{t('form.viaConfirmed')}</span>
              <button
                type="button"
                className="via-clear"
                onClick={clearViaPoint}
                aria-label={t('form.removeViaAria')}
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
              {pickingMode === 'via' ? t('form.tapMapVia') : t('form.pickVia')}
            </button>
          )}
        </div>
      )}

      {/* distance */}
      <div>
        <div className="distance-head">
          <span className="section-label">{t('form.distance')}</span>
          <span className="dist-value">
            <b>{Math.round(selectedDistance)}</b> <span>{t('units.km')}</span>
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

      {/* stat chips */}
      {hasRoute && (
        <div className="stat-row">
          <div className="stat stat--mint">
            <div className="stat-top" style={{ color: 'var(--mint-deep)' }}>
              <RouteIcon size={18} />
              <span className="stat-value">
                {generatedRoute.distanceKm.toFixed(1)}
              </span>
            </div>
            <div className="stat-label">{t('units.km')}</div>
          </div>
          <div className="stat stat--sky">
            <div className="stat-top" style={{ color: 'var(--sky)' }}>
              <ArrowUpIcon size={18} />
              <span className="stat-value">
                {generatedRoute.ascentM ?? '—'}
              </span>
            </div>
            <div className="stat-label">{t('stat.ascent')}</div>
          </div>
          <div className="stat stat--amber">
            <div className="stat-top" style={{ color: 'var(--amber)' }}>
              <ArrowDownIcon size={18} />
              <span className="stat-value">
                {generatedRoute.descentM ?? '—'}
              </span>
            </div>
            <div className="stat-label">{t('stat.descent')}</div>
          </div>
        </div>
      )}

      {/* CTA */}
      {building ? (
        <BuildingPanel />
      ) : (
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
          {loading ? t('cta.loading') : hasRoute ? t('cta.new') : t('cta.create')}
        </button>
      )}

      {routeStatus === 'error' && routeError && (
        <p className="route-error">{routeError}</p>
      )}

      {hasRoute && (
        <>
          {generatedRoute.belowRequested && (
            <p className="route-warn">
              {t('route.warnBelow', { dist: generatedRoute.distanceKm.toFixed(1) })}
            </p>
          )}
          {generatedRoute.directOnly && (
            <p className="route-warn">
              {t('route.warnDirect', { dist: generatedRoute.distanceKm.toFixed(1) })}
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
              {t('route.next')}
            </button>
          )}

          <div className="result-actions">
            <button
              type="button"
              className={`result-btn ${justSaved ? 'saved' : ''}`}
              onClick={() => saveCurrentRoute()}
              disabled={justSaved}
            >
              <BookmarkIcon filled={justSaved} />
              {justSaved ? t('save.saved') : t('save.save')}
            </button>
            <button
              type="button"
              className="result-btn"
              onClick={() =>
                downloadGpx({
                  name: `MaWay ${generatedRoute.distanceKm.toFixed(1)}${t('units.km')}`,
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
            {t('route.turnsPerKm', { turns: generatedRoute.turnsPerKm.toFixed(1) })}
            {generatedRoute.meetsTurnTarget ? '' : ` ${t('route.turnTarget')}`}
          </p>
          <div className="feedback-row">
            {feedbackGiven ? (
              <span className="feedback-thanks">{t('feedback.thanks')}</span>
            ) : (
              <>
                <span className="feedback-q">{t('feedback.q')}</span>
                <button
                  className="feedback-btn"
                  type="button"
                  onClick={() => rate(true)}
                  aria-label={t('feedback.goodAria')}
                >
                  👍
                </button>
                <button
                  className="feedback-btn"
                  type="button"
                  onClick={() => rate(false)}
                  aria-label={t('feedback.badAria')}
                >
                  👎
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            className="clear-route"
            onClick={() => {
              setFeedbackGiven(null);
              setJustSaved(false);
              clearRoute();
            }}
          >
            <TrashIcon />
            {t('route.clear')}
          </button>
        </>
      )}
    </div>
  );
}
