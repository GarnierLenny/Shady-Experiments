import { Injectable, Logger } from '@nestjs/common';
import type { Namespace } from 'socket.io';
import {
  LEVEL_PUZZLES,
  PublicWhisperPlayer,
  PuzzleSlot,
  TOTAL_LEVELS,
  WhisperCompletePayload,
  WhisperErrorPayload,
  WhisperEvents,
  WhisperResultRecord,
  WhisperRole,
  WhisperStatePayload,
  WhisperStatus,
  generateResultId,
  puzzleDuration,
} from '@shadyexperiments/shared';
import { ServerPuzzleSlot, ServerWhisperRoom } from './whisper.types';
import { WhisperResultsStore } from './whisper-results.store';

const MAX_PLAYERS = 2;
/** How often the reseed timer sweeps active rooms. */
const TICK_MS = 1000;

/**
 * Owns all whisper room state and progression. The server is the source of truth
 * for rooms, roles, levels, per-puzzle reseed timers and advancement — but not
 * for puzzle correctness: each tab carries a `seed` both clients build the same
 * instance from, and the hacker's client reports `PuzzleSolved` (co-op, trusted).
 */
@Injectable()
export class WhisperService {
  private readonly logger = new Logger(WhisperService.name);
  private readonly rooms = new Map<string, ServerWhisperRoom>();
  /** The `/whisper` namespace, bound from the gateway's afterInit. */
  private server!: Namespace;
  private ticker: NodeJS.Timeout | null = null;

  constructor(private readonly results: WhisperResultsStore) {}

  bindServer(server: Namespace): void {
    this.server = server;
  }

  // --------------------------------------------------------------------------
  // Joining / leaving
  // --------------------------------------------------------------------------

  join(
    roomId: string,
    name: string,
    socketId: string,
  ): WhisperErrorPayload | null {
    let room = this.rooms.get(roomId);
    const existing = room?.players.find((p) => p.socketId === socketId);

    if (room && !existing) {
      if (room.players.length >= MAX_PLAYERS) {
        return {
          code: 'room_full',
          message: 'This room already has a hacker and an operator.',
        };
      }
      if (room.status === 'playing') {
        return {
          code: 'in_progress',
          message: 'A run is already underway in this room.',
        };
      }
    }

    if (!room) {
      room = {
        id: roomId,
        players: [],
        status: 'waiting',
        level: 1,
        puzzles: [],
        startedAt: null,
        solvedTotal: 0,
      };
      this.rooms.set(roomId, room);
    }

    const safeName = (name || '').slice(0, 24) || 'Anonymous';
    if (existing) {
      existing.connected = true;
      if (name) existing.name = safeName;
    } else {
      // First in is the hacker (and WebRTC initiator); second is the operator.
      const role: WhisperRole =
        room.players.length === 0 ? 'hacker' : 'operator';
      room.players.push({
        socketId,
        name: safeName,
        role,
        ready: false,
        connected: true,
      });
    }

    this.recomputeStatus(room);
    this.broadcastState(room);

    // When the second player arrives, assign WebRTC roles exactly once.
    if (!existing && room.players.length === MAX_PLAYERS) {
      this.server
        .to(room.players[0].socketId)
        .emit(WhisperEvents.WebrtcInit, { initiator: true });
      this.server
        .to(room.players[1].socketId)
        .emit(WhisperEvents.WebrtcInit, { initiator: false });
    }

    this.logger.log(`join ${socketId} -> ${roomId} (${room.players.length}/2)`);
    return null;
  }

  handleDisconnect(socketId: string): void {
    const room = this.findRoomBySocket(socketId);
    if (!room) return;

    room.players = room.players.filter((p) => p.socketId !== socketId);
    if (room.players.length === 0) {
      this.rooms.delete(room.id);
      return;
    }

    // Co-op: a partner leaving voids the run. Drop back to the waiting room and
    // re-seat roles by order so the survivor becomes the hacker if needed.
    this.resetToLobby(room);
    room.players.forEach((p, i) => {
      p.role = i === 0 ? 'hacker' : 'operator';
      p.ready = false;
    });
    this.broadcastState(room);
  }

