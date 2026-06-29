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
  ready: () => void;
  rematch: () => void;
  /** Hacker reports a tab solved (the server trusts it — co-op). */
  solved: (index: number, seed: string) => void;
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

  const joinedTrackedRef = useRef(false);

  useEffect(() => {
    const socket = createWhisperSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit(WhisperEvents.RoomJoin, { roomId, name });
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

  const solved = useCallback((index: number, seed: string) => {
    socketRef.current?.emit(WhisperEvents.PuzzleSolved, { index, seed });
    track('whisperinghacker', 'puzzle_solved', { index });
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
    ready,
    rematch,
    solved,
  };
}
