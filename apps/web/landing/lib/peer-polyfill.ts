/**
 * simple-peer (via readable-stream) reaches for Node globals that don't exist
 * in the browser. Importing this module *before* simple-peer guarantees they're
 * present, independent of the bundler's own polyfilling.
 */
import { Buffer } from 'buffer';

if (typeof window !== 'undefined') {
  const w = window as unknown as Record<string, unknown>;
  if (!w.global) w.global = window;
  if (!w.Buffer) w.Buffer = Buffer;
  if (!w.process) w.process = { env: {}, nextTick: (cb: () => void) => setTimeout(cb, 0) };
}

export {};
