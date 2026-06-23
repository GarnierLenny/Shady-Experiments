"use client";

import { useSubjectId } from "@/hooks/useSubjectId";

export function SubjectTag() {
  const id = useSubjectId();
  return (
    <span className="text-[11px] tracking-[0.08em] text-muted">
      SUJET #{id ?? "·····"}
    </span>
  );
}
