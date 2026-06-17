import { useAppState, TABS } from '../state/AppState.jsx';
import { useT } from '../state/SettingsProvider.jsx';

/**
 * Two-option segmented control bound to the active tab.
 * Route / Saved. The active pill slides between options.
 */
export default function SegmentedTabs() {
  const { currentTab, setCurrentTab } = useAppState();
  const { t } = useT();
  const isRoute = currentTab === TABS.ROUTE;

  return (
    <div className="segmented">
      <span
        className="segmented-thumb"
        style={{ transform: isRoute ? 'translateX(0)' : 'translateX(-100%)' }}
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
