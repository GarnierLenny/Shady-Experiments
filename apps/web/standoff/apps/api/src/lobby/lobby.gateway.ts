import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  GameDrawDetectedPayload,
  LobbyJoinPayload,
  SocketEvents,
  WebrtcSignalPayload,
  isValidLobbyId,
  normalizeLobbyId,
} from '@standoffduel/shared';
import { LobbyService } from './lobby.service';

const ORIGINS = process.env.WEB_ORIGIN
  ? process.env.WEB_ORIGIN.split(',').map((o) => o.trim())
  : true;

@WebSocketGateway({ cors: { origin: ORIGINS, methods: ['GET', 'POST'] } })
export class LobbyGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(LobbyGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly lobby: LobbyService) {}

  afterInit(server: Server): void {
    this.lobby.bindServer(server);
    this.logger.log('Socket.io gateway ready');
  }

  handleConnection(client: Socket): void {
    this.logger.log(`connect ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`disconnect ${client.id}`);
    this.lobby.handleDisconnect(client.id);
  }

  @SubscribeMessage(SocketEvents.LobbyJoin)
  onJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: LobbyJoinPayload,
  ): void {
    if (!body || !isValidLobbyId(body.lobbyId ?? '')) {
      client.emit(SocketEvents.LobbyError, {
        code: 'bad_request',
        message: 'Invalid lobby code.',
      });
      return;
    }
    const id = normalizeLobbyId(body.lobbyId);
    client.join(id);
    const err = this.lobby.join(
      id,
      (body.name ?? '').trim(),
      client.id,
      body.bestOf,
    );
    if (err) {
      client.leave(id);
      client.emit(SocketEvents.LobbyError, err);
    }
  }

  @SubscribeMessage(SocketEvents.LobbyReady)
  onReady(@ConnectedSocket() client: Socket): void {
    this.lobby.ready(client.id);
  }

  @SubscribeMessage(SocketEvents.LobbyRematch)
  onRematch(@ConnectedSocket() client: Socket): void {
    this.lobby.rematch(client.id);
  }

  @SubscribeMessage(SocketEvents.WebrtcSignal)
  onSignal(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: WebrtcSignalPayload,
  ): void {
    if (body) this.lobby.relaySignal(client.id, body.signal);
  }

  @SubscribeMessage(SocketEvents.GameDrawDetected)
  onDrawDetected(
    @ConnectedSocket() client: Socket,
    @MessageBody() _body: GameDrawDetectedPayload,
  ): void {
    this.lobby.drawDetected(client.id);
  }
}
