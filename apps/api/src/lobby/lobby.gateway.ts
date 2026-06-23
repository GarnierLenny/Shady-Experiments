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
} from '@shadyexperiments/shared';
import { LobbyService } from './lobby.service';

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

@WebSocketGateway({
  cors: { origin: ORIGINS, methods: ['GET', 'POST'] },
  // Signals (SDP, trickle off) are a few KB at most; cap payloads so a single
  // socket can't push huge frames at the server.
  maxHttpBufferSize: 1e5,
})
export class LobbyGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(LobbyGateway.name);

  /** Live socket count per client IP, for the connection cap. */
  private readonly ipCounts = new Map<string, number>();

  /** Sliding-window event counters per socket id, for the rate limit. */
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  @WebSocketServer()
  server!: Server;

  constructor(private readonly lobby: LobbyService) {}

  afterInit(server: Server): void {
    this.lobby.bindServer(server);
    this.logger.log('Socket.io gateway ready');
  }

  handleConnection(client: Socket): void {
    if (MAX_SOCKETS_PER_IP > 0) {
      const ip = this.clientIp(client);
      // Count first, then check: a refused socket's disconnect event fires
      // handleDisconnect, which decrements it back - so the bookkeeping stays
      // symmetric without special-casing the refusal here.
      const n = (this.ipCounts.get(ip) ?? 0) + 1;
      this.ipCounts.set(ip, n);
      if (n > MAX_SOCKETS_PER_IP) {
        this.logger.warn(
          `ip ${ip} over socket cap (${MAX_SOCKETS_PER_IP}); refusing ${client.id}`,
        );
        client.disconnect(true);
        return;
      }
    }
    this.logger.log(`connect ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`disconnect ${client.id}`);
    if (MAX_SOCKETS_PER_IP > 0) {
      const ip = this.clientIp(client);
      const n = (this.ipCounts.get(ip) ?? 1) - 1;
      if (n <= 0) this.ipCounts.delete(ip);
      else this.ipCounts.set(ip, n);
    }
    this.hits.delete(client.id);
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
    if (!this.underRate(client.id)) return;
    if (body) this.lobby.relaySignal(client.id, body.signal);
  }

  @SubscribeMessage(SocketEvents.GameDrawDetected)
  onDrawDetected(
    @ConnectedSocket() client: Socket,
    @MessageBody() _body: GameDrawDetectedPayload,
  ): void {
    if (!this.underRate(client.id)) return;
    this.lobby.drawDetected(client.id);
  }

  // --------------------------------------------------------------------------
  // Abuse guards
  // --------------------------------------------------------------------------

  /** Real client IP - X-Forwarded-For first, since we sit behind Railway's proxy. */
  private clientIp(client: Socket): string {
    const xff = client.handshake.headers['x-forwarded-for'];
    const raw = Array.isArray(xff) ? xff[0] : xff;
    if (raw) return raw.split(',')[0].trim();
    return client.handshake.address;
  }

  /** Sliding 1s window: true while the socket is under its per-second ceiling. */
  private underRate(socketId: string): boolean {
    const now = Date.now();
    const rec = this.hits.get(socketId);
    if (!rec || now >= rec.resetAt) {
      this.hits.set(socketId, { count: 1, resetAt: now + 1000 });
      return true;
    }
    if (rec.count >= EVENTS_PER_SECOND) return false;
    rec.count += 1;
    return true;
  }
}
