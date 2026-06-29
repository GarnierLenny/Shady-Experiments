/**
 * Whispering Hacker — realtime wire contract between the NestJS server and the
 * Next client. Two players cooperate by voice (which degrades by level): the
 * HACKER (P1) drives an interactive console, the OPERATOR (P2) reads a manual.
 *
 * The server is the source of truth for rooms, roles, levels, per-puzzle timers
 * and progression — but NOT for puzzle correctness. Each puzzle slot carries a
 * `seed`; both clients deterministically build the same instance from it (see
 * `whisper-content.ts`). The hacker's client validates locally and emits
 * `PuzzleSolved`; the server trusts it (co-op). Puzzle content lives in
 * `whisper-content.ts`; WebRTC payloads are reused from `events.ts`.
 */
import type { WebrtcInitPayload, WebrtcSignalPayload } from './events';
import type { WhisperPuzzleType } from './whisper-content';

export type { WebrtcInitPayload, WebrtcSignalPayload };

/** Who you are. Assigned by join order: room creator = hacker, 2nd = operator. */
export type WhisperRole = 'hacker' | 'operator';

/** Lifecycle of a single room. */
export type WhisperStatus =
  | 'waiting' // fewer than 2 players, or not everyone ready
  | 'ready' // 2 players, both ready - about to start
  | 'playing' // run in progress
  | 'complete'; // all levels cleared

/** A player as exposed to clients (no socket internals). */
export interface PublicWhisperPlayer {
  id: string;
  name: string;
  role: WhisperRole;
  ready: boolean;
  connected: boolean;
}

/**
 * One puzzle tab in the current level. The `seed` deterministically generates
 * the instance on both clients; when a tab times out unsolved the server bumps
 * the `seed` (and `deadline`) so it reseeds with a fresh instance.
 */
export interface PuzzleSlot {
  index: number;
  type: WhisperPuzzleType;
  name: string;
  title: string;
  seed: string;
  solved: boolean;
  /** Epoch ms when this tab reseeds if still unsolved; null once solved. */
  deadline: number | null;
}

/**
 * Canonical Socket.io event names for the `/whisper` namespace. Distinct strings
 * from Standoff's `SocketEvents` even though they share the same gateway server.
 */
export const WhisperEvents = {
  // client -> server
  RoomJoin: 'wh:join',
  RoomReady: 'wh:ready',
  RoomRematch: 'wh:rematch',
  WebrtcSignal: 'wh:webrtc:signal',
  PuzzleSolved: 'wh:solved',
  // server -> client
  RoomState: 'wh:state',
  RoomError: 'wh:error',
  WebrtcInit: 'wh:webrtc:init',
  GameComplete: 'wh:complete',
} as const;

// ---- client -> server payloads ----

export interface WhisperJoinPayload {
  roomId: string;
  name: string;
}

export interface PuzzleSolvedPayload {
  /** Which tab the hacker solved. */
  index: number;
  /** The seed that was solved — lets the server ignore a stale post-reseed solve. */
  seed: string;
}

// ---- server -> client payloads ----

export interface WhisperStatePayload {
  roomId: string;
  status: WhisperStatus;
  players: PublicWhisperPlayer[];
  /** The recipient's own socket id, so the client can tell "me" from "them". */
  selfId: string;
  /** The recipient's role (convenience; also derivable from `players`). */
  selfRole: WhisperRole | null;
  full: boolean;
  /** Current level (1-based); drives audio degradation + accent color. */
  level: number;
  totalLevels: number;
  /** The current level's puzzle tabs (with seeds/solved/deadlines). */
  puzzles: PuzzleSlot[];
  /** Server epoch ms when play started (for the run timer); null until playing. */
  startedAt: number | null;
}

export interface WhisperErrorPayload {
  code: 'room_full' | 'in_progress' | 'not_found' | 'bad_request';
  message: string;
}

export interface WhisperCompletePayload {
  /** Basis for the shareable /whispering-hacker/r/<id> permalink. */
  resultId: string;
  elapsedMs: number;
  puzzlesSolved: number;
}

/**
 * A persisted, shareable run outcome - no socket ids. Stored server-side and
 * rendered on the permalink + its OG card (mirrors `DuelResultRecord`).
 */
export interface WhisperResultRecord {
  id: string;
  hackerName: string | null;
  operatorName: string | null;
  elapsedMs: number;
  puzzlesSolved: number;
  /** Epoch ms the run completed. */
  createdAt: number;
}

/** Typed event maps for `socket.io` generics on both ends. */
export interface WhisperServerToClientEvents {
  [WhisperEvents.RoomState]: (p: WhisperStatePayload) => void;
  [WhisperEvents.RoomError]: (p: WhisperErrorPayload) => void;
  [WhisperEvents.WebrtcInit]: (p: WebrtcInitPayload) => void;
  [WhisperEvents.WebrtcSignal]: (p: WebrtcSignalPayload) => void;
  [WhisperEvents.GameComplete]: (p: WhisperCompletePayload) => void;
}

export interface WhisperClientToServerEvents {
  [WhisperEvents.RoomJoin]: (p: WhisperJoinPayload) => void;
  [WhisperEvents.RoomReady]: () => void;
  [WhisperEvents.RoomRematch]: () => void;
  [WhisperEvents.WebrtcSignal]: (p: WebrtcSignalPayload) => void;
  [WhisperEvents.PuzzleSolved]: (p: PuzzleSolvedPayload) => void;
}
