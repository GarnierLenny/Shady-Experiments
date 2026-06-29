// A durable per-tab id for a Whispering Hacker player, persisted in
// sessionStorage so a socket reconnect (or a same-tab reload) reclaims the same
// seat in a running room. Per-tab (NOT localStorage) so two tabs of one browser
// don't share an id and hijack each other's seat.
const KEY = 'wh.session';

function fresh(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function clientSessionId(): string {
  if (typeof window === 'undefined') return fresh();
  try {
    const stored = window.sessionStorage.getItem(KEY);
    if (stored) return stored;
    const id = fresh();
    window.sessionStorage.setItem(KEY, id);
    return id;
  } catch {
    // Private mode / storage blocked — still hand back a (per-mount) id.
    return fresh();
  }
}
