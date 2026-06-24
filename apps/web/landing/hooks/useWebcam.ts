'use client';

import { useCallback, useEffect, useState } from 'react';
import { track } from '@/lib/track';

export type WebcamErrorKind = 'denied' | 'notfound' | 'inuse' | 'other';

export interface WebcamState {
  stream: MediaStream | null;
  error: string | null;
  errorKind: WebcamErrorKind | null;
  ready: boolean;
  /** Re-attempt acquisition (e.g. after the user grants permission). */
  retry: () => void;
}

function classifyError(e: unknown): WebcamErrorKind {
  const name = e instanceof Error ? e.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'notfound';
  if (name === 'NotReadableError' || name === 'AbortError') return 'inuse';
  return 'other';
}

// Track each camera-permission outcome at most once per page load (survives
// client navigations). Both can fire in one session: a deny then a grant after
// retry = a recovered user, which is exactly what the error UX aims to produce.
const tracked = { granted: false, denied: false };

/** Acquire the local webcam once and tear it down on unmount. */
export function useWebcam(active = true): WebcamState {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<WebcamErrorKind | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let local: MediaStream | null = null;

    navigator.mediaDevices
      ?.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
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
          track('standoff', 'webcam_granted');
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Could not access the camera.');
        setErrorKind(classifyError(e));
        if (!tracked.denied) {
          tracked.denied = true;
          track('standoff', 'webcam_denied', {
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
