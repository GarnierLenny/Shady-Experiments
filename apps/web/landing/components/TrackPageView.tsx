"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { track } from "@/lib/track";

// Fires one `page_view` per route, tagging the app by path subtree. Mounted once
// in the root layout so it covers the root `/` and every `/standoff*` route.
export function TrackPageView() {
  const pathname = usePathname();
  useEffect(() => {
    const app = pathname?.startsWith("/standoff") ? "standoff" : "landing";
    track(app, "page_view");
  }, [pathname]);
  return null;
}
