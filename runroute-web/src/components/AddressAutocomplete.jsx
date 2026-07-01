import { useEffect, useRef, useState } from 'react';
import { searchAddress } from '../lib/geocode.js';
import { useT } from '../state/SettingsProvider.jsx';
import { LocationIcon, TargetIcon, FlagIcon } from './icons.jsx';

const DEBOUNCE_MS = 400;

/**
 * Address input with Photon autocomplete — used for BOTH the start and the
 * A→B end field. Controlled via props:
 *   value        current text (already display-resolved by the parent)
 *   onChange     (text) => void
 *   onPick       ({ label, lat, lng }) => void   (selected a suggestion)
 *   onUseCurrent () => void | undefined          (shows the "use my location" row)
 *   committedInit text the field starts at (won't trigger a search)
 *   variant      'start' | 'end' (icon styling)
 *   near         {lat,lng} | null — bias results near this point (optional)
 */
export default function AddressAutocomplete({
  value,
  onChange,
  onPick,
  onUseCurrent,
  committedInit = '',
  placeholder,
  variant = 'start',
  near = null,
}) {
  const { t, lang } = useT();
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef(null);
  const abortRef = useRef(null);
  const committedRef = useRef(committedInit);

  // Debounced search whenever the typed text changes.
  useEffect(() => {
    const q = (value ?? '').trim();
    if (q === committedRef.current.trim() || q.length < 2) {
      setResults([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const found = await searchAddress(q, { signal: controller.signal, lang, near });
        setResults(found);
        setOpen(true);
      } catch (err) {
        if (err.name !== 'AbortError') setResults([]);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [value, lang, near]);

  // Close the dropdown on outside click.
  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDocClick);
    return () => document.removeEventListener('pointerdown', onDocClick);
  }, []);

  const choose = (item) => {
    committedRef.current = item.label;
    onPick(item);
    setResults([]);
    setOpen(false);
  };

  const chooseCurrent = () => {
    committedRef.current = committedInit;
    onUseCurrent?.();
    setResults([]);
    setOpen(false);
  };

  return (
    <div className="autocomplete" ref={wrapRef}>
      <div className="loc-field">
        <span className={`loc-chip ${variant === 'end' ? 'loc-chip--end' : ''}`}>
          {variant === 'end' ? <FlagIcon /> : <LocationIcon />}
        </span>
        <input
          className="loc-input"
          value={value}
          placeholder={placeholder ?? t('addr.placeholder')}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
        />
        {onUseCurrent && (
          <button
            type="button"
            className="loc-action"
            title={t('addr.useCurrent')}
            aria-label={t('addr.useCurrent')}
            onClick={chooseCurrent}
          >
            <TargetIcon size={20} />
          </button>
        )}
      </div>

      {open && (
        <ul className="suggestions">
          {onUseCurrent && (
            <li className="suggestion suggestion--current" onClick={chooseCurrent}>
              <span className="suggestion-pin">📍</span>
              {t('addr.useCurrent')}
            </li>
          )}
          {loading && <li className="suggestion suggestion--muted">{t('addr.searching')}</li>}
          {!loading && results.length === 0 && (
            <li className="suggestion suggestion--muted">{t('addr.noResults')}</li>
          )}
          {results.map((item, i) => (
            <li
              key={`${item.lat},${item.lng},${i}`}
              className="suggestion"
              onClick={() => choose(item)}
            >
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
