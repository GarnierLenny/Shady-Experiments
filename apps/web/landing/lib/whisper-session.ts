// A durable per-browser id for a Whispering Hacker player, persisted in
// localStorage so a socket reconnect (or a page reload) can reclaim the same
// seat in a running room instead of being treated as a brand-new player.
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
    const stored = window.localStorage.getItem(KEY);
    if (stored) return stored;
    const id = fresh();
    window.localStorage.setItem(KEY, id);
    return id;
  } catch {
    // Private mode / storage blocked — still hand back a (per-mount) id.
    return fresh();
  }
}
