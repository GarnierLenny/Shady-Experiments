"use client";

import type { AnalyticsApp, TrackEventInput } from "@shadyexperiments/shared";
import { readSubjectId } from "@/lib/subject";

const SESSION_KEY = "se.session";

// Per-tab session id: stable within a tab, new on a fresh tab/reload.
function getSessionId(): string {
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    window.sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return "anon";
  }
}

/**
 * Fire an analytics event. Best-effort and non-blocking — never throws, never
 * awaited. Uses sendBeacon so events survive page unloads/navigations.
 */
export function track(
  app: AnalyticsApp,
  name: string,
  props?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;

  const payload: TrackEventInput = {
    app,
    name,
    subjectId: String(readSubjectId()),
    sessionId: getSessionId(),
    props,
    path: window.location.pathname,
    referrer: document.referrer || undefined,
  };
  const body = JSON.stringify(payload);

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/events",
        new Blob([body], { type: "application/json" }),
      );
      return;
    }
  } catch {
    // fall through to fetch
  }
  void fetch("/api/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}
