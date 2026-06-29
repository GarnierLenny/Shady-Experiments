'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { WhisperEvents } from '@shadyexperiments/shared';
import type { WhisperSocket } from '@/lib/whisper-socket';
import { iceServers, hasTurn } from '@/lib/ice';
import { track } from '@/lib/track';

export type VoiceStatus = 'idle' | 'connecting' | 'connected' | 'failed';

export interface VoiceState {
  /** The peer's audio stream - fed into the DisturbanceChain by the room. */
  remoteStream: MediaStream | null;
  error: string | null;
  status: VoiceStatus;
  /** Tear down and reconnect from scratch (full re-handshake via reload). */
  retry: () => void;
}

/** How long to wait for the peer audio before calling it a failed connection. */
const CONNECT_TIMEOUT_MS = 15000;

/**
 * Peer-to-peer *audio* over `simple-peer`, signaling relayed through the
 * `/whisper` socket. The server tells exactly one side to initiate (no glare);
 * signals arriving before the peer exists are buffered. Audio-only twin of
 * Standoff's `useWebRTC` (no video element, no MediaPipe).
 */
export function useVoice(
  socket: WhisperSocket | null,
  localStream: MediaStream | null,
  initiator: boolean | null,
): VoiceState {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<VoiceStatus>('idle');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const peerRef = useRef<any>(null);
  const queueRef = useRef<unknown[]>([]);
  const timeoutRef = useRef<number | null>(null);
  const statusRef = useRef<VoiceStatus>('idle');
  statusRef.current = status;

  // Report the connection outcome once per mount (a retry reloads the page).
  const outcomeTrackedRef = useRef(false);
  useEffect(() => {
    if (outcomeTrackedRef.current) return;
    if (status === 'connected') {
      outcomeTrackedRef.current = true;
      track('whisperinghacker', 'voice_connected');
    } else if (status === 'failed') {
      outcomeTrackedRef.current = true;
      track('whisperinghacker', 'voice_failed', { usedTurn: hasTurn() });
    }
  }, [status]);

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
    socket.on(WhisperEvents.WebrtcSignal, onSignal);
    return () => {
      socket.off(WhisperEvents.WebrtcSignal, onSignal);
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

      timeoutRef.current = window.setTimeout(() => {
        if (statusRef.current !== 'connected') setStatus('failed');
      }, CONNECT_TIMEOUT_MS);

      peer.on('signal', (data: unknown) => {
        socket.emit(WhisperEvents.WebrtcSignal, { signal: data });
      });
      peer.on('stream', (stream: MediaStream) => {
        clearTimer();
        setRemoteStream(stream);
        setStatus('connected');
      });
      peer.on('close', () => {
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
      setStatus('idle');
    };
  }, [socket, localStream, initiator, clearTimer]);

  const retry = useCallback(() => {
    if (typeof window !== 'undefined') window.location.reload();
  }, []);

  return { remoteStream, error, status, retry };
}
