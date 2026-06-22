import type { DuelResult, LobbyStatus, PublicPlayer } from './game';

/**
 * Canonical Socket.io event names. Import these everywhere instead of
 * hand-typing strings so the client and server can never drift.
 */
export const SocketEvents = {
  // client -> server
  LobbyJoin: 'lobby:join',
  LobbyReady: 'lobby:ready',
  LobbyRematch: 'lobby:rematch',
  WebrtcSignal: 'webrtc:signal',
  GameDrawDetected: 'game:draw_detected',
  // server -> client
  LobbyState: 'lobby:state',
  LobbyError: 'lobby:error',
  WebrtcInit: 'webrtc:init',
  GameStart: 'game:start',
  GameDraw: 'game:draw',
  GameResult: 'game:result',
} as const;

// ---- client -> server payloads ----

export interface LobbyJoinPayload {
  lobbyId: string;
  name: string;
  /** Desired match length; only honored when this join *creates* the lobby. */
  bestOf?: number;
}

export interface WebrtcSignalPayload {
  /** Opaque `simple-peer` signal data, relayed verbatim to the other peer. */
  signal: unknown;
}

export interface GameDrawDetectedPayload {
  /** Client clock at the moment of detection (diagnostics only; server stamps the truth). */
  clientAt: number;
}

// ---- server -> client payloads ----

export interface LobbyStatePayload {
  lobbyId: string;
  status: LobbyStatus;
  players: PublicPlayer[];
  /** The recipient's own socket id, so the client can tell "me" from "them". */
  selfId: string;
  full: boolean;
  /** Match length for this lobby (1 or 3). */
  bestOf: number;
  /** Round wins so far this match, keyed by player id. */
  scores: Record<string, number>;
}

export interface LobbyErrorPayload {
  code: 'lobby_full' | 'in_progress' | 'not_found' | 'bad_request';
  message: string;
}

export interface WebrtcInitPayload {
  /** Exactly one peer initiates to avoid WebRTC "glare". */
  initiator: boolean;
}

export interface GameStartPayload {
  /** Server timestamp marking the start of the cinematic. */
  startAt: number;
  zoomMs: number;
  dezoomMs: number;
}

export interface GameDrawPayload {
  /** Server timestamp when the signal fired - the fairness reference point. */
  at: number;
  windowMs: number;
}

export type GameResultPayload = DuelResult;

/** Typed event maps for `socket.io` generics on both ends. */
export interface ServerToClientEvents {
  [SocketEvents.LobbyState]: (p: LobbyStatePayload) => void;
  [SocketEvents.LobbyError]: (p: LobbyErrorPayload) => void;
  [SocketEvents.WebrtcInit]: (p: WebrtcInitPayload) => void;
  [SocketEvents.WebrtcSignal]: (p: WebrtcSignalPayload) => void;
  [SocketEvents.GameStart]: (p: GameStartPayload) => void;
  [SocketEvents.GameDraw]: (p: GameDrawPayload) => void;
  [SocketEvents.GameResult]: (p: GameResultPayload) => void;
}

export interface ClientToServerEvents {
  [SocketEvents.LobbyJoin]: (p: LobbyJoinPayload) => void;
  [SocketEvents.LobbyReady]: () => void;
  [SocketEvents.LobbyRematch]: () => void;
  [SocketEvents.WebrtcSignal]: (p: WebrtcSignalPayload) => void;
  [SocketEvents.GameDrawDetected]: (p: GameDrawDetectedPayload) => void;
}
