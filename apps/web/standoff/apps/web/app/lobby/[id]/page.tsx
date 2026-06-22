import type { Metadata } from 'next';
import { normalizeLobbyId } from '@standoffduel/shared';
import { LobbyClient } from './LobbyClient';

type Params = Promise<{ id: string | string[] }>;
type Search = Promise<{ [key: string]: string | string[] | undefined }>;

function pick(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] ?? '' : v ?? '';
}

// Server-rendered metadata so a shared lobby link gets a personalized preview
// ("<name> challenges you to a duel"). The interactive room itself is the
// client-only <LobbyClient>.
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}): Promise<Metadata> {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const code = normalizeLobbyId(pick(id));
  const by = pick(sp.by).slice(0, 24);

  const img = `/api/og/invite?code=${encodeURIComponent(code)}${
    by ? `&by=${encodeURIComponent(by)}` : ''
  }`;
  const title = by
    ? `${by} challenges you to a duel`
    : "You've been challenged to a duel";
  const description =
    'Two webcams. One draw. Lock eyes, wait for the signal, be the fastest gun on the internet.';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: [{ url: img, width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [img] },
  };
}

export default async function LobbyPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const lobbyId = normalizeLobbyId(pick(id));
  const bestOf = pick(sp.bo) === '3' ? 3 : 1;
  return <LobbyClient lobbyId={lobbyId} bestOf={bestOf} />;
}
