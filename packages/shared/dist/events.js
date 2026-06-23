"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketEvents = void 0;
/**
 * Canonical Socket.io event names. Import these everywhere instead of
 * hand-typing strings so the client and server can never drift.
 */
exports.SocketEvents = {
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
};
