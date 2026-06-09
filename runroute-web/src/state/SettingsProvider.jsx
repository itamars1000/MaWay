import { createContext, useContext, useState } from 'react';
import {
  getPace,
  setPaceStored,
  DEFAULT_PACE,
  MIN_PACE,
  MAX_PACE,
} from '../lib/settings.js';

/**
 * UI state for the settings screen + the persisted user preferences it edits.
 * Pace is also read directly from localStorage by engine.js (via getPace), so
 * changing it here affects the estimated time of the next generated route.
 */
const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [pace, setPaceState] = useState(getPace);

  const setPace = (value) => {
    const clamped = Math.min(MAX_PACE, Math.max(MIN_PACE, value));
    setPaceState(clamped);
    setPaceStored(clamped);
  };

  const value = {
    open,
    openSettings: () => setOpen(true),
    closeSettings: () => setOpen(false),
    pace,
    setPace,
    paceBounds: { min: MIN_PACE, max: MAX_PACE, default: DEFAULT_PACE },
  };
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider');
  return ctx;
}
