'use client';

import { useEffect } from 'react';
import { track } from '@/lib/track';

// Fires on the shared run permalink to measure the viral loop. `found`
// distinguishes live links from dead/expired ones. Whisper's own tracker so
// events land under the right app (vs Standoff's TrackPermalinkView).
export function TrackRunView({
  resultId,
  found,
}: {
  resultId: string;
  found: boolean;
}) {
  useEffect(() => {
    track('whisperinghacker', 'result_permalink_view', { resultId, found });
  }, [resultId, found]);
  return null;
}
