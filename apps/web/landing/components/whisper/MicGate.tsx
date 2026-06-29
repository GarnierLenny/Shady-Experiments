'use client';

import type { MicErrorKind } from '@/hooks/useMic';

const micErrorCopy: Record<
  MicErrorKind,
  { title: string; steps: string; cta: string }
> = {
  denied: {
    title: 'MIC BLOCKED',
    steps:
      "Click the mic icon in your browser's address bar, choose Allow, then retry. No voice, no mission.",
    cta: "I've allowed it",
  },
  notfound: {
    title: 'NO MIC FOUND',
    steps:
      'Plug in or switch on a microphone, then retry. The whole game is talking to each other.',
    cta: 'Retry',
  },
  inuse: {
    title: 'MIC IS BUSY',
    steps:
      'Another app (Zoom, Meet, another tab) is holding your microphone. Close it, then retry.',
    cta: 'Retry',
  },
  other: {
    title: 'MIC UNAVAILABLE',
    steps: 'Something stopped the microphone from starting. Retry, or switch browsers.',
    cta: 'Retry',
  },
};

/** Recoverable mic-error panel, terminal-styled. */
export function MicGate({
  kind,
  onRetry,
}: {
  kind: MicErrorKind;
  onRetry: () => void;
}) {
  const c = micErrorCopy[kind];
  return (
    <div className="mx-auto max-w-md border border-denied/60 bg-terminal-panel/80 p-6 text-center">
      <p className="font-terminal text-xl text-denied crt-glow">{c.title}</p>
      <p className="mt-3 text-sm leading-snug text-phosphor/70">{c.steps}</p>
      <button
        onClick={onRetry}
        className="mt-4 border border-phosphor-dim px-4 py-2 font-terminal text-sm uppercase tracking-widest text-phosphor transition-colors hover:bg-phosphor hover:text-terminal"
      >
        {c.cta}
      </button>
    </div>
  );
}
