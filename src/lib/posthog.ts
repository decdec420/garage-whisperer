/**
 * Lightweight Posthog client — no SDK dependency.
 * Uses Posthog's /capture/ HTTP API.
 * Set VITE_POSTHOG_KEY to enable; fully no-op if unset.
 */

interface PosthogConfig {
  key: string;
  host: string;
}

let cfg: PosthogConfig | null = null;
let distinctId: string = getOrCreateDistinctId();

function getOrCreateDistinctId(): string {
  const stored = localStorage.getItem('ph_distinct_id');
  if (stored) return stored;
  const id = crypto.randomUUID();
  localStorage.setItem('ph_distinct_id', id);
  return id;
}

export function initPosthog(key: string, host = 'https://us.i.posthog.com') {
  cfg = { key, host: host.replace(/\/$/, '') };
}

export function identify(userId: string, properties?: Record<string, unknown>) {
  if (!cfg) return;
  distinctId = userId;
  capture('$identify', { $anon_distinct_id: getOrCreateDistinctId(), ...properties });
}

export function capture(event: string, properties?: Record<string, unknown>) {
  if (!cfg) return;
  fetch(`${cfg.host}/capture/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: cfg.key,
      event,
      distinct_id: distinctId,
      timestamp: new Date().toISOString(),
      properties: {
        $current_url: window.location.href,
        $pathname: window.location.pathname,
        $referrer: document.referrer,
        $screen_width: screen.width,
        $screen_height: screen.height,
        ...properties,
      },
    }),
    keepalive: true,
  }).catch(() => { /* non-critical */ });
}
