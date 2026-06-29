'use client';

import { useCallback, useEffect, useState } from 'react';
import { track } from '@/lib/track';

export type MicErrorKind = 'denied' | 'notfound' | 'inuse' | 'other';

export interface MicState {
  stream: MediaStream | null;
  error: string | null;
  errorKind: MicErrorKind | null;
  ready: boolean;
  retry: () => void;
}

function classifyError(e: unknown): MicErrorKind {
  const name = e instanceof Error ? e.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'notfound';
  if (name === 'NotReadableError' || name === 'AbortError') return 'inuse';
  return 'other';
}

const tracked = { granted: false, denied: false };

/**
 * Acquire the local microphone once and tear it down on unmount. Audio-only
 * sibling of `useWebcam`, with echo cancellation/noise suppression on so the
 * *game's* degradation is the only distortion players hear.
 */
export function useMic(active = true): MicState {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<MicErrorKind | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let local: MediaStream | null = null;

    navigator.mediaDevices
      ?.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        local = s;
        setStream(s);
        setError(null);
        setErrorKind(null);
        if (!tracked.granted) {
          tracked.granted = true;
          track('whisperinghacker', 'mic_granted');
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Could not access the microphone.');
        setErrorKind(classifyError(e));
        if (!tracked.denied) {
          tracked.denied = true;
          track('whisperinghacker', 'mic_denied', {
            reason: e instanceof Error ? e.name : 'unknown',
          });
        }
      });

    return () => {
      cancelled = true;
      local?.getTracks().forEach((t) => t.stop());
    };
  }, [active, attempt]);

  const retry = useCallback(() => {
    setError(null);
    setErrorKind(null);
    setAttempt((n) => n + 1);
  }, []);

  return { stream, error, errorKind, ready: !!stream, retry };
}
