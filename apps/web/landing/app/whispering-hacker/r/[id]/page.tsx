import type { Metadata } from 'next';
import Link from 'next/link';
import type { WhisperResultRecord } from '@shadyexperiments/shared';
import { apiUrl } from '@/lib/api-url';
import { TrackRunView } from '@/components/whisper/TrackRunView';

type Params = Promise<{ id: string | string[] }>;

function pick(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v[0] ?? '' : v ?? '';
}

function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

// Always fetch fresh: a result may not be persisted yet the instant its link is
// shared, and force-cache could pin that early 404 forever.
async function getRecord(id: string): Promise<WhisperResultRecord | null> {
  if (!id) return null;
  try {
    const res = await fetch(`${apiUrl()}/whisper-results/${encodeURIComponent(id)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as WhisperResultRecord;
  } catch {
    return null;
  }
}

function ogImage(rec: WhisperResultRecord): string {
  const q = new URLSearchParams();
  q.set('t', fmt(rec.elapsedMs));
  q.set('n', String(rec.puzzlesSolved));
  if (rec.hackerName) q.set('h', rec.hackerName);
  if (rec.operatorName) q.set('o', rec.operatorName);
  return `/whispering-hacker/api/og/result?${q.toString()}`;
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  const rec = await getRecord(pick(id));
  if (!rec) return { title: 'Whispering Hacker, run not found' };

  const title = `Breached in ${fmt(rec.elapsedMs)} · Whispering Hacker`;
  const description =
    'Two operatives, one terrible voice line, mission complete. Think you can do it faster?';
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

export default async function RunPermalinkPage({ params }: { params: Params }) {
  const { id } = await params;
  const rec = await getRecord(pick(id));

  return (
    <main className="relative z-10 flex min-h-[100dvh] flex-col items-center justify-center gap-5 px-6 py-16 text-center">
      <TrackRunView resultId={pick(id)} found={!!rec} />
      <p className="font-terminal text-xs uppercase tracking-[0.4em] text-phosphor-dim">
        ▚ Whispering Hacker
      </p>

      {!rec ? (
        <>
          <h1 className="font-terminal text-4xl text-phosphor crt-glow sm:text-5xl">
            Signal lost
          </h1>
          <p className="max-w-md text-phosphor/70">
            That run has expired or never existed. Open a fresh room and breach it
            yourself.
          </p>
        </>
      ) : (
        <>
          <h1 className="font-terminal text-5xl text-phosphor crt-glow sm:text-6xl">
            ACCESS GRANTED
          </h1>
          <p className="font-terminal uppercase tracking-[0.3em] text-phosphor/70">
            {(rec.hackerName ?? 'A hacker')} &amp; {(rec.operatorName ?? 'an operator')}{' '}
            breached the node
          </p>
          <div className="mt-2 border border-phosphor-dim bg-terminal-panel/70 px-8 py-5">
            <p className="text-[11px] uppercase tracking-[0.3em] text-phosphor-dim">
              Completion time
            </p>
            <p className="mt-1 font-terminal text-4xl tabular-nums text-phosphor crt-glow">
              {fmt(rec.elapsedMs)}
            </p>
          </div>
        </>
      )}

      <Link
        href="/whispering-hacker"
        className="mt-3 inline-block border border-phosphor bg-phosphor px-8 py-4 font-terminal text-lg uppercase tracking-widest text-terminal transition-colors hover:bg-phosphor-bright"
      >
        Run it with a friend →
      </Link>
      <p className="text-[11px] uppercase tracking-[0.3em] text-phosphor/40">
        You can only talk by voice. Good luck.
      </p>
    </main>
  );
}
