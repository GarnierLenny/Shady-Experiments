import { Injectable, Logger } from '@nestjs/common';
import type { Namespace } from 'socket.io';
import {
  LEVEL_PUZZLES,
  MAX_STRIKES,
  PublicWhisperPlayer,
  PuzzleSlot,
  STRIKE_PENALTY_SEC,
  TOTAL_LEVELS,
  WhisperCompletePayload,
  WhisperErrorPayload,
  WhisperEvents,
  WhisperResultRecord,
  WhisperRole,
  WhisperStatePayload,
  WhisperStatus,
  generateResultId,
  levelTime,
} from '@shadyexperiments/shared';
import { ServerPuzzleSlot, ServerWhisperRoom } from './whisper.types';
import { WhisperResultsStore } from './whisper-results.store';

const MAX_PLAYERS = 2;
/** How often the reseed timer sweeps active rooms. */
const TICK_MS = 1000;
/** Grace window for a mid-run disconnect before the seat is evicted and the run voided. */
const DISCONNECT_GRACE_MS = 25000;

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
    sessionId: string,
    socketId: string,
  ): WhisperErrorPayload | null {
    let room = this.rooms.get(roomId);
    const existing = room?.players.find((p) => p.sessionId === sessionId);

    if (room && !existing) {
      if (room.players.length >= MAX_PLAYERS) {
        return {
          code: 'room_full',
          message: 'This room already has a hacker and an operator.',
        };
      }
      if (
        room.status === 'playing' ||
        room.status === 'cleared' ||
        room.status === 'failed'
      ) {
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
        levelDeadline: null,
        frozenRemainingMs: null,
        strikes: 0,
        levelFailReason: null,
      };
      this.rooms.set(roomId, room);
    }

    const safeName = (name || '').slice(0, 24) || 'Anonymous';
    if (existing) {
      // Reconnect: rebind the socket, cancel any pending eviction, mark present,
      // and resume the frozen clock once everyone is back.
      if (existing.graceTimer) {
        clearTimeout(existing.graceTimer);
        existing.graceTimer = null;
      }
      existing.socketId = socketId;
      existing.connected = true;
      if (name) existing.name = safeName;
      this.maybeResumeCountdown(room);
    } else {
      // First in is the hacker (and WebRTC initiator); second is the operator.
      const role: WhisperRole =
        room.players.length === 0 ? 'hacker' : 'operator';
      room.players.push({
        sessionId,
        socketId,
        name: safeName,
        role,
        ready: false,
        connected: true,
        graceTimer: null,
      });
    }

    this.recomputeStatus(room);
    this.broadcastState(room);

    // When the second player first arrives, assign WebRTC roles exactly once.
    if (!existing && room.players.length === MAX_PLAYERS) {
      this.server
        .to(room.players[0].socketId)
        .emit(WhisperEvents.WebrtcInit, { initiator: true });
      this.server
        .to(room.players[1].socketId)
        .emit(WhisperEvents.WebrtcInit, { initiator: false });
    }

    this.logger.log(
      `join ${socketId} -> ${roomId} (${room.players.length}/2)${existing ? ' [resume]' : ''}`,
    );
    return null;
  }

  handleDisconnect(socketId: string): void {
    const room = this.findRoomBySocket(socketId);
    if (!room) return;
    const player = room.players.find((p) => p.socketId === socketId);
    if (!player) return;

    const runInProgress =
      room.status === 'playing' ||
      room.status === 'cleared' ||
      room.status === 'failed';

    if (!runInProgress) {
      // In the lobby a drop just frees the seat (and re-seats roles by order).
      this.removePlayer(room, player.sessionId);
      return;
    }

    // Mid-run: keep the seat, freeze the clock, and start a grace window so a
    // transient blip (WiFi, tab sleep, reconnect) doesn't void the partner's run.
    player.connected = false;
    if (player.graceTimer) clearTimeout(player.graceTimer);
    this.freezeCountdown(room);
    player.graceTimer = setTimeout(
      () => this.evict(room.id, player.sessionId),
      DISCONNECT_GRACE_MS,
    );
    if (typeof player.graceTimer.unref === 'function') player.graceTimer.unref();
    this.broadcastState(room);
    this.logger.log(`disconnect ${socketId}; ${DISCONNECT_GRACE_MS}ms grace ${room.id}`);
  }

  /** Immediate seat removal (lobby drop): re-seat roles by order, drop empty rooms. */
  private removePlayer(room: ServerWhisperRoom, sessionId: string): void {
    const leaving = room.players.find((p) => p.sessionId === sessionId);
    if (leaving?.graceTimer) clearTimeout(leaving.graceTimer);
    room.players = room.players.filter((p) => p.sessionId !== sessionId);
    if (room.players.length === 0) {
      this.rooms.delete(room.id);
      return;
    }
    room.players.forEach((p, i) => {
      p.role = i === 0 ? 'hacker' : 'operator';
      p.ready = false;
    });
    this.broadcastState(room);
  }

  /** Grace window elapsed without a rejoin: a partner truly left — void the run. */
  private evict(roomId: string, sessionId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const player = room.players.find((p) => p.sessionId === sessionId);
    if (!player || player.connected) return; // returned in time
    player.graceTimer = null;
    room.players = room.players.filter((p) => p.sessionId !== sessionId);
    if (room.players.length === 0) {
      this.rooms.delete(roomId);
      return;
    }
    // Co-op can't continue solo: drop back to the lobby and re-seat the survivor.
    this.resetToLobby(room);
    room.players.forEach((p, i) => {
      p.role = i === 0 ? 'hacker' : 'operator';
      p.ready = false;
    });
    this.broadcastState(room);
    this.logger.log(`evicted ${sessionId.slice(0, 8)} after grace ${roomId}`);
  }

  /** Freeze the level countdown while a player is away (the clock must not bleed). */
  private freezeCountdown(room: ServerWhisperRoom): void {
    if (room.status !== 'playing' || room.levelDeadline === null) return;
    room.frozenRemainingMs = Math.max(0, room.levelDeadline - Date.now());
    room.levelDeadline = null;
  }

  /** Resume the frozen countdown once everyone is back and the run is live. */
  private maybeResumeCountdown(room: ServerWhisperRoom): void {
    if (
      room.status === 'playing' &&
      room.frozenRemainingMs !== null &&
      room.players.every((p) => p.connected)
    ) {
      room.levelDeadline = Date.now() + room.frozenRemainingMs;
      room.frozenRemainingMs = null;
      this.ensureTicker();
    }
  }

  // --------------------------------------------------------------------------
  // Ready / rematch
  // --------------------------------------------------------------------------

  ready(socketId: string): void {
    const room = this.findRoomBySocket(socketId);
    if (!room || (room.status !== 'waiting' && room.status !== 'ready')) return;
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
    room.levelDeadline = null;
    room.frozenRemainingMs = null;
    room.strikes = 0;
    room.levelFailReason = null;
    // Leave any pending grace timers running: each disconnected player's own
    // timer still fires and evicts them, so a both-players-dropped race can't
    // strand a ghost seat after one of them is voided.
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

  /** Lay out a level's puzzle tabs with fresh seeds + start its countdown. */
  private buildLevel(room: ServerWhisperRoom, level: number): void {
    const defs = LEVEL_PUZZLES[level] ?? [];
    room.puzzles = defs.map((d, i) => ({
      index: i,
      type: d.type,
      name: d.name,
      title: d.title,
      seed: this.newSeed(room.id, level, i),
      solved: false,
      deadline: null,
    }));
    room.levelDeadline = Date.now() + levelTime(level) * 1000;
    room.frozenRemainingMs = null;
    room.strikes = 0;
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
      if (room.level >= TOTAL_LEVELS) {
        this.complete(room);
      } else {
        // Level cleared — pause and wait for the players to hit NEXT LEVEL.
        room.status = 'cleared';
        room.levelDeadline = null;
        this.broadcastState(room);
        this.logger.log(`level ${room.level} cleared ${room.id}`);
      }
    } else {
      this.broadcastState(room);
    }
  }

  /** Players hit NEXT LEVEL on the cleared screen — advance and resume play. */
  next(socketId: string): void {
    const room = this.findRoomBySocket(socketId);
    if (!room || room.status !== 'cleared') return;
    room.level += 1;
    this.buildLevel(room, room.level);
    room.status = 'playing';
    this.ensureTicker();
    this.broadcastState(room);
    this.logger.log(`level ${room.level} ${room.id}`);
  }

  /** Players hit RETRY on the failed screen — restart the same level. */
  retry(socketId: string): void {
    const room = this.findRoomBySocket(socketId);
    if (!room || room.status !== 'failed') return;
    this.buildLevel(room, room.level);
    room.status = 'playing';
    room.levelFailReason = null;
    this.ensureTicker();
    this.broadcastState(room);
    this.logger.log(`level ${room.level} retry ${room.id}`);
  }

  /**
   * The hacker reports a *wrong* answer. KTANE rules: it's a strike — burn a few
   * seconds off the level countdown. MAX_STRIKES errors are survivable (they light
   * the crosses); the NEXT one (the 4th) — or the clock hitting zero — fails the
   * level and restarts it.
   */
  failed(socketId: string, index: number, seed: string): void {
    const room = this.findRoomBySocket(socketId);
    if (!room || room.status !== 'playing') return;
    const player = room.players.find((p) => p.socketId === socketId);
    if (!player || player.role !== 'hacker') return; // only the hacker submits

    const slot = room.puzzles[index];
    if (!slot || slot.solved) return;
    if (slot.seed !== seed) return; // stale report (raced a level restart)

    room.strikes += 1;
    if (room.levelDeadline !== null) room.levelDeadline -= STRIKE_PENALTY_SEC * 1000;

    if (room.strikes > MAX_STRIKES) {
      this.failLevel(room, 'strikes'); // the 4th strike is fatal
    } else if (room.levelDeadline !== null && Date.now() >= room.levelDeadline) {
      this.failLevel(room, 'timeout');
    } else {
      this.broadcastState(room);
    }
  }

  /** A level ran out of time or strikes: pause on the failed screen, await RETRY. */
  private failLevel(room: ServerWhisperRoom, reason: 'timeout' | 'strikes'): void {
    room.status = 'failed';
    room.levelFailReason = reason;
    room.levelDeadline = null;
    this.broadcastState(room);
    this.logger.log(`level ${room.level} failed (${reason}); awaiting retry ${room.id}`);
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
  // Level countdown sweep
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
      if (room.levelDeadline !== null && now >= room.levelDeadline) {
        this.failLevel(room, 'timeout');
      }
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
    if (
      room.status === 'playing' ||
      room.status === 'complete' ||
      room.status === 'cleared' ||
      room.status === 'failed'
    ) {
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
        levelDeadline: room.levelDeadline,
        frozenRemainingMs: room.frozenRemainingMs,
        strikes: room.strikes,
        maxStrikes: MAX_STRIKES,
        levelFailReason: room.levelFailReason,
      };
      this.server.to(p.socketId).emit(WhisperEvents.RoomState, payload);
    }
  }
}
