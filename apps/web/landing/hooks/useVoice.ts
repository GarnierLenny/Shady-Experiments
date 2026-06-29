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
  /** Force an in-place voice re-handshake (no page reload). */
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
  handshakeGen: number,
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
  // Latest socket, so retry()/recovery can emit without living inside the effect.
  const socketRef = useRef<WhisperSocket | null>(socket);
  socketRef.current = socket;
  // Ask the server for a re-handshake at most once per drop.
  const lostSentRef = useRef(false);

  // Report the connection outcome once per mount (a retry reloads the page).
  const outcomeTrackedRef = useRef(false);
  useEffect(() => {
    if (status === 'reconnecting') {
      // A post-connect drop is its own signal (once per drop).
      if (!dropTrackedRef.current) {
        dropTrackedRef.current = true;
        track('whisperinghacker', 'voice_dropped', { usedTurn: hasTurn() });
      }
      // Ask the server to re-issue WebRTC roles so both sides rebuild the peer.
      if (!lostSentRef.current) {
        lostSentRef.current = true;
        socketRef.current?.emit(WhisperEvents.VoiceLost);
      }
    } else if (status === 'connected') {
      lostSentRef.current = false;
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
      const peer = peerRef.current;
      if (peer && !peer.destroyed) {
        try {
          peer.signal(p.signal);
        } catch {
          /* malformed / stale signal - ignore */
        }
      } else if (!peer) {
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let peer: any;
      try {
        await import('@/lib/peer-polyfill');
        const SimplePeer = (await import('simple-peer')).default;
        if (destroyed) return;
        peer = new SimplePeer({
          initiator,
          stream: localStream,
          trickle: true,
          config: { iceServers: iceServers() },
        });
      } catch (e) {
        // Import failure, constructor throw, or addTrack on an ended track —
        // surface a recoverable failure instead of an unhandled rejection.
        if (!destroyed) {
          setError(e instanceof Error ? e.message : 'voice setup failed');
          setStatus(connectedOnceRef.current ? 'reconnecting' : 'failed');
        }
        return;
      }
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
        if (peer.destroyed) return;
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
      queueRef.current = []; // a rebuild starts fresh — drop stale signals
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
    // `handshakeGen` bumps on every WebrtcInit (initial + re-handshakes): the
    // cleanup tears down the old peer and this effect rebuilds a fresh one.
  }, [socket, localStream, initiator, handshakeGen, clearTimer]);

  // Media-flow watchdog: ICE can stay 'connected' while inbound packets stop
  // (a stall that fires no ICE event). Poll getStats; if inbound audio bytes
  // flatline for ~10s, treat it as a drop so recovery (re-handshake) kicks in.
  useEffect(() => {
    if (status !== 'connected') return;
    let lastBytes = -1;
    let stalls = 0;
    const id = window.setInterval(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pc: any = peerRef.current?._pc;
      if (!pc?.getStats) return;
      pc.getStats()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then((stats: any) => {
          let bytes = -1;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          stats.forEach((r: any) => {
            if (r.type === 'inbound-rtp' && r.kind === 'audio') {
              bytes = typeof r.bytesReceived === 'number' ? r.bytesReceived : bytes;
            }
          });
          if (bytes < 0) return;
          if (lastBytes >= 0 && bytes === lastBytes) {
            stalls += 1;
            if (stalls >= 2 && statusRef.current === 'connected') {
              track('whisperinghacker', 'voice_stall');
              setStatus('reconnecting');
            }
          } else {
            stalls = 0;
          }
          lastBytes = bytes;
        })
        .catch(() => {});
    }, 5000);
    return () => window.clearInterval(id);
  }, [status]);

  const retry = useCallback(() => {
    // Prefer an in-place re-handshake (keeps the socket + run alive); only fall
    // back to a full reload if the socket is somehow gone.
    const s = socketRef.current;
    if (s) {
      lostSentRef.current = false;
      s.emit(WhisperEvents.VoiceLost);
    } else if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }, []);

  return { remoteStream, error, status, retry };
}
