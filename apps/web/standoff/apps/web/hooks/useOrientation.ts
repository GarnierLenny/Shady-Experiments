'use client';

import { useEffect, useState } from 'react';

export type Orientation = 'landscape' | 'portrait';

/**
 * Tracks viewport orientation so the duel can stack the players top/bottom on
 * portrait phones instead of squeezing them into unreadable side-by-side
 * slivers. Defaults to landscape (the duel page is client-only, so there's no
 * SSR mismatch to worry about).
 */
export function useOrientation(): Orientation {
  const [orientation, setOrientation] = useState<Orientation>('landscape');

  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait)');
    const update = () => setOrientation(mq.matches ? 'portrait' : 'landscape');
    update();
    mq.addEventListener('change', update);
    window.addEventListener('resize', update);
    return () => {
      mq.removeEventListener('change', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return orientation;
}
