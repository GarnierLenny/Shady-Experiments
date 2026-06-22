import type { LobbyStatus } from '@standoffduel/shared';

/** A player as the server tracks them (socket-bound, with per-duel state). */
export interface ServerPlayer {
  socketId: string;
  name: string;
  ready: boolean;
  connected: boolean;
  /** Server-stamped time the player's draw was received this round, or null. */
  drawAt: number | null;
  /** True if the player drew before the signal fired. */
  falseStart: boolean;
}

/** A lobby as the server tracks it. */
export interface ServerLobby {
  id: string;
  /** Join order is significant: players[0] is the WebRTC initiator. */
  players: ServerPlayer[];
  status: LobbyStatus;
  /** Server time the draw signal fired this round - the fairness reference. */
  drawSignalAt: number | null;
  /** Pending setTimeout handles (countdown, draw window) to clear on teardown. */
  timers: NodeJS.Timeout[];
  /** Match length: 1 = single duel, 3 = best-of-three. */
  bestOf: number;
  /** Round wins this match, keyed by socketId. */
  scores: Record<string, number>;
  /** True when a round just ended but the match is still going. */
  pendingNextRound: boolean;
}
