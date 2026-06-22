import { Injectable, Logger } from '@nestjs/common';
import type { Server } from 'socket.io';
import {
  DUEL_TIMINGS,
  DuelEndReason,
  DuelResult,
  DuelResultRecord,
  GameDrawPayload,
  GameStartPayload,
  LobbyErrorPayload,
  LobbyStatePayload,
  LobbyStatus,
  MAX_PLAYERS_PER_LOBBY,
  PublicPlayer,
  ReactionOutcome,
  SocketEvents,
  generateResultId,
  randomDelayMs,
} from '@standoffduel/shared';
import { ServerLobby, ServerPlayer } from './lobby.types';
import { ResultsStore } from '../results/results.store';

/**
 * Owns all lobby state and the duel clock. The server is the single source of
 * truth: it decides when the signal fires and stamps every reaction server-side,
 * so WebRTC video latency can never make a duel unfair.
 */
@Injectable()
export class LobbyService {
  private readonly logger = new Logger(LobbyService.name);
  private readonly lobbies = new Map<string, ServerLobby>();
  private server!: Server;

  constructor(private readonly results: ResultsStore) {}

  /** Called once from the gateway's `afterInit` so timers can emit later. */
  bindServer(server: Server): void {
    this.server = server;
  }

  // --------------------------------------------------------------------------
  // Joining / leaving
  // --------------------------------------------------------------------------

  join(
    lobbyId: string,
    name: string,
    socketId: string,
    bestOf = 1,
  ): LobbyErrorPayload | null {
    let lobby = this.lobbies.get(lobbyId);
    const existing = lobby?.players.find((p) => p.socketId === socketId);

    if (lobby && !existing) {
      if (lobby.players.length >= MAX_PLAYERS_PER_LOBBY) {
        return { code: 'lobby_full', message: 'This lobby already has two duelists.' };
      }
      if (lobby.status === 'countdown' || lobby.status === 'draw') {
        return { code: 'in_progress', message: 'A duel is already underway here.' };
      }
    }

    if (!lobby) {
      lobby = {
        id: lobbyId,
        players: [],
        status: 'waiting',
        drawSignalAt: null,
        timers: [],
        bestOf: bestOf === 3 ? 3 : 1,
        scores: {},
        pendingNextRound: false,
      };
      this.lobbies.set(lobbyId, lobby);
    }

    const safeName = (name || '').slice(0, 24) || 'Stranger';
    if (existing) {
      existing.connected = true;
      if (name) existing.name = safeName;
    } else {
      lobby.players.push({
        socketId,
        name: safeName,
        ready: false,
        connected: true,
        drawAt: null,
        falseStart: false,
      });
    }

    this.recomputeStatus(lobby);
    this.broadcastState(lobby);

    // When the second player arrives, assign WebRTC roles exactly once.
    if (!existing && lobby.players.length === MAX_PLAYERS_PER_LOBBY) {
      this.server
        .to(lobby.players[0].socketId)
        .emit(SocketEvents.WebrtcInit, { initiator: true });
      this.server
        .to(lobby.players[1].socketId)
        .emit(SocketEvents.WebrtcInit, { initiator: false });
    }

    this.logger.log(`join ${socketId} -> ${lobbyId} (${lobby.players.length}/2)`);
    return null;
  }

  handleDisconnect(socketId: string): void {
    const lobby = this.findLobbyBySocket(socketId);
    if (!lobby) return;

    const leaving = lobby.players.find((p) => p.socketId === socketId) ?? null;
    const wasInDuel = lobby.status === 'countdown' || lobby.status === 'draw';
    lobby.players = lobby.players.filter((p) => p.socketId !== socketId);

    // If the duel was live, the player who stayed wins by forfeit.
    if (wasInDuel && lobby.players.length === 1) {
      this.clearTimers(lobby);
      lobby.status = 'finished';
      const survivor = lobby.players[0];
      const id = generateResultId();
      const result: DuelResult = {
        winnerId: survivor.socketId,
        winnerName: survivor.name,
        loserId: leaving?.socketId ?? null,
        reactionMs: null,
        reason: 'opponent_left',
        reactions: {},
        resultId: id,
        bestOf: lobby.bestOf,
        scores: { ...lobby.scores },
        matchOver: true,
      };
      void this.results.save({
        id,
        winnerName: survivor.name,
        loserName: leaving?.name ?? null,
        reactionMs: null,
        reason: 'opponent_left',
        isTie: false,
        createdAt: Date.now(),
      });
      this.server.to(lobby.id).emit(SocketEvents.GameResult, result);
      // A forfeit ends the match - clear the score for whoever joins next.
      lobby.scores = {};
      lobby.pendingNextRound = false;
      this.resetPlayersForNextRound(lobby);
      this.broadcastState(lobby);
      return;
    }

    if (lobby.players.length === 0) {
      this.clearTimers(lobby);
      this.lobbies.delete(lobby.id);
      return;
    }

    // Otherwise drop back to the waiting room - a broken pairing voids the match.
    this.clearTimers(lobby);
    this.resetPlayersForNextRound(lobby);
    lobby.status = 'waiting';
    lobby.drawSignalAt = null;
    lobby.scores = {};
    lobby.pendingNextRound = false;
    this.broadcastState(lobby);
  }