  // --------------------------------------------------------------------------
  // Ready / rematch
  // --------------------------------------------------------------------------

  ready(socketId: string): void {
    const room = this.findRoomBySocket(socketId);
    if (!room || room.status === 'playing') return;
    const player = room.players.find((p) => p.socketId === socketId);
    if (!player) return;

    player.ready = true;
    const status = this.recomputeStatus(room);
    if (status === 'ready') this.startRun(room);
    else this.broadcastState(room);
  }

  rematch(socketId: string): void {
    const room = this.findRoomBySocket(socketId);
    if (!room || room.status !== 'complete') return;
    this.resetToLobby(room);
    for (const p of room.players) p.ready = false;
    this.broadcastState(room);
  }

  private resetToLobby(room: ServerWhisperRoom): void {
    room.status = 'waiting';
    room.level = 1;
    room.puzzles = [];
    room.startedAt = null;
    room.solvedTotal = 0;
  }

  private startRun(room: ServerWhisperRoom): void {
    room.status = 'playing';
    room.level = 1;
    room.startedAt = Date.now();
    room.solvedTotal = 0;
    this.buildLevel(room, 1);
    this.ensureTicker();
    this.broadcastState(room);
    this.logger.log(`run started ${room.id}`);
  }

  /** Lay out a level's puzzle tabs with fresh seeds + countdown deadlines. */
  private buildLevel(room: ServerWhisperRoom, level: number): void {
    const defs = LEVEL_PUZZLES[level] ?? [];
    const now = Date.now();
    room.puzzles = defs.map((d, i) => ({
      index: i,
      type: d.type,
      name: d.name,
      title: d.title,
      seed: this.newSeed(room.id, level, i),
      solved: false,
      deadline: now + puzzleDuration(d.type) * 1000,
    }));
  }

  private newSeed(roomId: string, level: number, index: number): string {
    return `${roomId}:${level}:${index}:${Date.now().toString(36)}:${Math.floor(
      Math.random() * 1e9,
    ).toString(36)}`;
  }

  // --------------------------------------------------------------------------
  // Solving + progression
  // --------------------------------------------------------------------------

  /** The hacker's client reports a tab solved. Trusted (co-op). */
  solved(socketId: string, index: number, seed: string): void {
    const room = this.findRoomBySocket(socketId);
    if (!room || room.status !== 'playing') return;
    const player = room.players.find((p) => p.socketId === socketId);
    if (!player || player.role !== 'hacker') return; // only the hacker solves

    const slot = room.puzzles[index];
    if (!slot || slot.solved) return;
    // Ignore a solve that raced a reseed: it was for an instance that's gone.
    if (slot.seed !== seed) return;

    slot.solved = true;
    slot.deadline = null;
    room.solvedTotal += 1;

    if (room.puzzles.every((p) => p.solved)) {
      this.advanceLevel(room);
    } else {
      this.broadcastState(room);
    }
  }

  private advanceLevel(room: ServerWhisperRoom): void {
    if (room.level >= TOTAL_LEVELS) {
      this.complete(room);
      return;
    }
    room.level += 1;
    this.buildLevel(room, room.level);
    this.broadcastState(room);
    this.logger.log(`level ${room.level} ${room.id}`);
  }

