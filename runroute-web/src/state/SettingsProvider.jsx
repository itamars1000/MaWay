import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getMapStyleId, setMapStyleStored, getLang, setLangStored } from '../lib/settings.js';
import { translate } from '../lib/i18n.js';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [a11yOpen, setA11yOpen] = useState(false);
  const [mapStyle, setMapStyleState] = useState(getMapStyleId);
  const [lang, setLangState] = useState(getLang);

  const setMapStyle = (id) => {
    setMapStyleState(id);
    setMapStyleStored(id);
  };

  const setLang = (l) => {
    setLangState(l);
    setLangStored(l);
  };

  // Sync document direction and language attribute whenever lang changes.
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
  }, [lang]);

  const t = useCallback((key, vars) => translate(lang, key, vars), [lang]);

  const value = {
    open,
    openSettings: () => setOpen(true),
    closeSettings: () => setOpen(false),
    privacyOpen,
    openPrivacy: () => setPrivacyOpen(true),
    closePrivacy: () => setPrivacyOpen(false),
    a11yOpen,
    openA11y: () => setA11yOpen(true),
    closeA11y: () => setA11yOpen(false),
    mapStyle,
    setMapStyle,
    lang,
    setLang,
    t,
  };
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider');
  return ctx;
}

/** Shortcut for just the translation function + current language. */
export function useT() {
  const { t, lang } = useSettings();
  return { t, lang };
}
