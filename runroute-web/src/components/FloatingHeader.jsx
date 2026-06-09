import SegmentedTabs from './SegmentedTabs.jsx';
import SettingsButton from './SettingsButton.jsx';

/**
 * Transparent top bar overlapping the map, with frosted-glass pills.
 * Right (RTL start): the MaWay brand logo. Left: the segmented control and the
 * settings button (which also holds the account / sign-in section).
 */
export default function FloatingHeader() {
  return (
    <header className="header">
      <div className="brand-pill glass-pill">
        <img className="brand-logo" src="/maway-logo.png" alt="MaWay" />
      </div>
      <div className="header-tabs glass-pill">
        <SegmentedTabs />
      </div>
      <SettingsButton />
    </header>
  );
}
