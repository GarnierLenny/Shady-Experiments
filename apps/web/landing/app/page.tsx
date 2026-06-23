"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSubjectId } from "@/hooks/useSubjectId";

const STEP_MS = 30;

export default function Home() {
  const subject = useSubjectId();
  const [count, setCount] = useState(0);
  const [done, setDone] = useState(false);

  // The transmission. Built only once the subject number is known.
  const text =
    subject == null
      ? ""
      : `Sujet #${subject}.\n\nTu n'étais pas censé être ici.\n\nLes expériences ne sont pas encore toutes accessibles.\nRevenez quand vous y serez invité.\n\n— L.`;

  // Red range covers "#XXXXX": "Sujet " is 6 chars, then '#' + the digits.
  const redStart = 6;
  const redEnd = subject == null ? 6 : 7 + String(subject).length;

  useEffect(() => {
    if (!text) return;
    setCount(0);
    setDone(false);
    let i = 0;
    const timer = setInterval(() => {
      i += 1;
      setCount(i);
      if (i >= text.length) {
        clearInterval(timer);
        setDone(true);
      }
    }, STEP_MS);
    return () => clearInterval(timer);
  }, [text]);

  const before = text.slice(0, Math.min(count, redStart));
  const red = text.slice(redStart, Math.min(count, redEnd));
  const after = count > redEnd ? text.slice(redEnd, count) : "";

  return (
    <main className="flex min-h-screen flex-col bg-paper text-ink">
      <div className="flex flex-1 items-center justify-center px-6">
        <p className="w-full max-w-md whitespace-pre-wrap text-[13px] leading-relaxed">
          {before}
          <span className="text-alert">{red}</span>
          {after}
          <span className="cursor">|</span>
        </p>
      </div>

      <div className="flex justify-center px-6 pb-10">
        {done && (
          <Link
            href="/standoff"
            className="reveal text-[13px] text-muted transition-colors hover:text-ink"
          >
            [ Exp&eacute;rience #001 en cours &rarr; ]
          </Link>
        )}
      </div>
    </main>
  );
}
