/**
 * Lightweight Sentry client — no SDK dependency.
 * Uses Sentry's store HTTP API to capture exceptions.
 * Set VITE_SENTRY_DSN to enable; fully no-op if unset.
 *
 * DSN format: https://<key>@<host>/<project_id>
 */

interface SentryConfig {
  endpoint: string;
  key: string;
}

let config: SentryConfig | null = null;

export function initSentry(dsn: string) {
  try {
    const url = new URL(dsn);
    const key = url.username;
    const host = url.hostname;
    const projectId = url.pathname.replace('/', '');
    config = {
      endpoint: `https://${host}/api/${projectId}/store/`,
      key,
    };
  } catch {
    // invalid DSN — stay no-op
  }
}

export function captureException(error: Error, extra?: Record<string, unknown>) {
  if (!config) return;

  const eventId = crypto.randomUUID().replace(/-/g, '');
  const frames = parseStack(error.stack || '');

  const payload = {
    event_id: eventId,
    timestamp: new Date().toISOString(),
    platform: 'javascript',
    environment: import.meta.env.MODE,
    exception: {
      values: [
        {
          type: error.name || 'Error',
          value: error.message,
          stacktrace: frames.length ? { frames } : undefined,
        },
      ],
    },
    extra,
    request: {
      url: window.location.href,
      headers: { 'User-Agent': navigator.userAgent },
    },
  };

  // Fire-and-forget — never block the UI
  fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=ratchet/1.0, sentry_key=${config.key}`,
    },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => { /* non-critical */ });
}

function parseStack(stack: string) {
  return stack
    .split('\n')
    .slice(1)
    .map(line => {
      const m = line.trim().match(/^at (.+?) \((.+):(\d+):(\d+)\)$/) ||
                line.trim().match(/^at ()(.+):(\d+):(\d+)$/);
      if (!m) return null;
      return {
        function: m[1] || '<anonymous>',
        filename: m[2],
        lineno: parseInt(m[3], 10),
        colno: parseInt(m[4], 10),
        in_app: !m[2]?.includes('node_modules'),
      };
    })
    .filter(Boolean)
    .reverse();
}
