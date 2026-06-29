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
import { Namespace, Socket } from 'socket.io';
import {
  PuzzleFailedPayload,
  PuzzleSolvedPayload,
  WebrtcSignalPayload,
  WhisperEvents,
  WhisperJoinPayload,
  isValidRoomId,
  normalizeRoomId,
} from '@shadyexperiments/shared';
import { WhisperService } from './whisper.service';

const ORIGINS = process.env.WEB_ORIGIN
  ? process.env.WEB_ORIGIN.split(',').map((o) => o.trim())
  : true;

/** Same per-IP socket cap as Standoff. Set MAX_SOCKETS_PER_IP=0 to disable. */
const MAX_SOCKETS_PER_IP = process.env.MAX_SOCKETS_PER_IP
  ? Number(process.env.MAX_SOCKETS_PER_IP)
  : 100;

/** Per-socket event ceiling (sliding 1s window) so one socket can't flood. */
const EVENTS_PER_SECOND = 40;

/**
 * Socket.io gateway for Whispering Hacker, isolated on the `/whisper` namespace
 * so it shares the same port/server as Standoff without any state overlap.
 * Mirrors the abuse guards from `LobbyGateway`.
 */
@WebSocketGateway({
  namespace: '/whisper',
  cors: { origin: ORIGINS, methods: ['GET', 'POST'] },
  maxHttpBufferSize: 1e5,
})
export class WhisperGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(WhisperGateway.name);
  private readonly ipCounts = new Map<string, number>();
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  @WebSocketServer()
  server!: Namespace;

  constructor(private readonly whisper: WhisperService) {}

  afterInit(server: Namespace): void {
    this.whisper.bindServer(server);
    this.logger.log('Whisper namespace ready (/whisper)');
  }

  handleConnection(client: Socket): void {
    if (MAX_SOCKETS_PER_IP > 0) {
      const ip = this.clientIp(client);
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
    this.whisper.handleDisconnect(client.id);
  }

  @SubscribeMessage(WhisperEvents.RoomJoin)
  onJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: WhisperJoinPayload,
  ): void {
    if (!body || !isValidRoomId(body.roomId ?? '')) {
      client.emit(WhisperEvents.RoomError, {
        code: 'bad_request',
        message: 'Invalid room code.',
      });
      return;
    }
    const id = normalizeRoomId(body.roomId);
    client.join(id);
    // Durable seat key: fall back to the socket id for older clients (no resume).
    const sessionId =
      typeof body.sessionId === 'string' && body.sessionId.trim()
        ? body.sessionId.trim().slice(0, 64)
        : client.id;
    const err = this.whisper.join(id, (body.name ?? '').trim(), sessionId, client.id);
    if (err) {
      client.leave(id);
      client.emit(WhisperEvents.RoomError, err);
    }
  }

  @SubscribeMessage(WhisperEvents.RoomReady)
  onReady(@ConnectedSocket() client: Socket): void {
    this.whisper.ready(client.id);
  }

  @SubscribeMessage(WhisperEvents.RoomRematch)
  onRematch(@ConnectedSocket() client: Socket): void {
    this.whisper.rematch(client.id);
  }

  @SubscribeMessage(WhisperEvents.RoomNext)
  onNext(@ConnectedSocket() client: Socket): void {
    this.whisper.next(client.id);
  }

  @SubscribeMessage(WhisperEvents.RoomRetry)
  onRetry(@ConnectedSocket() client: Socket): void {
    this.whisper.retry(client.id);
  }

  @SubscribeMessage(WhisperEvents.WebrtcSignal)
  onSignal(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: WebrtcSignalPayload,
  ): void {
    if (!this.underRate(client.id)) return;
    if (body) this.whisper.relaySignal(client.id, body.signal);
  }

  @SubscribeMessage(WhisperEvents.PuzzleSolved)
  onSolved(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: PuzzleSolvedPayload,
  ): void {
    if (!this.underRate(client.id)) return;
    if (!body) return;
    const idx = Number.isInteger(body.index) ? body.index : -1;
    const seed = String(body.seed ?? '').slice(0, 120);
    if (idx < 0 || !seed) return;
    this.whisper.solved(client.id, idx, seed);
  }

  @SubscribeMessage(WhisperEvents.PuzzleFailed)
  onFailed(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: PuzzleFailedPayload,
  ): void {
    if (!this.underRate(client.id)) return;
    if (!body) return;
    const idx = Number.isInteger(body.index) ? body.index : -1;
    const seed = String(body.seed ?? '').slice(0, 120);
    if (idx < 0 || !seed) return;
    this.whisper.failed(client.id, idx, seed);
  }

  // --------------------------------------------------------------------------
  // Abuse guards (mirrors LobbyGateway)
  // --------------------------------------------------------------------------

  private clientIp(client: Socket): string {
    const xff = client.handshake.headers['x-forwarded-for'];
    const raw = Array.isArray(xff) ? xff[0] : xff;
    if (raw) return raw.split(',')[0].trim();
    return client.handshake.address;
  }

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
