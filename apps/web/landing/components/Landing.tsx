'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  generateLobbyId,
  isValidLobbyId,
  normalizeLobbyId,
} from '@shadyexperiments/shared';
import { useWebcam } from '@/hooks/useWebcam';
import { Button } from '@/components/ui/Button';

// The sun-bleached paper of the wanted poster, shared by every plate.
const PAPER = { background: 'linear-gradient(160deg,#ece0c2,#cdba8f)' } as const;

export function Landing() {
  const router = useRouter();
  const { stream, error } = useWebcam(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [name, setName] = useState('');
  const [joinId, setJoinId] = useState('');
  const [joinErr, setJoinErr] = useState<string | null>(null);
  const [bo3, setBo3] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (v && stream) {
      v.srcObject = stream;
      v.play().catch(() => {});
    }
  }, [stream]);

  useEffect(() => {
    const stored = localStorage.getItem('sd_name');
    if (stored) setName(stored);
  }, []);

  const remember = (n: string) => {
    setName(n);
    localStorage.setItem('sd_name', n.trim().slice(0, 24));
  };

  const go = (id: string, bo = false) => {
    if (name.trim()) localStorage.setItem('sd_name', name.trim().slice(0, 24));
    router.push(bo ? `/standoff/lobby/${id}?bo=3` : `/standoff/lobby/${id}`);
  };

  const create = () => go(generateLobbyId(), bo3);

  const join = () => {
    const id = normalizeLobbyId(joinId);
    if (!isValidLobbyId(id)) {
      setJoinErr('Try a code like OUTLAW-42');
      return;
    }
    go(id);
  };

  // The poster's name plate reads back the outlaw you're naming, live.
  const wantedName = (name.trim() || 'The Stranger').toUpperCase();

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* The town itself: a western street at dusk, dimmed by a flat black veil
          (below) so the copy stays legible over it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/standoff/standoff_bg.png)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'rgba(12,10,9,0.6)' }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col items-center gap-10 px-6 py-12 lg:flex-row lg:gap-16 lg:py-0">
        {/* Pitch + saloon doors */}
        <section className="flex-1 text-center lg:text-left">
          <p className="font-impact text-sm uppercase tracking-[0.4em] text-ember">
            High noon, anywhere
          </p>
          <h1 className="font-western mt-3 text-5xl leading-none text-bone sm:text-6xl lg:text-7xl">
            Standoff
            <span className="block text-ember">Duel</span>
          </h1>
          <p className="mx-auto mt-5 max-w-md text-lg text-sand/80 lg:mx-0">
            Two webcams. One draw. Lock eyes with your rival, wait for the signal,
            and be the fastest hand on the internet.
          </p>

          <div className="mx-auto mt-8 max-w-md space-y-4 lg:mx-0">
            <label className="block text-left">
              <span className="font-impact text-xs uppercase tracking-widest text-sand/60">
                Your outlaw name
              </span>
              <input
                value={name}
                onChange={(e) => remember(e.target.value)}
                maxLength={24}
                placeholder="The Stranger"
                className="mt-2 w-full rounded-sm border-2 border-dust bg-charcoal/80 px-4 py-3 text-lg text-bone outline-none placeholder:text-sand/30 focus:border-ember"
              />
            </label>

            <Button size="lg" onClick={create} className="w-full">
              Create a duel →
            </Button>

            <div className="flex items-center gap-4 py-1 font-impact text-[11px] uppercase tracking-[0.3em] text-sand/40">
              <span className="h-px flex-1 bg-dust" />
              or answer a call-out
              <span className="h-px flex-1 bg-dust" />
            </div>

            <div className="flex gap-2">
              <input
                value={joinId}
                onChange={(e) => {
                  setJoinId(e.target.value);
                  setJoinErr(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && join()}
                placeholder="OUTLAW-42"
                className="w-full rounded-sm border-2 border-dust bg-charcoal/80 px-4 py-3 font-impact uppercase tracking-wider text-bone outline-none placeholder:text-sand/30 focus:border-ember"
              />
              <Button variant="ghost" onClick={join}>
                Join
              </Button>
            </div>
            {joinErr && <p className="text-left text-sm text-rust">{joinErr}</p>}

            <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-sand/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
              <input
                type="checkbox"
                checked={bo3}
                onChange={(e) => setBo3(e.target.checked)}
                className="h-4 w-4 accent-ember"
              />
              Best of 3
              <span className="text-sand/65">
                (first to two draws takes the match)
              </span>
            </label>
          </div>
        </section>

        {/* The wanted poster: same paper, plate and framing as the duel itself */}
        <section className="w-full max-w-sm flex-1">
          <div className="relative mx-auto w-full max-w-[340px] rotate-[1.5deg] border-[3px] border-[#2a1f15] shadow-2xl">
            <div
              className="border-b-2 border-[#2a1f15] py-2 text-center"
              style={PAPER}
            >
              <div className="font-western text-4xl leading-none text-[#241a11]">
                Wanted
              </div>
              <div className="mt-1 font-impact text-[11px] uppercase tracking-[0.34em] text-[#5a4327]">
                Dead or Alive
              </div>
            </div>

            <div className="relative aspect-[4/5] overflow-hidden border-x-[9px] border-[#cdba8f] bg-charcoal">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="h-full w-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />
              <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/40" />
              {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-night/70 p-6 text-center text-sand/80">
                  <p>
                    Camera blocked.
                    <br />
                    Allow access to step into the street.
                  </p>
                </div>
              )}
              {!stream && !error && (
                <div className="absolute inset-0 flex items-center justify-center bg-charcoal text-sand/50">
                  Warming up the lens…
                </div>
              )}
            </div>

            <div
              className="border-t-2 border-[#2a1f15] px-3 py-3 text-center"
              style={PAPER}
            >
              <div className="truncate font-western text-2xl leading-none text-[#241a11]">
                {wantedName}
              </div>
              <div className="mt-1.5 font-impact text-[11px] uppercase tracking-[0.26em] text-[#5a4327]">
                $500 reward · fastest hand
              </div>
            </div>
          </div>
          <p className="mt-4 text-center font-impact text-xs uppercase tracking-widest text-sand/40">
            Live preview · stays on your device until a duel begins
          </p>
        </section>
      </div>
    </main>
  );
}