  // --------------------------------------------------------------------------
  // Ready / rematch -> start the cinematic sequence
  // --------------------------------------------------------------------------

  ready(socketId: string): void {
    const lobby = this.findLobbyBySocket(socketId);
    if (!lobby || lobby.status === 'countdown' || lobby.status === 'draw') return;
    const player = lobby.players.find((p) => p.socketId === socketId);
    if (!player) return;

    player.ready = true;
    const status = this.recomputeStatus(lobby);
    if (status === 'ready') this.startSequence(lobby);
    else this.broadcastState(lobby);
  }

  rematch(socketId: string): void {
    const lobby = this.findLobbyBySocket(socketId);
    if (!lobby) return;
    // Ignore a second rematch racing in after the first already reset the room,
    // otherwise a near-simultaneous double "Next round" wipes the match score.
    if (lobby.status !== 'finished') return;

    // Reset the room and wait for BOTH players to get back into position -
    // don't pre-ready the one who clicked.
    this.clearTimers(lobby);
    lobby.status = 'waiting';
    lobby.drawSignalAt = null;
    if (lobby.pendingNextRound) {
      // Advancing within a best-of-N match: keep the running score.
      lobby.pendingNextRound = false;
    } else {
      // Fresh match.
      lobby.scores = {};
    }
    this.resetPlayersForNextRound(lobby);
    this.broadcastState(lobby);
  }

  private startSequence(lobby: ServerLobby): void {
    this.clearTimers(lobby);
    lobby.status = 'countdown';
    lobby.drawSignalAt = null;
    for (const p of lobby.players) {
      p.drawAt = null;
      p.falseStart = false;
    }
    this.broadcastState(lobby);

    const startPayload: GameStartPayload = {
      startAt: Date.now(),
      zoomMs: DUEL_TIMINGS.ZOOM_MS,
      dezoomMs: DUEL_TIMINGS.DEZOOM_MS,
    };
    this.server.to(lobby.id).emit(SocketEvents.GameStart, startPayload);

    // Cinematic (zoom + dezoom) then a random hold before the signal.
    const wait = DUEL_TIMINGS.ZOOM_MS + DUEL_TIMINGS.DEZOOM_MS + randomDelayMs();
    lobby.timers.push(setTimeout(() => this.fireDraw(lobby.id), wait));
  }

  private fireDraw(lobbyId: string): void {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby || lobby.status !== 'countdown') return;

    lobby.status = 'draw';
    lobby.drawSignalAt = Date.now();
    const payload: GameDrawPayload = {
      at: lobby.drawSignalAt,
      windowMs: DUEL_TIMINGS.DRAW_WINDOW_MS,
    };
    this.server.to(lobby.id).emit(SocketEvents.GameDraw, payload);
    this.broadcastState(lobby);

