'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { WhisperEvents } from '@shadyexperiments/shared';
import type { WhisperSocket } from '@/lib/whisper-socket';
import { iceServers, hasTurn } from '@/lib/ice';
import { track } from '@/lib/track';

export type VoiceStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

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
 * How long ICE may sit in `disconnected` (a transient state that often self-heals)
 * before we surface it as a `reconnecting` drop instead of keeping the UI on LIVE.
 */
const ICE_GRACE_MS = 6000;

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
  // Post-connect liveness bookkeeping.
  const iceGraceRef = useRef<number | null>(null);
  const connectedOnceRef = useRef(false);
  const dropTrackedRef = useRef(false);

  // Report the connection outcome once per mount (a retry reloads the page).
  const outcomeTrackedRef = useRef(false);
  useEffect(() => {
    // A post-connect drop is its own signal (once) — today the only telemetry
    // that a voice link died after going live.
    if (status === 'reconnecting' && !dropTrackedRef.current) {
      dropTrackedRef.current = true;
      track('whisperinghacker', 'voice_dropped', { usedTurn: hasTurn() });
    }
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
      const clearIceGrace = () => {
        if (iceGraceRef.current !== null) {
          window.clearTimeout(iceGraceRef.current);
          iceGraceRef.current = null;
        }
      };

      peer.on('stream', (stream: MediaStream) => {
        clearTimer();
        clearIceGrace();
        connectedOnceRef.current = true;
        setRemoteStream(stream);
        setStatus('connected');
      });
      // Watch the underlying ICE connection so a post-connect drop is visible
      // instead of the UI lying "LIVE". `disconnected` is often transient, so we
      // give it a grace window to self-heal before surfacing `reconnecting`; a
      // real recovery (`connected`/`completed`) flips it straight back to LIVE.
      peer.on('iceStateChange', (state: string) => {
        if (state === 'connected' || state === 'completed') {
          clearIceGrace();
          if (connectedOnceRef.current) setStatus('connected');
        } else if (state === 'disconnected') {
          if (iceGraceRef.current === null && connectedOnceRef.current) {
            iceGraceRef.current = window.setTimeout(() => {
              iceGraceRef.current = null;
              if (statusRef.current === 'connected') setStatus('reconnecting');
            }, ICE_GRACE_MS);
          }
        } else if (state === 'failed' || state === 'closed') {
          clearIceGrace();
          if (connectedOnceRef.current) setStatus('reconnecting');
        }
      });
      peer.on('close', () => {
        clearIceGrace();
        // No `!== 'connected'` guard: a close AFTER going live must surface too
        // (it previously stayed silently "connected" with dead audio).
        setStatus(connectedOnceRef.current ? 'reconnecting' : 'failed');
      });
      peer.on('error', (e: Error) => {
        setError(e.message);
        clearIceGrace();
        setStatus(connectedOnceRef.current ? 'reconnecting' : 'failed');
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
      if (iceGraceRef.current !== null) {
        window.clearTimeout(iceGraceRef.current);
        iceGraceRef.current = null;
      }
      connectedOnceRef.current = false;
      dropTrackedRef.current = false;
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
