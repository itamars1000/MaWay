import { useAppState, TABS } from '../state/AppState.jsx';
import { useT } from '../state/SettingsProvider.jsx';

/**
 * Two-option segmented control bound to the active tab.
 * Route / Saved. The active pill slides between options.
 */
export default function SegmentedTabs() {
  const { currentTab, setCurrentTab } = useAppState();
  const { t, lang } = useT();
  const isRoute = currentTab === TABS.ROUTE;
  // The thumb sits at the inline-start slot (Route). Reaching Saved (the 2nd
  // slot) moves it toward inline-end — right (+100%) in LTR, left (-100%) in RTL.
  // translateX is physical, so the sign must follow the document direction.
  const shift = isRoute ? 0 : lang === 'he' ? -100 : 100;

  return (
    <div className="segmented">
      <span
        className="segmented-thumb"
        style={{ transform: `translateX(${shift}%)` }}
      />
      <button
        className={`segment ${isRoute ? 'active' : ''}`}
        onClick={() => setCurrentTab(TABS.ROUTE)}
      >
        {t('tabs.route')}
      </button>
      <button
        className={`segment ${!isRoute ? 'active' : ''}`}
        onClick={() => setCurrentTab(TABS.SAVED)}
      >
        {t('tabs.saved')}
      </button>
    </div>
  );
}
