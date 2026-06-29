import type { Metadata } from 'next';
import { normalizeRoomId } from '@shadyexperiments/shared';
import { RoomClient } from './RoomClient';

type Params = Promise<{ id: string | string[] }>;
type Search = Promise<{ [key: string]: string | string[] | undefined }>;

function pick(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] ?? '' : v ?? '';
}

// Server-rendered metadata so a shared room link gets a personalized preview.
// The interactive room itself is the client-only <RoomClient>.
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}): Promise<Metadata> {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const code = normalizeRoomId(pick(id));
  const by = pick(sp.by).slice(0, 24);

  const title = by
    ? `${by} needs a second operative`
    : 'You’ve been recruited for a hack';
  const description = `Join room ${code}. One of you drives the terminal, the other reads the manual — and you can only talk by voice.`;

  return {
    title,
    description,
    openGraph: { title, description, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function RoomPage({ params }: { params: Params }) {
  const { id } = await params;
  const roomId = normalizeRoomId(pick(id));
  return <RoomClient roomId={roomId} />;
}
