import type { WhisperPuzzleType, WhisperRole, WhisperStatus } from '@shadyexperiments/shared';

/** A player as the whisper server tracks them (session-bound, socket-rebindable). */
export interface ServerWhisperPlayer {
  /** Durable per-browser id — the stable seat key across reconnects. */
  sessionId: string;
  /** Current socket id; rebinds on every (re)join. */
  socketId: string;
  name: string;
  role: WhisperRole;
  ready: boolean;
  connected: boolean;
  /** Set while disconnected mid-run; evicts the seat if they don't return in time. */
  graceTimer: ReturnType<typeof setTimeout> | null;
}

/** One puzzle tab of the current level (server-internal). */
export interface ServerPuzzleSlot {
  index: number;
  type: WhisperPuzzleType;
  name: string;
  title: string;
  seed: string;
  solved: boolean;
  /** Epoch ms when this tab reseeds if still unsolved; null once solved. */
  deadline: number | null;
}

/** A co-op room as the whisper server tracks it. */
export interface ServerWhisperRoom {
  id: string;
  /** Join order is significant: players[0] = hacker + WebRTC initiator. */
  players: ServerWhisperPlayer[];
  status: WhisperStatus;
  /** Current level (1-based). */
  level: number;
  /** The current level's puzzle tabs. */
  puzzles: ServerPuzzleSlot[];
  /** Server time the run started (for the elapsed timer), or null. */
  startedAt: number | null;
  /** Puzzles solved across all levels so far (for the result record). */
  solvedTotal: number;
  /** Epoch ms the level countdown hits zero (then the level fails); null when paused. */
  levelDeadline: number | null;
  /** Frozen countdown remainder (ms) while a player is disconnected mid-run; null when running. */
  frozenRemainingMs: number | null;
  /** Wrong answers made on the current level. */
  strikes: number;
  /** If status is 'failed', why; null otherwise. */
  levelFailReason: 'timeout' | 'strikes' | null;
  /** Epoch ms of the last re-handshake broadcast (throttles voice re-negotiation). */
  lastRehandshakeAt: number;
}
