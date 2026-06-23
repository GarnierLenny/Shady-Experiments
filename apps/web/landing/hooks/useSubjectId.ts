"use client";

import { useEffect, useState } from "react";
import { readSubjectId } from "@/lib/subject";

// Returns null on the server and first client render (so markup matches and
// there is no hydration mismatch), then the persisted subject number.
export function useSubjectId(): number | null {
  const [id, setId] = useState<number | null>(null);
  useEffect(() => {
    setId(readSubjectId());
  }, []);
  return id;
}
