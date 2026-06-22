'use client';

import { useEffect, useState } from 'react';

export interface WebcamState {
  stream: MediaStream | null;
  error: string | null;
  ready: boolean;
}

/** Acquire the local webcam once and tear it down on unmount. */
export function useWebcam(active = true): WebcamState {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let local: MediaStream | null = null;

    navigator.mediaDevices
      ?.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280}, height: { ideal: 720 } },
        audio: false,
      })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        local = s;
        setStream(s);
      })
      .catch((e: unknown) => {
        setError(
          e instanceof Error ? e.message : 'Could not access the camera.',
        );
      });

    return () => {
      cancelled = true;
      local?.getTracks().forEach((t) => t.stop());
    };
  }, [active]);

  return { stream, error, ready: !!stream };
}
