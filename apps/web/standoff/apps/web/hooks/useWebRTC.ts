'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SocketEvents } from '@standoffduel/shared';
import type { DuelSocket } from '@/lib/socket';
import { iceServers } from '@/lib/ice';

/** Lifecycle of the peer media link, so the UI can stop hiding failures. */
export type WebRTCStatus = 'idle' | 'connecting' | 'connected' | 'failed';

export interface WebRTCState {
  remoteStream: MediaStream | null;
  connected: boolean;
  error: string | null;
  status: WebRTCStatus;
  /** Tear down and reconnect from scratch (full re-handshake via reload). */
  retry: () => void;
}

/** How long to wait for the peer media before we call it a failed connection. */
const CONNECT_TIMEOUT_MS = 15000;

/**
 * Peer-to-peer webcam stream over `simple-peer`, with signaling relayed through
 * the socket. The server tells exactly one side to initiate (no glare); signals
 * that arrive before the peer exists are buffered.
 *
 * Connection is fragile by nature (NAT traversal), so we expose an explicit
 * status + a timeout: if the media never arrives, the room can show a "couldn't
 * connect, reconnect?" prompt instead of an opponent panel that hangs forever.
 */
export function useWebRTC(
  socket: DuelSocket | null,
  localStream: MediaStream | null,
  initiator: boolean | null,
): WebRTCState {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<WebRTCStatus>('idle');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const peerRef = useRef<any>(null);
  const queueRef = useRef<unknown[]>([]);
  const timeoutRef = useRef<number | null>(null);
  const statusRef = useRef<WebRTCStatus>('idle');
  statusRef.current = status;

  const clearTimer = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Attach the signal relay listener as early as possible.
  useEffect(() => {
    if (!socket) return;
    const onSignal = (p: { signal: unknown }) => {
      if (peerRef.current) {
        try {
          peerRef.current.signal(p.signal);
        } catch {
          /* malformed signal - ignore */
        }
      } else {
        queueRef.current.push(p.signal);
      }
    };
    socket.on(SocketEvents.WebrtcSignal, onSignal);
    return () => {
      socket.off(SocketEvents.WebrtcSignal, onSignal);
    };
  }, [socket]);

  // Create the peer once we have a socket, a local stream and a role.
  useEffect(() => {
    if (!socket || !localStream || initiator === null || peerRef.current) return;
    let destroyed = false;

    setStatus('connecting');
    setError(null);

    (async () => {
      await import('@/lib/peer-polyfill');
      const SimplePeer = (await import('simple-peer')).default;
      if (destroyed) return;

      const peer = new SimplePeer({
        initiator,
        stream: localStream,
        trickle: false,
        config: { iceServers: iceServers() },
      });
      peerRef.current = peer;

      // If neither media nor a data channel arrives in time, surface a failure
      // the UI can act on rather than spinning silently.
      timeoutRef.current = window.setTimeout(() => {
        if (statusRef.current !== 'connected') setStatus('failed');
      }, CONNECT_TIMEOUT_MS);

      peer.on('signal', (data: unknown) => {
        socket.emit(SocketEvents.WebrtcSignal, { signal: data });
      });
      peer.on('stream', (stream: MediaStream) => {
        clearTimer();
        setRemoteStream(stream);
        setStatus('connected');
      });
      peer.on('connect', () => {
        // The data channel is open, but this is a *video* app: only the remote
        // stream counts as connected. If media never arrives the timeout still
        // fires 'failed', so a connected-but-blank panel can't hide a failure.
        setConnected(true);
      });
      peer.on('close', () => {
        setConnected(false);
        if (statusRef.current !== 'connected') setStatus('failed');
      });
      peer.on('error', (e: Error) => {
        setError(e.message);
        if (statusRef.current !== 'connected') setStatus('failed');
      });

      // Flush any signals that arrived before the peer existed.
      queueRef.current.forEach((sig) => {
        try {
          peer.signal(sig as Parameters<typeof peer.signal>[0]);
        } catch {
          /* ignore */
        }
      });
      queueRef.current = [];
    })();

    return () => {
      destroyed = true;
      clearTimer();
      if (peerRef.current) {
        try {
          peerRef.current.destroy();
        } catch {
          /* ignore */
        }
        peerRef.current = null;
      }
      setRemoteStream(null);
      setConnected(false);
      setStatus('idle');
    };
  }, [socket, localStream, initiator, clearTimer]);

  // A clean re-handshake is hard with one-shot role assignment; a reload
  // re-joins the lobby and re-runs the whole negotiation reliably.
  const retry = useCallback(() => {
    if (typeof window !== 'undefined') window.location.reload();
  }, []);

  return { remoteStream, connected, error, status, retry };
}
