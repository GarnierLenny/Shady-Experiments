'use client';

import { useEffect, useRef, useState } from 'react';
import type { CinematicPhase } from '@/hooks/useDuel';

/** First MediaRecorder mime the browser actually supports, or null if none. */
function pickMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ];
  for (const m of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch {
      /* ignore */
    }
  }
  return null;
}

/**
 * Records the composited duel canvas from the DRAW signal through the showdown
 * topple into a short clip - the moment worth sharing. Pure client capture via
 * `captureStream` + `MediaRecorder`, so it needs no server or storage. Video
 * only (the gunshot/thud run through a separate audio graph); creators add
 * their own sound anyway, and the visual beat is the hook.
 *
 * Degrades to `null` where MediaRecorder/canvas capture is unavailable (older
 * Safari), in which case the UI simply omits the "share clip" affordance.
 */
export function useDuelClip(
  canvas: HTMLCanvasElement | null,
  phase: CinematicPhase,
): Blob | null {
  const [clip, setClip] = useState<Blob | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Clear last round's clip as a fresh duel begins.
  useEffect(() => {
    if (phase === 'idle' || phase === 'zoom') setClip(null);
  }, [phase]);

  useEffect(() => {
    if (!canvas) return;

    if (phase === 'draw' && !recRef.current) {
      const mime = pickMime();
      if (!mime) return;
      let stream: MediaStream;
      try {
        stream = canvas.captureStream(30);
      } catch {
        return; // capture unsupported - no clip this round
      }
      let rec: MediaRecorder;
      try {
        rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
      } catch {
        return;
      }
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mime });
        chunksRef.current = [];
        if (blob.size) setClip(blob);
      };
      try {
        rec.start();
        recRef.current = rec;
      } catch {
        /* ignore */
      }
    } else if (recRef.current && phase !== 'draw' && phase !== 'showdown') {
      // Finalize on the result screen - or tear down if the duel was aborted
      // back to the lobby, so the recorder can't leak onto a detached canvas
      // and block every subsequent round.
      try {
        if (recRef.current.state !== 'inactive') recRef.current.stop();
      } catch {
        /* ignore */
      }
      recRef.current = null;
    }
  }, [phase, canvas]);

  // Safety: stop a dangling recorder on unmount.
  useEffect(
    () => () => {
      try {
        if (recRef.current && recRef.current.state !== 'inactive') {
          recRef.current.stop();
        }
      } catch {
        /* ignore */
      }
      recRef.current = null;
    },
    [],
  );

  return clip;
}
