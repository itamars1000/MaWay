import { Component } from 'react';
import { getLang } from '../lib/settings.js';
import { reportError } from '../lib/sentry.js';

/* Wraps the whole app (see main.jsx), so it must not depend on any provider —
   language comes straight from localStorage and the strings live here. */
const STRINGS = {
  he: {
    title: 'משהו השתבש',
    body: 'אירעה שגיאה בלתי צפויה. רענון הדף בדרך כלל פותר את זה.',
    reload: 'רענון הדף',
  },
  en: {
    title: 'Something went wrong',
    body: 'An unexpected error occurred. Reloading the page usually fixes it.',
    reload: 'Reload page',
  },
};

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled app error:', error, info?.componentStack);
    reportError(error, { componentStack: info?.componentStack });
  }

  render() {
    if (!this.state.error) return this.props.children;

    const lang = getLang() === 'en' ? 'en' : 'he';
    const s = STRINGS[lang];
    return (
      <div
        role="alert"
        dir={lang === 'he' ? 'rtl' : 'ltr'}
        style={{
          position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24,
          textAlign: 'center', background: '#f4f7f8', color: '#2b3947',
          fontFamily: "'Rubik', system-ui, sans-serif", zIndex: 2000,
        }}
      >
        <img src="/maway-logo.png" alt="MaWay" style={{ width: 64, height: 64 }} />
        <h1 style={{ fontSize: 22, margin: 0 }}>{s.title}</h1>
        <p style={{ margin: 0, maxWidth: 320 }}>{s.body}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            marginTop: 8, padding: '12px 28px', border: 'none', borderRadius: 16,
            background: '#3e9b76', color: '#fff', fontSize: 16, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {s.reload}
        </button>
      </div>
    );
  }
}
