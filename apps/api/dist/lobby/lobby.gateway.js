"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var LobbyGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobbyGateway = void 0;
const common_1 = require("@nestjs/common");
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const shared_1 = require("@shadyexperiments/shared");
const lobby_service_1 = require("./lobby.service");
const ORIGINS = process.env.WEB_ORIGIN
    ? process.env.WEB_ORIGIN.split(',').map((o) => o.trim())
    : true;
/**
 * A single host opening an absurd number of sockets is the only realistic abuse
 * vector here. Cap it - but generously, and env-tunable: a viral mobile launch
 * puts many *legit* players behind one carrier CGNAT egress IP, so a tight cap
 * would lock real users out. Set MAX_SOCKETS_PER_IP=0 to disable entirely.
 */
const MAX_SOCKETS_PER_IP = process.env.MAX_SOCKETS_PER_IP
    ? Number(process.env.MAX_SOCKETS_PER_IP)
    : 100;
/**
 * Per-socket event ceiling (sliding 1s window) so one connection can't flood the
 * relay. Real play sends only a handful of messages per second (signaling uses
 * trickle:false, a draw fires once per round), so 40/s is generous headroom.
 */
const EVENTS_PER_SECOND = 40;
let LobbyGateway = LobbyGateway_1 = class LobbyGateway {
    constructor(lobby) {
        this.lobby = lobby;
        this.logger = new common_1.Logger(LobbyGateway_1.name);
        /** Live socket count per client IP, for the connection cap. */
        this.ipCounts = new Map();
        /** Sliding-window event counters per socket id, for the rate limit. */
        this.hits = new Map();
    }
    afterInit(server) {
        this.lobby.bindServer(server);
        this.logger.log('Socket.io gateway ready');
    }
    handleConnection(client) {
        if (MAX_SOCKETS_PER_IP > 0) {
            const ip = this.clientIp(client);
            // Count first, then check: a refused socket's disconnect event fires
            // handleDisconnect, which decrements it back - so the bookkeeping stays
            // symmetric without special-casing the refusal here.
            const n = (this.ipCounts.get(ip) ?? 0) + 1;
            this.ipCounts.set(ip, n);
            if (n > MAX_SOCKETS_PER_IP) {
                this.logger.warn(`ip ${ip} over socket cap (${MAX_SOCKETS_PER_IP}); refusing ${client.id}`);
                client.disconnect(true);
                return;
            }
        }
        this.logger.log(`connect ${client.id}`);
    }
    handleDisconnect(client) {
        this.logger.log(`disconnect ${client.id}`);
        if (MAX_SOCKETS_PER_IP > 0) {
            const ip = this.clientIp(client);
            const n = (this.ipCounts.get(ip) ?? 1) - 1;
            if (n <= 0)
                this.ipCounts.delete(ip);
            else
                this.ipCounts.set(ip, n);
        }
        this.hits.delete(client.id);
        this.lobby.handleDisconnect(client.id);
    }
    onJoin(client, body) {
        if (!body || !(0, shared_1.isValidLobbyId)(body.lobbyId ?? '')) {
            client.emit(shared_1.SocketEvents.LobbyError, {
                code: 'bad_request',
                message: 'Invalid lobby code.',
            });
            return;
        }
        const id = (0, shared_1.normalizeLobbyId)(body.lobbyId);
        client.join(id);
        const err = this.lobby.join(id, (body.name ?? '').trim(), client.id, body.bestOf);
        if (err) {
            client.leave(id);
            client.emit(shared_1.SocketEvents.LobbyError, err);
        }
    }
    onReady(client) {
        this.lobby.ready(client.id);
    }
    onRematch(client) {
        this.lobby.rematch(client.id);
    }
    onSignal(client, body) {
        if (!this.underRate(client.id))
            return;
        if (body)
            this.lobby.relaySignal(client.id, body.signal);
    }
    onDrawDetected(client, _body) {
        if (!this.underRate(client.id))
            return;
        this.lobby.drawDetected(client.id);
    }
    // --------------------------------------------------------------------------
    // Abuse guards
    // --------------------------------------------------------------------------
    /** Real client IP - X-Forwarded-For first, since we sit behind Railway's proxy. */
    clientIp(client) {
        const xff = client.handshake.headers['x-forwarded-for'];
        const raw = Array.isArray(xff) ? xff[0] : xff;
        if (raw)
            return raw.split(',')[0].trim();
        return client.handshake.address;
    }
    /** Sliding 1s window: true while the socket is under its per-second ceiling. */
    underRate(socketId) {
        const now = Date.now();
        const rec = this.hits.get(socketId);
        if (!rec || now >= rec.resetAt) {
            this.hits.set(socketId, { count: 1, resetAt: now + 1000 });
            return true;
        }
        if (rec.count >= EVENTS_PER_SECOND)
            return false;
        rec.count += 1;
        return true;
    }
};
exports.LobbyGateway = LobbyGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], LobbyGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)(shared_1.SocketEvents.LobbyJoin),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], LobbyGateway.prototype, "onJoin", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(shared_1.SocketEvents.LobbyReady),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], LobbyGateway.prototype, "onReady", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(shared_1.SocketEvents.LobbyRematch),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], LobbyGateway.prototype, "onRematch", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(shared_1.SocketEvents.WebrtcSignal),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], LobbyGateway.prototype, "onSignal", null);
__decorate([
    (0, websockets_1.SubscribeMessage)(shared_1.SocketEvents.GameDrawDetected),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], LobbyGateway.prototype, "onDrawDetected", null);
exports.LobbyGateway = LobbyGateway = LobbyGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: { origin: ORIGINS, methods: ['GET', 'POST'] },
        // Signals (SDP, trickle off) are a few KB at most; cap payloads so a single
        // socket can't push huge frames at the server.
        maxHttpBufferSize: 1e5,
    }),
    __metadata("design:paramtypes", [lobby_service_1.LobbyService])
], LobbyGateway);
//# sourceMappingURL=lobby.gateway.js.map