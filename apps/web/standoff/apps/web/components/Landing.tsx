'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  generateLobbyId,
  isValidLobbyId,
  normalizeLobbyId,
} from '@standoffduel/shared';
import { useWebcam } from '@/hooks/useWebcam';
import { Button } from '@/components/ui/Button';

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
    router.push(bo ? `/lobby/${id}?bo=3` : `/lobby/${id}`);
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

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col items-center gap-10 px-6 py-12 lg:flex-row lg:gap-16 lg:py-0">
      {/* Pitch */}
      <section className="flex-1 text-center lg:text-left">
        <p className="font-impact text-sm uppercase tracking-[0.4em] text-ember">
          High noon, anywhere
        </p>
        <h1 className="font-display mt-3 text-5xl leading-none text-bone sm:text-6xl lg:text-7xl">
          Standoff
          <span className="block text-ember">Duel</span>
        </h1>
        <p className="mt-5 max-w-md text-lg text-sand/80 lg:mx-0 mx-auto">
          Two webcams. One draw. Lock eyes with your rival, wait for the signal,
          and be the fastest hand on the internet.
        </p>

        <div className="mt-8 space-y-5">
          <label className="block">
            <span className="font-impact text-xs uppercase tracking-widest text-sand/60">
              Your outlaw name
            </span>
            <input
              value={name}
              onChange={(e) => remember(e.target.value)}
              maxLength={24}
              placeholder="The Stranger"
              className="mt-2 w-full max-w-sm rounded-sm border-2 border-dust bg-charcoal/80 px-4 py-3 text-lg text-bone outline-none placeholder:text-sand/30 focus:border-ember"
            />
          </label>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <Button size="lg" onClick={create} className="sm:flex-1">
              Create a duel
            </Button>
            <div className="flex gap-2 sm:flex-1">
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
          </div>
          {joinErr && <p className="text-sm text-rust">{joinErr}</p>}

          <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-sand/70">
            <input
              type="checkbox"
              checked={bo3}
              onChange={(e) => setBo3(e.target.checked)}
              className="h-4 w-4 accent-ember"
            />
            Best of 3
            <span className="text-sand/40">
              — first to two draws takes the match
            </span>
          </label>
        </div>
      </section>

      {/* Webcam "wanted poster" */}
      <section className="w-full max-w-sm flex-1">
        <div className="relative mx-auto aspect-[3/4] w-full overflow-hidden rounded border-4 border-dust bg-charcoal shadow-2xl">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
          <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/40" />
          <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent p-3 text-center">
            <span className="font-display text-lg text-bone">WANTED</span>
          </div>
          {error && (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sand/80">
              <p>
                Camera blocked.
                <br />
                Allow access to step into the street.
              </p>
            </div>
          )}
          {!stream && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-sand/50">
              Warming up the lens…
            </div>
          )}
        </div>
        <p className="mt-3 text-center text-xs uppercase tracking-widest text-sand/40">
          Live preview · stays on your device until a duel begins
        </p>
      </section>
    </main>
  );
}
