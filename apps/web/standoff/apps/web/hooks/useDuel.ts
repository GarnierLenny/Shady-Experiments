'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DuelResult,
  GameDrawPayload,
  GameStartPayload,
  LobbyErrorPayload,
  LobbyStatus,
  PublicPlayer,
  SocketEvents,
} from '@standoffduel/shared';
import { createSocket, DuelSocket } from '@/lib/socket';

/** Client-side cinematic sub-phases derived from server events + timers. */
export type CinematicPhase =
  | 'idle'
  | 'zoom'
  | 'dezoom'
  | 'wait'
  | 'draw'
  | 'showdown'
  | 'result';

/** Suspense beat after the first draw, before the result screen.
 *  freeze (1500) + fall (1100) ≈ 2600ms of action, then hold on the
 *  winner standing / loser down before the table slides up. */
const SHOWDOWN_MS = 4000;

export interface DuelState {
  socket: DuelSocket | null;
  connected: boolean;
  status: LobbyStatus | 'connecting';
  players: PublicPlayer[];
  selfId: string | null;
  full: boolean;
  error: LobbyErrorPayload | null;
  initiator: boolean | null;
  phase: CinematicPhase;
  start: GameStartPayload | null;
  draw: GameDrawPayload | null;
  result: DuelResult | null;
  /** Match length for this lobby (1 or 3), confirmed by the server. */
  bestOf: number;
  /** Round wins so far this match, keyed by player id. */
  scores: Record<string, number>;
  ready: () => void;
  rematch: () => void;
  reportDraw: () => void;
}

/**
 * Owns the socket connection and translates server events into the state the
 * lobby/duel UI needs, including the cinematic phase machine. The server stays
 * the source of truth - this only animates between the beats it dictates.
 */
export function useDuel(
  lobbyId: string,
  name: string,
  requestedBestOf = 1,
): DuelState {
  const socketRef = useRef<DuelSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<LobbyStatus | 'connecting'>('connecting');
  const [players, setPlayers] = useState<PublicPlayer[]>([]);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const [error, setError] = useState<LobbyErrorPayload | null>(null);
  const [initiator, setInitiator] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<CinematicPhase>('idle');
  const [start, setStart] = useState<GameStartPayload | null>(null);
  const [draw, setDraw] = useState<GameDrawPayload | null>(null);
  const [result, setResult] = useState<DuelResult | null>(null);
  const [bestOf, setBestOf] = useState(requestedBestOf);
  const [scores, setScores] = useState<Record<string, number>>({});

  const timersRef = useRef<number[]>([]);
  const drawReportedRef = useRef(false);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  }, []);

  useEffect(() => {
    const socket = createSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit(SocketEvents.LobbyJoin, { lobbyId, name, bestOf: requestedBestOf });
    });
    socket.on('disconnect', () => setConnected(false));

    socket.on(SocketEvents.LobbyState, (s) => {
      setStatus(s.status);
      setPlayers(s.players);
      setSelfId(s.selfId);
      setFull(s.full);
      setBestOf(s.bestOf);
      setScores(s.scores);
      // Between rounds, reset the cinematic so the lobby shows again.
      if (s.status === 'waiting' || s.status === 'ready') {
        clearTimers();
        setPhase('idle');
        setStart(null);
        setDraw(null);
        setResult(null);
        drawReportedRef.current = false;
      }
    });

    socket.on(SocketEvents.LobbyError, (e) => setError(e));
    socket.on(SocketEvents.WebrtcInit, (p) => setInitiator(p.initiator));

    socket.on(SocketEvents.GameStart, (p) => {
      setError(null);
      setResult(null);
      setDraw(null);
      drawReportedRef.current = false;
      setStart(p);
      clearTimers();
      setPhase('zoom');
      timersRef.current.push(
        window.setTimeout(() => setPhase('dezoom'), p.zoomMs),
      );
      timersRef.current.push(
        window.setTimeout(() => setPhase('wait'), p.zoomMs + p.dezoomMs),
      );
    });

    socket.on(SocketEvents.GameDraw, (p) => {
      clearTimers();
      setDraw(p);
      setPhase('draw');
    });

    socket.on(SocketEvents.GameResult, (r) => {
      clearTimers();
      setResult(r);
      // Hold a suspense beat (frame fall) before revealing the result.
      setPhase('showdown');
      timersRef.current.push(
        window.setTimeout(() => setPhase('result'), SHOWDOWN_MS),
      );
    });

    return () => {
      clearTimers();
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [lobbyId, name, requestedBestOf, clearTimers]);

  const ready = useCallback(() => {
    socketRef.current?.emit(SocketEvents.LobbyReady);
  }, []);

  const rematch = useCallback(() => {
    socketRef.current?.emit(SocketEvents.LobbyRematch);
  }, []);

  const reportDraw = useCallback(() => {
    if (drawReportedRef.current) return;
    drawReportedRef.current = true;
    socketRef.current?.emit(SocketEvents.GameDrawDetected, {
      clientAt: Date.now(),
    });
  }, []);

  return {
    socket: socketRef.current,
    connected,
    status,
    players,
    selfId,
    full,
    error,
    initiator,
    phase,
    start,
    draw,
    result,
    bestOf,
    scores,
    ready,
    rematch,
    reportDraw,
  };
}
