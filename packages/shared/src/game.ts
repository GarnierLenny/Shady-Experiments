/**
 * Core game domain shared between the NestJS server and the Next.js client.
 * The server is the single source of truth for status transitions and timing.
 */

/** Lifecycle of a single lobby / duel. */
export type LobbyStatus =
  | 'waiting' // fewer than 2 players, or not everyone ready
  | 'ready' // 2 players, both ready - about to start
  | 'countdown' // cinematic sequence playing (zoom -> dezoom -> wait)
  | 'draw' // the signal has fired, detection is armed
  | 'finished'; // a winner (or tie) has been decided

/** A player as exposed to clients (no socket internals, no secrets). */
export interface PublicPlayer {
  id: string;
  name: string;
  ready: boolean;
  connected: boolean;
}

/** Why a duel ended - drives the copy on the result screen. */
export type DuelEndReason =
  | 'draw' // a clean draw was detected
  | 'false_start' // someone drew before the signal
  | 'timeout' // nobody drew within the window
  | 'opponent_left'; // the other player disconnected

/** Final outcome of a duel. `reactions` maps playerId -> reaction in ms. */
export interface DuelResult {
  winnerId: string | null;
  winnerName: string | null;
  loserId: string | null;
  reactionMs: number | null;
  reason: DuelEndReason;
  reactions: Record<string, ReactionOutcome>;
  /** Set once persisted server-side; basis for the /r/<id> share permalink. */
  resultId?: string;
  /** Match length (1 = single duel, 3 = best-of-three). Defaults to 1. */
  bestOf?: number;
  /** Round wins so far this match, keyed by player id. */
  scores?: Record<string, number>;
  /** False when this was a round in an ongoing match (play the next one). */
  matchOver?: boolean;
}

/**
 * A persisted, shareable duel outcome - no socket ids, no photos. Stored
 * server-side and rendered on the /r/<id> permalink + its OG card.
 */
export interface DuelResultRecord {
  id: string;
  winnerName: string | null;
  loserName: string | null;
  reactionMs: number | null;
  reason: DuelEndReason;
  isTie: boolean;
  /** Epoch ms the duel resolved. */
  createdAt: number;
}

/** Per-player reaction detail. `ms` is null when the player never drew. */
export interface ReactionOutcome {
  ms: number | null;
  falseStart: boolean;
}

/**
 * Timings (ms) for the cinematic sequence and the draw window.
 * The random portion of the wait is decided server-side per duel.
 */
export const DUEL_TIMINGS = {
  /** Phase 1 - push in on the eyes. */
  ZOOM_MS: 3500,
  /** Phase 2 - pull back to full frame, silence. */
  DEZOOM_MS: 2500,
  /** Phase 3 - random wait before the signal, lower bound (after dezoom). */
  DRAW_MIN_MS: 3000,
  /** Phase 3 - random wait before the signal, upper bound. */
  DRAW_MAX_MS: 8000,
  /** Phase 4 - how long detection stays armed before a timeout. */
  DRAW_WINDOW_MS: 6000,
} as const;

export const MAX_PLAYERS_PER_LOBBY = 2;

/** Inclusive random integer in [min, max]. */
export function randomDelayMs(
  min: number = DUEL_TIMINGS.DRAW_MIN_MS,
  max: number = DUEL_TIMINGS.DRAW_MAX_MS,
): number {
  return Math.floor(min + Math.random() * (max - min));
}
