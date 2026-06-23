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
let LobbyGateway = LobbyGateway_1 = class LobbyGateway {
    constructor(lobby) {
        this.lobby = lobby;
        this.logger = new common_1.Logger(LobbyGateway_1.name);
    }
    afterInit(server) {
        this.lobby.bindServer(server);
        this.logger.log('Socket.io gateway ready');
    }
    handleConnection(client) {
        this.logger.log(`connect ${client.id}`);
    }
    handleDisconnect(client) {
        this.logger.log(`disconnect ${client.id}`);
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
        if (body)
            this.lobby.relaySignal(client.id, body.signal);
    }
    onDrawDetected(client, _body) {
        this.lobby.drawDetected(client.id);
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
    (0, websockets_1.WebSocketGateway)({ cors: { origin: ORIGINS, methods: ['GET', 'POST'] } }),
    __metadata("design:paramtypes", [lobby_service_1.LobbyService])
], LobbyGateway);
//# sourceMappingURL=lobby.gateway.js.map