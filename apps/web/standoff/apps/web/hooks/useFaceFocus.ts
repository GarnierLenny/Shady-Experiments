'use client';

import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { loadPoseLandmarker } from '@/lib/mediapipe';

export interface EyeFocus {
  /** Normalized [0..1] focal point to zoom toward. */
  x: number;
  y: number;
  /** Eye separation (normalized) - a proxy for face size / distance. */
  scale: number;
  found: boolean;
}

// Pose landmark indices around both eyes (1–6). Robust seated or standing back.
const EYE_INDICES = [1, 2, 3, 4, 5, 6];

/**
 * Tracks the centroid of the eyes in a video and exposes it via a ref (no
 * re-renders) so the cinematic canvas can push in on exactly the right spot.
 * Runs only while `active` (the zoom/dezoom phases) to save the GPU.
 */
export function useFaceFocus(
  video: HTMLVideoElement | null,
  active: boolean,
  key = 'default',
): MutableRefObject<EyeFocus> {
  const focus = useRef<EyeFocus>({ x: 0.5, y: 0.35, scale: 0.07, found: false });

  useEffect(() => {
    if (!video || !active) return;
    let raf = 0;
    let stopped = false;
    let lastVideoTime = -1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let landmarker: any = null;

    (async () => {
      try {
        landmarker = await loadPoseLandmarker(key);
      } catch {
        return; // fall back to the default centered focus
      }
      if (stopped) return;

      const loop = () => {
        if (stopped) return;
        raf = requestAnimationFrame(loop);
        if (video.readyState < 2 || video.currentTime === lastVideoTime) return;
        lastVideoTime = video.currentTime;

        let result;
        try {
          result = landmarker.detectForVideo(video, performance.now());
        } catch {
          return;
        }
        const lm = result?.landmarks?.[0];
        if (!lm) return;

        let sx = 0;
        let sy = 0;
        for (const i of EYE_INDICES) {
          sx += lm[i].x;
          sy += lm[i].y;
        }
        const x = sx / EYE_INDICES.length;
        const y = sy / EYE_INDICES.length;
        const eyeDist = Math.hypot(lm[2].x - lm[5].x, lm[2].y - lm[5].y) || 0.07;
        // Snap to the eyes on first lock, then smooth to avoid jitter.
        focus.current = focus.current.found
          ? {
              x: focus.current.x * 0.7 + x * 0.3,
              y: focus.current.y * 0.7 + y * 0.3,
              scale: focus.current.scale * 0.7 + eyeDist * 0.3,
              found: true,
            }
          : { x, y, scale: eyeDist, found: true };
      };
      raf = requestAnimationFrame(loop);
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [video, active, key]);

  return focus;
}
