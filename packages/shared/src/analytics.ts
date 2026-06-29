/**
 * Analytics events — "what users do on which app". Distinct from the Socket.io
 * `events.ts` (those are realtime lobby/game messages). Written to the Supabase
 * `events` table via the landing `POST /api/events` route handler.
 */

/** Which app/experiment an event belongs to. Add experiments here as you ship them. */
export type AnalyticsApp = 'landing' | 'standoff' | 'whisperinghacker';

/** Payload the browser sends to `POST /api/events` (one event, or an array). */
export interface TrackEventInput {
  /** Which app/experiment the event happened in. */
  app: AnalyticsApp;
  /** Event name, e.g. 'page_view', 'lobby_join', 'duel_completed'. */
  name: string;
  /** Anonymous visitor id (from landing `lib/subject`), stringified. */
  subjectId?: string;
  /** Per-tab session id. */
  sessionId?: string;
  /** Arbitrary structured payload. */
  props?: Record<string, unknown>;
  /** Pathname where it happened. */
  path?: string;
  /** document.referrer at send time. */
  referrer?: string;
}