  private complete(room: ServerWhisperRoom): void {
    room.status = 'complete';
    room.puzzles = [];
    const elapsedMs = room.startedAt ? Date.now() - room.startedAt : 0;
    const hacker = room.players.find((p) => p.role === 'hacker') ?? null;
    const operator = room.players.find((p) => p.role === 'operator') ?? null;

    const id = generateResultId();
    const record: WhisperResultRecord = {
      id,
      hackerName: hacker?.name ?? null,
      operatorName: operator?.name ?? null,
      elapsedMs,
      puzzlesSolved: room.solvedTotal,
      createdAt: Date.now(),
    };
    // Fire-and-forget: a storage hiccup must never block the players' result.
    void this.results.save(record);

    const payload: WhisperCompletePayload = {
      resultId: id,
      elapsedMs,
      puzzlesSolved: room.solvedTotal,
    };
    this.server.to(room.id).emit(WhisperEvents.GameComplete, payload);
    this.broadcastState(room);
    this.logger.log(`complete ${room.id} in ${elapsedMs}ms -> ${id}`);
  }

  // --------------------------------------------------------------------------
  // Reseed timer
  // --------------------------------------------------------------------------

  private ensureTicker(): void {
    if (this.ticker) return;
    this.ticker = setInterval(() => this.tick(), TICK_MS);
    // Don't keep the process alive just for the sweep.
    if (typeof this.ticker.unref === 'function') this.ticker.unref();
  }

  private tick(): void {
    const now = Date.now();
    let anyPlaying = false;
    for (const room of this.rooms.values()) {
      if (room.status !== 'playing') continue;
      anyPlaying = true;
      let changed = false;
      for (const slot of room.puzzles) {
        if (!slot.solved && slot.deadline !== null && now >= slot.deadline) {
          slot.seed = this.newSeed(room.id, room.level, slot.index);
          slot.deadline = now + puzzleDuration(slot.type) * 1000;
          changed = true;
        }
      }
      if (changed) this.broadcastState(room);
    }
    if (!anyPlaying && this.ticker) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  }

  // --------------------------------------------------------------------------
  // WebRTC signaling relay
  // --------------------------------------------------------------------------

  relaySignal(socketId: string, signal: unknown): void {
    const room = this.findRoomBySocket(socketId);
    if (!room) return;
    const other = room.players.find((p) => p.socketId !== socketId);
    if (other) {
      this.server
        .to(other.socketId)
        .emit(WhisperEvents.WebrtcSignal, { signal });
    }
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private findRoomBySocket(socketId: string): ServerWhisperRoom | undefined {
    for (const room of this.rooms.values()) {
      if (room.players.some((p) => p.socketId === socketId)) return room;
    }
    return undefined;
  }

  private recomputeStatus(room: ServerWhisperRoom): WhisperStatus {
    if (room.status === 'playing' || room.status === 'complete') {
      return room.status; // driven explicitly
    }
    const everyoneReady =
      room.players.length === MAX_PLAYERS &&
      room.players.every((p) => p.ready && p.connected);
    room.status = everyoneReady ? 'ready' : 'waiting';
    return room.status;
  }

  private publicPuzzles(room: ServerWhisperRoom): PuzzleSlot[] {
    return room.puzzles.map((p) => ({
      index: p.index,
      type: p.type,
      name: p.name,
      title: p.title,
      seed: p.seed,
      solved: p.solved,
      deadline: p.deadline,
    }));
  }

  private broadcastState(room: ServerWhisperRoom): void {
    const players: PublicWhisperPlayer[] = room.players.map((p) => ({
      id: p.socketId,
      name: p.name,
      role: p.role,
      ready: p.ready,
      connected: p.connected,
    }));
    const full = room.players.length >= MAX_PLAYERS;
    const puzzles = this.publicPuzzles(room);

    // selfId/selfRole differ per recipient, so emit individually.
    for (const p of room.players) {
      const payload: WhisperStatePayload = {
        roomId: room.id,
        status: room.status,
        players,
        selfId: p.socketId,
        selfRole: p.role,
        full,
        level: room.level,
        totalLevels: TOTAL_LEVELS,
        puzzles,
        startedAt: room.startedAt,
      };
      this.server.to(p.socketId).emit(WhisperEvents.RoomState, payload);
    }
  }
}