    // Nobody draws in time -> tie.
    lobby.timers.push(
      setTimeout(() => this.resolveTimeout(lobbyId), DUEL_TIMINGS.DRAW_WINDOW_MS),
    );
  }

  // --------------------------------------------------------------------------
  // Draw detection + resolution
  // --------------------------------------------------------------------------

  drawDetected(socketId: string): void {
    const lobby = this.findLobbyBySocket(socketId);
    if (!lobby) return;
    const player = lobby.players.find((p) => p.socketId === socketId);
    if (!player || player.drawAt !== null) return; // unknown or already drew

    const now = Date.now();

    // Drew before the signal -> false start, the opponent wins.
    if (lobby.status === 'countdown') {
      player.drawAt = now;
      player.falseStart = true;
      const opponent = lobby.players.find((p) => p.socketId !== socketId) ?? null;
      this.resolve(lobby, 'false_start', opponent?.socketId ?? null);
      return;
    }

    // Clean draw -> first valid one wins.
    if (lobby.status === 'draw') {
      player.drawAt = now;
      this.resolve(lobby, 'draw', socketId);
    }
  }

  private resolveTimeout(lobbyId: string): void {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby || lobby.status !== 'draw') return;
    this.resolve(lobby, 'timeout', null);
  }

  private resolve(
    lobby: ServerLobby,
    reason: DuelEndReason,
    winnerSocketId: string | null,
  ): void {
    this.clearTimers(lobby);
    lobby.status = 'finished';

    const reactions: Record<string, ReactionOutcome> = {};
    for (const p of lobby.players) {
      const ms =
        lobby.drawSignalAt !== null && p.drawAt !== null && !p.falseStart
          ? p.drawAt - lobby.drawSignalAt
          : null;
      reactions[p.socketId] = { ms, falseStart: p.falseStart };
    }

    const winner = winnerSocketId
      ? lobby.players.find((p) => p.socketId === winnerSocketId) ?? null
      : null;
    const loser = winner
      ? lobby.players.find((p) => p.socketId !== winner.socketId) ?? null
      : null;

    // Tally the round, then decide whether the match is settled.
    if (winner) {
      lobby.scores[winner.socketId] = (lobby.scores[winner.socketId] ?? 0) + 1;
    }
    const needed = Math.ceil(lobby.bestOf / 2);
    const topScore = Math.max(0, ...Object.values(lobby.scores));
    const matchOver = lobby.bestOf <= 1 || topScore >= needed;

    const result: DuelResult = {
      winnerId: winner?.socketId ?? null,
      winnerName: winner?.name ?? null,
      loserId: loser?.socketId ?? null,
      reactionMs: winner ? reactions[winner.socketId]?.ms ?? null : null,
      reason,
      reactions,
      bestOf: lobby.bestOf,
      scores: { ...lobby.scores },
      matchOver,
    };

    // Only the decisive result earns a shareable permalink - a best-of-three
    // shouldn't spam a link per round. Fire-and-forget: a storage hiccup must
    // never block the result reaching the players.
    if (matchOver) {
      const id = generateResultId();
      result.resultId = id;
      const record: DuelResultRecord = {
        id,
        winnerName: winner?.name ?? null,
        loserName: loser?.name ?? null,
        reactionMs: result.reactionMs,
        reason,
        isTie: winner === null,
        createdAt: Date.now(),
      };
      void this.results.save(record);
      lobby.pendingNextRound = false;
    } else {
      // Round over, match continues - keep the score, await the next round.
      lobby.pendingNextRound = true;
    }
    // Per-round player state clears either way; the score lives on the lobby.
    this.resetPlayersForNextRound(lobby);

    this.server.to(lobby.id).emit(SocketEvents.GameResult, result);
    this.broadcastState(lobby);
    this.logger.log(
      `resolve ${lobby.id}: ${reason} winner=${result.winnerName ?? '-'} ` +
        `score=[${Object.values(lobby.scores).join(',')}] matchOver=${matchOver}`,
    );
  }

  // --------------------------------------------------------------------------
  // WebRTC signaling relay
  // --------------------------------------------------------------------------

  relaySignal(socketId: string, signal: unknown): void {
    const lobby = this.findLobbyBySocket(socketId);
    if (!lobby) return;
    const other = lobby.players.find((p) => p.socketId !== socketId);
    if (other) {
      this.server.to(other.socketId).emit(SocketEvents.WebrtcSignal, { signal });
    }
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private findLobbyBySocket(socketId: string): ServerLobby | undefined {
    for (const lobby of this.lobbies.values()) {
      if (lobby.players.some((p) => p.socketId === socketId)) return lobby;
    }
    return undefined;
  }

  private recomputeStatus(lobby: ServerLobby): LobbyStatus {
    if (
      lobby.status === 'countdown' ||
      lobby.status === 'draw' ||
      lobby.status === 'finished'
    ) {
      return lobby.status; // mid-duel / resolved states are driven explicitly
    }
    const everyoneReady =
      lobby.players.length === MAX_PLAYERS_PER_LOBBY &&
      lobby.players.every((p) => p.ready && p.connected);
    lobby.status = everyoneReady ? 'ready' : 'waiting';
    return lobby.status;
  }

  private resetPlayersForNextRound(lobby: ServerLobby): void {
    for (const p of lobby.players) {
      p.ready = false;
      p.drawAt = null;
      p.falseStart = false;
    }
  }

  private clearTimers(lobby: ServerLobby): void {
    for (const t of lobby.timers) clearTimeout(t);
    lobby.timers = [];
  }

  private broadcastState(lobby: ServerLobby): void {
    const players: PublicPlayer[] = lobby.players.map((p) => ({
      id: p.socketId,
      name: p.name,
      ready: p.ready,
      connected: p.connected,
    }));
    const full = lobby.players.length >= MAX_PLAYERS_PER_LOBBY;

    // selfId differs per recipient, so emit individually.
    for (const p of lobby.players) {
      const payload: LobbyStatePayload = {
        lobbyId: lobby.id,
        status: lobby.status,
        players,
        selfId: p.socketId,
        full,
        bestOf: lobby.bestOf,
        scores: { ...lobby.scores },
      };
      this.server.to(p.socketId).emit(SocketEvents.LobbyState, payload);
    }
  }
}
