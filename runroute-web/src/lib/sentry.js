// Error tracking (Sentry), optional. Reads the DSN from env (VITE_SENTRY_DSN)
// so the app degrades gracefully to console-only logging when it's unset —
// same pattern as supabase.js. Errors only (no performance tracing, no session
// replay) to keep this lean and avoid recording user screens.
import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN;

export const isSentryConfigured = Boolean(dsn);

export function initSentry() {
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.PROD ? 'production' : 'development',
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
}

/** Report a caught error. No-op (besides the console log already done by the
 * caller) when Sentry isn't configured. */
export function reportError(error, extra) {
  if (!dsn) return;
  Sentry.captureException(error, extra ? { contexts: { extra } } : undefined);
}
