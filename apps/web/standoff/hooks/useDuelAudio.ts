'use client';

import { useEffect, useState } from 'react';
import { AudioEngine } from '@/lib/audioEngine';

/** Provides the duel's audio engine, created on mount and disposed on unmount. */
export function useDuelAudio(): AudioEngine | null {
  const [engine, setEngine] = useState<AudioEngine | null>(null);

  useEffect(() => {
    const e = new AudioEngine();
    setEngine(e);
    return () => e.dispose();
  }, []);

  return engine;
}
