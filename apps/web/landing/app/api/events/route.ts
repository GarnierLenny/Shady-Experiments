import { NextResponse, type NextRequest } from "next/server";
import type { TrackEventInput } from "@shadyexperiments/shared";
import { prisma, Prisma } from "@shadyexperiments/db";

// Prisma needs the Node runtime, not Edge.
export const runtime = "nodejs";

const MAX_BATCH = 50;

export async function POST(req: NextRequest) {
  let body: TrackEventInput | TrackEventInput[];
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const items = Array.isArray(body) ? body : [body];
  if (items.length === 0 || items.length > MAX_BATCH) {
    return NextResponse.json(
      { error: `expected 1..${MAX_BATCH} events` },
      { status: 400 },
    );
  }
  if (items.some((e) => !e?.app || !e?.name)) {
    return NextResponse.json(
      { error: "each event needs `app` and `name`" },
      { status: 400 },
    );
  }

  // Server-stamped context (don't trust the client for these).
  const userAgent = req.headers.get("user-agent");
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const data = items.map((e) => ({
    app: e.app,
    name: e.name,
    subjectId: e.subjectId ?? null,
    sessionId: e.sessionId ?? null,
    props: (e.props ?? {}) as Prisma.InputJsonValue,
    path: e.path ?? null,
    referrer: e.referrer ?? null,
    userAgent,
    ip,
  }));

  try {
    await prisma.event.createMany({ data });
  } catch {
    return NextResponse.json({ error: "insert failed" }, { status: 500 });
  }
  return new NextResponse(null, { status: 204 });
}
