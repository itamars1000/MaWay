import { createContext, useContext, useState } from 'react';
import { getMapStyleId, setMapStyleStored } from '../lib/settings.js';

/**
 * UI state for the settings screen + the persisted user preferences it edits.
 */
const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [mapStyle, setMapStyleState] = useState(getMapStyleId);

  const setMapStyle = (id) => {
    setMapStyleState(id);
    setMapStyleStored(id);
  };

  const value = {
    open,
    openSettings: () => setOpen(true),
    closeSettings: () => setOpen(false),
    mapStyle,
    setMapStyle,
  };
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider');
  return ctx;
}
