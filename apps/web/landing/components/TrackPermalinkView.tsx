"use client";

import { useEffect } from "react";
import { track } from "@/lib/track";

// Fires on the shared result permalink (/standoff/r/<id>) to measure the viral
// loop. `found` distinguishes live links from dead/expired ones.
export function TrackPermalinkView({
  resultId,
  found,
}: {
  resultId: string;
  found: boolean;
}) {
  useEffect(() => {
    track("standoff", "result_permalink_view", { resultId, found });
  }, [resultId, found]);
  return null;
}
