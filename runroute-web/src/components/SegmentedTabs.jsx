import { useAppState, TABS } from '../state/AppState.jsx';

/**
 * Two-option segmented control bound to the active tab.
 * "מסלול" (Route) / "שמורים" (Saved). The active pill slides between options.
 */
export default function SegmentedTabs() {
  const { currentTab, setCurrentTab } = useAppState();
  const isRoute = currentTab === TABS.ROUTE;

  return (
    <div className="segmented">
      {/* Sliding active pill. In RTL, "route" is the leading (right) side. */}
      <span
        className="segmented-thumb"
        style={{ transform: isRoute ? 'translateX(0)' : 'translateX(-100%)' }}
      />
      <button
        className={`segment ${isRoute ? 'active' : ''}`}
        onClick={() => setCurrentTab(TABS.ROUTE)}
      >
        מסלול
      </button>
      <button
        className={`segment ${!isRoute ? 'active' : ''}`}
        onClick={() => setCurrentTab(TABS.SAVED)}
      >
        שמורים
      </button>
    </div>
  );
}
