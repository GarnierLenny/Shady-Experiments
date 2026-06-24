'use client';

import type { WebcamErrorKind } from '@/hooks/useWebcam';

export const webcamErrorCopy: Record<
  WebcamErrorKind,
  { title: string; steps: string; cta: string }
> = {
  denied: {
    title: 'Camera blocked',
    steps:
      "Click the camera icon in your browser's address bar, choose Allow, then try again.",
    cta: "I've allowed it",
  },
  notfound: {
    title: 'No camera found',
    steps:
      'Plug in or switch on a webcam, then try again. A duel needs your face in the frame.',
    cta: 'Try again',
  },
  inuse: {
    title: 'Camera is busy',
    steps:
      'Another app (Zoom, Meet, another tab) is holding your camera. Close it, then try again.',
    cta: 'Try again',
  },
  other: {
    title: 'Camera unavailable',
    steps: 'Something stopped the camera from starting. Try again, or switch browsers.',
    cta: 'Try again',
  },
};

/** Tailored, recoverable webcam-error overlay. Fills its positioned parent. */
export function WebcamError({
  kind,
  onRetry,
}: {
  kind: WebcamErrorKind;
  onRetry: () => void;
}) {
  const c = webcamErrorCopy[kind];
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-night/85 p-5 text-center">
      <p className="font-western text-xl text-bone">{c.title}</p>
      <p className="max-w-[15rem] text-[13px] leading-snug text-sand/75">{c.steps}</p>
      <button
        onClick={onRetry}
        className="mt-1 rounded-sm border-2 border-ember px-4 py-1.5 font-impact text-sm uppercase tracking-widest text-ember transition-colors hover:bg-ember hover:text-night"
      >
        {c.cta}
      </button>
    </div>
  );
}
