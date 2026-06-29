'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PublicWhisperPlayer,
  PuzzleSlot,
  WhisperCompletePayload,
  WhisperErrorPayload,
  WhisperEvents,
  WhisperRole,
  WhisperStatus,
} from '@shadyexperiments/shared';
import { createWhisperSocket, WhisperSocket } from '@/lib/whisper-socket';
import { clientSessionId } from '@/lib/whisper-session';
import { track } from '@/lib/track';

export interface WhisperState {
  socket: WhisperSocket | null;
  connected: boolean;
  status: WhisperStatus | 'connecting';
  players: PublicWhisperPlayer[];
  selfId: string | null;
  selfRole: WhisperRole | null;
  full: boolean;
  error: WhisperErrorPayload | null;
  initiator: boolean | null;
  /** Current level (1-based). */
  level: number;
  totalLevels: number;
  /** The current level's puzzle tabs (with seeds/solved/deadlines). */
  puzzles: PuzzleSlot[];
  startedAt: number | null;
  result: WhisperCompletePayload | null;
  /** Epoch ms the level countdown hits zero; null in lobby. */
  levelDeadline: number | null;
  /** Frozen countdown remainder (ms) while a player is disconnected; null when running. */
  frozenRemainingMs: number | null;
  /** Wrong answers made this level, and the cap before it fails. */
  strikes: number;
  maxStrikes: number;
  /** When status is 'failed', why; null otherwise. */
  levelFailReason: 'timeout' | 'strikes' | null;
  ready: () => void;
  /** Advance to the next level (from the cleared screen). */
  next: () => void;
  /** Restart the current level (from the failed screen). */
  retry: () => void;
  rematch: () => void;
  /** Hacker reports a tab solved (the server trusts it — co-op). */
  solved: (index: number, seed: string) => void;
  /** Hacker reports a wrong answer — the server reseeds that tab + resets its timer. */
  failed: (index: number, seed: string) => void;
}

/**
 * Owns the `/whisper` socket connection and reflects the server's authoritative
 * state. The server owns rooms/roles/levels/timers/progression; the puzzle
 * instances are derived deterministically from per-tab seeds on each client.
 */
export function useWhisper(roomId: string, name: string): WhisperState {
  const socketRef = useRef<WhisperSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<WhisperStatus | 'connecting'>('connecting');
  const [players, setPlayers] = useState<PublicWhisperPlayer[]>([]);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [selfRole, setSelfRole] = useState<WhisperRole | null>(null);
  const [full, setFull] = useState(false);
  const [error, setError] = useState<WhisperErrorPayload | null>(null);
  const [initiator, setInitiator] = useState<boolean | null>(null);
  const [level, setLevel] = useState(1);
  const [totalLevels, setTotalLevels] = useState(1);
  const [puzzles, setPuzzles] = useState<PuzzleSlot[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [result, setResult] = useState<WhisperCompletePayload | null>(null);
  const [levelDeadline, setLevelDeadline] = useState<number | null>(null);
  const [frozenRemainingMs, setFrozenRemainingMs] = useState<number | null>(null);
  const [strikes, setStrikes] = useState(0);
  const [maxStrikes, setMaxStrikes] = useState(3);
  const [levelFailReason, setLevelFailReason] = useState<'timeout' | 'strikes' | null>(null);

  const joinedTrackedRef = useRef(false);

  useEffect(() => {
    const socket = createWhisperSocket();
    socketRef.current = socket;

    const sessionId = clientSessionId();
    socket.on('connect', () => {
      setConnected(true);
      socket.emit(WhisperEvents.RoomJoin, { roomId, name, sessionId });
    });
    socket.on('disconnect', () => setConnected(false));

    socket.on(WhisperEvents.RoomState, (s) => {
      setStatus(s.status);
      setPlayers(s.players);
      setSelfId(s.selfId);
      setSelfRole(s.selfRole);
      setFull(s.full);
      setLevel(s.level);
      setTotalLevels(s.totalLevels);
      setPuzzles(s.puzzles);
      setStartedAt(s.startedAt);
      setLevelDeadline(s.levelDeadline);
      setFrozenRemainingMs(s.frozenRemainingMs);
      setStrikes(s.strikes);
      setMaxStrikes(s.maxStrikes);
      setLevelFailReason(s.levelFailReason);
      if (!joinedTrackedRef.current) {
        joinedTrackedRef.current = true;
        track('whisperinghacker', 'room_joined', {
          role: s.selfRole,
          players: s.players.length,
        });
      }
      // Reset transient run state when the room returns to the lobby.
      if (s.status === 'waiting' || s.status === 'ready') setResult(null);
    });

    socket.on(WhisperEvents.RoomError, (e) => setError(e));
    socket.on(WhisperEvents.WebrtcInit, (p) => setInitiator(p.initiator));

    socket.on(WhisperEvents.GameComplete, (p) => {
      setResult(p);
      setStatus('complete');
      track('whisperinghacker', 'run_completed', {
        elapsedMs: p.elapsedMs,
        puzzlesSolved: p.puzzlesSolved,
      });
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomId, name]);

  const ready = useCallback(() => {
    socketRef.current?.emit(WhisperEvents.RoomReady);
  }, []);

  const rematch = useCallback(() => {
    socketRef.current?.emit(WhisperEvents.RoomRematch);
  }, []);

  const next = useCallback(() => {
    socketRef.current?.emit(WhisperEvents.RoomNext);
  }, []);

  const retry = useCallback(() => {
    socketRef.current?.emit(WhisperEvents.RoomRetry);
  }, []);

  const solved = useCallback((index: number, seed: string) => {
    socketRef.current?.emit(WhisperEvents.PuzzleSolved, { index, seed });
    track('whisperinghacker', 'puzzle_solved', { index });
  }, []);

  const failed = useCallback((index: number, seed: string) => {
    socketRef.current?.emit(WhisperEvents.PuzzleFailed, { index, seed });
    track('whisperinghacker', 'puzzle_failed', { index });
  }, []);

  return {
    socket: socketRef.current,
    connected,
    status,
    players,
    selfId,
    selfRole,
    full,
    error,
    initiator,
    level,
    totalLevels,
    puzzles,
    startedAt,
    result,
    levelDeadline,
    frozenRemainingMs,
    strikes,
    maxStrikes,
    levelFailReason,
    ready,
    rematch,
    next,
    retry,
    solved,
    failed,
  };
}
