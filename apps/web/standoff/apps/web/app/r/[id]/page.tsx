import type { Metadata } from 'next';
import Link from 'next/link';
import type { DuelResultRecord } from '@standoffduel/shared';
import { apiUrl } from '@/lib/api-url';

type Params = Promise<{ id: string | string[] }>;

function pick(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] ?? '' : v ?? '';
}

// Always fetch fresh: a result may not be persisted yet the instant its link is
// shared, and force-cache could pin that early 404 forever. Next still dedupes
// this between generateMetadata and the page render in the same request.
async function getRecord(id: string): Promise<DuelResultRecord | null> {
  if (!id) return null;
  try {
    const res = await fetch(`${apiUrl()}/results/${encodeURIComponent(id)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as DuelResultRecord;
  } catch {
    return null;
  }
}

function ogImage(rec: DuelResultRecord): string {
  const q = new URLSearchParams();
  if (rec.winnerName) q.set('w', rec.winnerName);
  if (rec.loserName) q.set('l', rec.loserName);
  if (rec.reactionMs != null) q.set('ms', String(rec.reactionMs));
  q.set('reason', rec.reason);
  if (rec.isTie) q.set('tie', '1');
  return `/api/og/result?${q.toString()}`;
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  const rec = await getRecord(pick(id));
  if (!rec) return { title: 'StandoffDuel - result not found' };

  const title = rec.isTie
    ? 'A dead-even standoff · StandoffDuel'
    : rec.winnerName
      ? `${rec.winnerName} won a StandoffDuel${
          rec.reactionMs != null ? ` in ${rec.reactionMs}ms` : ''
        }`
      : 'StandoffDuel result';
  const description = "The fastest draw on the internet wins. Think you're faster?";
  const images = [{ url: ogImage(rec), width: 1200, height: 630 }];

  return {
    title,
    description,
    openGraph: { title, description, type: 'website', images },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: images.map((i) => i.url),
    },
  };
}

export default async function ResultPermalinkPage({ params }: { params: Params }) {
  const { id } = await params;
  const rec = await getRecord(pick(id));

  return (
    <main className="relative z-10 flex min-h-[100dvh] flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <p className="font-impact text-xs uppercase tracking-[0.4em] text-ember">
        ★ Standoff Duel ★
      </p>

      {!rec ? (
        <>
          <h1 className="font-display text-4xl text-bone sm:text-5xl">
            This duel rode off into the sunset
          </h1>
          <p className="max-w-md text-sand/70">
            That result has expired or never existed. Start a fresh standoff and
            make your own headline.
          </p>
        </>
      ) : rec.isTie ? (
        <>
          <SheriffStar />
          <h1 className="font-display text-4xl text-bone sm:text-5xl">
            No blood spilled
          </h1>
          <p className="font-impact uppercase tracking-widest text-sand/70">
            Two guns · neither cleared leather
          </p>
        </>
      ) : (
        <>
          <SheriffStar />
          <h1 className="font-display break-words text-5xl text-ember sm:text-6xl">
            {rec.winnerName ?? 'The Stranger'}
          </h1>
          <p className="font-impact uppercase tracking-widest text-sand/70">
            {loserLine(rec)}
          </p>
          {rec.reactionMs != null && (
            <p className="font-impact text-2xl uppercase tracking-wider text-gold">
              Drew in <span className="text-3xl">{rec.reactionMs} ms</span>
            </p>
          )}
        </>
      )}

      <Link
        href="/"
        className="mt-4 inline-flex items-center justify-center rounded-sm border-2 border-ember bg-ember px-8 py-4 font-impact text-xl uppercase tracking-wider text-night shadow-[0_4px_0_0_#7c1d12] transition hover:border-gold hover:bg-gold active:translate-y-px"
      >
        Duel someone →
      </Link>
      <p className="text-xs uppercase tracking-widest text-sand/40">
        The fastest draw on the internet wins
      </p>
    </main>
  );
}

function loserLine(rec: DuelResultRecord): string {
  if (rec.reason === 'false_start')
    return rec.loserName ? `${rec.loserName} jumped the gun` : 'Jumped the gun';
  if (rec.reason === 'opponent_left')
    return rec.loserName ? `${rec.loserName} fled town` : 'The outlaw fled town';
  return rec.loserName ? `Out-drew ${rec.loserName}` : 'Fastest gun in the west';
}

function SheriffStar() {
  return (
    <svg width={64} height={64} viewBox="0 0 100 100" aria-hidden>
      <polygon
        points="50,4 60.6,35.4 93.8,35.8 67.1,55.6 77,87.2 50,68 23,87.2 32.9,55.6 6.2,35.8 39.4,35.4"
        fill="#d8a13a"
      />
      <circle cx="50" cy="49" r="8.5" fill="none" stroke="#0c0a09" strokeWidth="3" />
    </svg>
  );
}
