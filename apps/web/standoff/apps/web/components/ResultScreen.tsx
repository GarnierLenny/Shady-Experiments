'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DuelResult, PublicPlayer, ReactionOutcome } from '@standoffduel/shared';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { TableDressing } from '@/components/TableDressing';
import { woodBackgroundStyle } from '@/lib/wood';
import { renderShareCard, shareOrDownload } from '@/lib/share-card';

interface ResultScreenProps {
  result: DuelResult;
  selfId: string | null;
  players: PublicPlayer[];
  lobbyId: string;
  onRematch: () => void;
  winnerPhoto: string | null;
  loserPhoto: string | null;
  clip?: Blob | null;
}

const PARCHMENT = 'radial-gradient(120% 120% at 50% 0%, #f2e6c6, #d8c194 60%, #bea66f)';
const NEWSPRINT = 'linear-gradient(180deg,#efe8d7,#e1d8c2)';

const WOOD = woodBackgroundStyle();

function loserHeadline(reason: DuelResult['reason'], falseStart: boolean) {
  if (reason === 'false_start' || falseStart) return 'JUMPED THE GUN';
  if (reason === 'opponent_left') return 'OUTLAW FLEES TOWN';
  return 'BANDIT TAKEN DOWN';
}

function loserLine(reaction: ReactionOutcome | undefined, reason: DuelResult['reason']) {
  if (reaction?.falseStart || reason === 'false_start')
    return 'Slapped leather before the call - and paid dearly for the discourtesy.';
  if (reason === 'opponent_left')
    return 'Last seen riding hard for the county line, dust trailing behind.';
  if (reaction?.ms != null)
    return `A fatal beat too slow, clearing leather at ${reaction.ms} ms.`;
  return 'Never cleared leather at all. The street fell to a dreadful hush.';
}

export function ResultScreen({
  result,
  selfId,
  players,
  lobbyId,
  onRematch,
  winnerPhoto,
  loserPhoto,
  clip,
}: ResultScreenProps) {
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const youWon = !!selfId && result.winnerId === selfId;
  const isTie = result.winnerId === null;
  const winnerName = result.winnerName ?? 'Nobody';
  const loserName =
    players.find((p) => p.id === result.loserId)?.name ?? 'The Outlaw';
  const iFalseStarted = !!(selfId && result.reactions[selfId]?.falseStart);
  const loserReaction = result.loserId
    ? result.reactions[result.loserId]
    : undefined;

  // Best-of-N match context.
  const bestOf = result.bestOf ?? 1;
  const matchOver = result.matchOver ?? true;
  const oppId = players.find((p) => p.id !== selfId)?.id;
  const myWins = selfId ? result.scores?.[selfId] ?? 0 : 0;
  const oppWins = oppId ? result.scores?.[oppId] ?? 0 : 0;

  const banner = !matchOver
    ? isTie
      ? 'A standoff — replay the round'
      : youWon
        ? 'Round to you'
        : 'Round to your rival'
    : isTie
      ? 'A standoff'
      : youWon
        ? bestOf > 1
          ? 'You take the match'
          : 'You are the fastest gun'
        : bestOf > 1
          ? 'The match is lost'
          : "You've been out-drawn";

  // Best-of-N score beat: hold the running score, tick the winner's point up
  // after a short delay, then reveal the result table. The pre-tick score is
  // derived client-side (the round winner had one fewer point).
  // No dramatic tally when a player just rage-quit - go straight to the result.
  const showBeat = bestOf > 1 && result.reason !== 'opponent_left';
  const [revealed, setRevealed] = useState(!showBeat);
  const [ticked, setTicked] = useState(!showBeat);
  const oppName = players.find((p) => p.id !== selfId)?.name ?? 'Rival';
  const incremented =
    result.winnerId != null && result.reason !== 'opponent_left';
  const youScored = incremented && youWon;
  const oppScored = incremented && !isTie && !youWon;
  const myShown = ticked ? myWins : myWins - (youScored ? 1 : 0);
  const oppShown = ticked ? oppWins : oppWins - (oppScored ? 1 : 0);

  useEffect(() => {
    if (!showBeat) return;
    const tick = window.setTimeout(() => setTicked(true), 750);
    // Only the deciding round opens the full sheriff/bandit table; a mid-match
    // round stays on the scoreboard with a "Next round" prompt.
    const reveal = matchOver
      ? window.setTimeout(() => setRevealed(true), 1750)
      : null;
    return () => {
      window.clearTimeout(tick);
      if (reveal) window.clearTimeout(reveal);
    };
  }, [showBeat, matchOver]);

  // The shareable permalink (own OG card) when the result was persisted,
  // falling back to the homepage. Carried by every share path below.
  const permalink = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return result.resultId ? `${origin}/r/${result.resultId}` : origin;
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(permalink());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  const share = async () => {
    setSharing(true);
    try {
      const blob = await renderShareCard({
        winnerName,
        loserName,
        reactionMs: result.reactionMs,
        winnerPhoto,
        loserPhoto,
        loserHeadline: loserHeadline(result.reason, iFalseStarted && !youWon),
        isTie,
      });
      await shareOrDownload(
        blob,
        `standoffduel-${lobbyId}.png`,
        `${winnerName} is the fastest gun in our StandoffDuel - think you're faster? ${permalink()}`,
      );
    } finally {
      setSharing(false);
    }
  };

  // The image share is the native/mobile path; the tweet intent is the one-tap
  // desktop path. The link it carries now resolves to a real OG card, so the
  // loop closes instead of dead-ending in a Downloads folder.
  const shareClip = async () => {
    if (!clip) return;
    const ext = clip.type.includes('mp4') ? 'mp4' : 'webm';
    await shareOrDownload(
      clip,
      `standoffduel-${lobbyId}.${ext}`,
      `${winnerName} won our StandoffDuel 🤠🔫 Think you're faster? ${permalink()}`,
    );
  };

  const tweet = () => {
    const text = youWon
      ? `I out-drew ${loserName} in ${result.reactionMs ?? '—'}ms on StandoffDuel 🤠🔫 Think you're faster?`
      : isTie
        ? `Nobody flinched - a dead-even standoff on StandoffDuel 🤠🔫 Come settle it.`
        : `${winnerName} just out-drew me on StandoffDuel 🤠🔫 Avenge me?`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      text,
    )}&url=${encodeURIComponent(permalink())}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="animate-table-slide absolute inset-0 z-30 overflow-auto"
      style={WOOD}
    >
      <RoughFilters />
      <TableDressing />
      <div className="relative z-10 mx-auto flex min-h-full max-w-5xl flex-col items-center justify-center gap-8 px-4 py-12">
        {!revealed ? (
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex items-end gap-8 sm:gap-12">
              <ScoreColumn label="You" value={myShown} accent={ticked && youScored} />
              <span className="font-display pb-4 text-4xl text-sand/40 sm:text-5xl">
                –
              </span>
              <ScoreColumn
                label={oppName}
                value={oppShown}
                accent={ticked && oppScored}
              />
            </div>
            <p className="font-impact text-xs uppercase tracking-[0.4em] text-sand/50">
              Best of {bestOf}
            </p>
            {ticked && matchOver && !isTie && (
              <p className="animate-score-pop font-display text-3xl text-ember drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                {youWon ? 'Match won' : 'Match over'}
              </p>
            )}

            {ticked && !matchOver && (
              <div className="mt-2 flex flex-col items-center gap-4">
                <p className="font-impact text-sm uppercase tracking-[0.35em] text-ember drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                  {banner}
                </p>
                <div className="flex flex-col items-center gap-3 sm:flex-row">
                  <Button size="lg" onClick={onRematch}>
                    Next round
                  </Button>
                  <Link
                    href="/"
                    className="text-xs uppercase tracking-widest text-sand/60 hover:text-sand"
                  >
                    ← Leave the lobby
                  </Link>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <p className="font-impact text-center text-sm uppercase tracking-[0.4em] text-ember drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
              {banner}
            </p>

            {bestOf > 1 && (
              <p className="font-impact text-center text-3xl uppercase tracking-[0.3em] text-gold drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                {myWins} <span className="text-sand/40">–</span> {oppWins}
                <span className="ml-3 align-middle text-xs text-sand/50">
                  best of {bestOf}
                </span>
              </p>
            )}

            {isTie ? (
          <Newspaper
            name="THE STREET"
            photo={winnerPhoto ?? loserPhoto}
            headline="NO BLOOD SPILLED"
            line="Two guns, two cowards - neither cleared leather before the bell tolled."
          />
        ) : (
          <div className="grid w-full items-start gap-8 md:grid-cols-2">
            <WantedPoster
              name={winnerName}
              photo={winnerPhoto}
              reactionMs={result.reactionMs}
            />
            <Newspaper
              name={loserName}
              photo={loserPhoto}
              headline={loserHeadline(result.reason, iFalseStarted && !youWon)}
              line={loserLine(loserReaction, result.reason)}
            />
          </div>
        )}

        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Button size="lg" onClick={onRematch}>
            {matchOver ? 'Rematch' : 'Next round'}
          </Button>
          {clip && (
            <Button variant="ghost" size="lg" onClick={shareClip}>
              Share clip
            </Button>
          )}
          <Button variant="ghost" size="lg" onClick={tweet}>
            Post on X
          </Button>
          <Button variant="ghost" size="lg" onClick={share} disabled={sharing}>
            {sharing ? 'Saving…' : 'Share card'}
          </Button>
          <button
            onClick={copyLink}
            className="text-xs uppercase tracking-widest text-sand/60 hover:text-sand"
          >
            {copied ? 'Link copied!' : 'Copy link'}
          </button>
          <Link
            href="/"
            className="text-xs uppercase tracking-widest text-sand/60 hover:text-sand"
          >
            ← Leave the lobby
          </Link>
        </div>
          </>
        )}
      </div>
    </div>
  );
}

function ScoreColumn({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="max-w-[7rem] truncate font-impact text-xs uppercase tracking-[0.3em] text-sand/60">
        {label}
      </span>
      <span
        key={value}
        className={cn(
          'animate-score-pop font-display text-7xl leading-none drop-shadow-[0_3px_3px_rgba(0,0,0,0.85)] sm:text-8xl',
          accent ? 'text-ember' : 'text-bone',
        )}
      >
        {value}
      </span>
    </div>
  );
}

function RoughFilters() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <defs>
        <filter id="paper-rough" x="-6%" y="-6%" width="112%" height="112%">
          <feTurbulence type="fractalNoise" baseFrequency="0.014 0.03" numOctaves="3" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="13" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="paper-rough-2" x="-6%" y="-6%" width="112%" height="112%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.028" numOctaves="3" seed="29" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="11" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}

function WantedPoster({
  name,
  photo,
  reactionMs,
}: {
  name: string;
  photo: string | null;
  reactionMs: number | null;
}) {
  return (
    <div className="relative mx-auto w-full max-w-xs -rotate-2">
      <div
        className="absolute inset-0"
        style={{
          background: PARCHMENT,
          border: '3px solid #2b1d0e',
          borderRadius: '3px',
          boxShadow:
            '0 22px 45px rgba(0,0,0,0.6), inset 0 0 70px rgba(120,80,30,0.3)',
          filter: 'url(#paper-rough)',
        }}
      />
      <div className="relative px-6 py-7 text-center" style={{ color: '#2b1d0e' }}>
        <Nail className="left-3 top-3" />
        <Nail className="right-3 top-3" />
        <Nail className="bottom-3 left-3" />
        <Nail className="bottom-3 right-3" />

        <SheriffStar size={50} className="mx-auto" />
        <p className="font-impact mt-1 text-[10px] uppercase tracking-[0.35em]">
          Defender of the Peace
        </p>
        <h2 className="font-display text-5xl leading-none">SHERIFF</h2>

        <Rule />

        <div
          className="mx-auto w-40 border-4 p-1"
          style={{ borderColor: '#2b1d0e', background: '#2b1d0e' }}
        >
          <div className="aspect-[4/5] overflow-hidden">
            {photo ? (
              <img
                src={photo}
                alt={name}
                className="h-full w-full object-cover"
                style={{ filter: 'sepia(0.55) contrast(1.06) saturate(0.85)' }}
              />
            ) : (
              <Placeholder dark />
            )}
          </div>
        </div>

        <p className="font-display mt-3 break-words text-3xl leading-tight">
          {name.toUpperCase()}
        </p>
        <p className="font-impact mt-1 text-xs uppercase tracking-widest">
          Fastest gun in the west
        </p>

        <Rule />

        <p className="font-impact uppercase tracking-wider">
          Drew in{' '}
          <span className="text-2xl">
            {reactionMs != null ? `${reactionMs} ms` : '-'}
          </span>
        </p>
        <p className="mt-2 text-[9px] uppercase tracking-[0.3em] opacity-70">
          ★ Standoff Duel ★
        </p>
      </div>
    </div>
  );
}

function Newspaper({
  name,
  photo,
  headline,
  line,
}: {
  name: string;
  photo: string | null;
  headline: string;
  line: string;
}) {
  return (
    <div className="relative mx-auto w-full max-w-md rotate-2">
      <div
        className="absolute inset-0"
        style={{
          background: NEWSPRINT,
          borderRadius: '2px',
          boxShadow:
            '0 22px 45px rgba(0,0,0,0.6), inset 0 0 50px rgba(80,60,30,0.12)',
          filter: 'url(#paper-rough-2)',
        }}
      />
      <div className="relative px-6 py-5" style={{ color: '#1c1208' }}>
        <div className="flex items-center justify-between border-b border-[#1c1208] pb-1 text-[9px] uppercase tracking-[0.25em]">
          <span>Vol. XLII</span>
          <span>★ Standoff Duel ★</span>
          <span>Two Cents</span>
        </div>
        <h3 className="font-display py-1 text-center text-4xl leading-none">
          The Frontier Gazette
        </h3>
        <div className="flex items-center justify-center gap-2 border-y-2 border-[#1c1208] py-0.5 text-[9px] uppercase tracking-[0.3em]">
          <span className="h-px w-6 bg-[#1c1208]" />
          High Noon Edition · Dusty Gulch
          <span className="h-px w-6 bg-[#1c1208]" />
        </div>

        <h2 className="font-impact mt-3 text-center text-4xl font-bold uppercase leading-none">
          {headline}
        </h2>
        <p className="mt-1 text-center text-[10px] uppercase tracking-[0.25em]">
          A bad day to be slow on the draw
        </p>

        <div className="mt-3 flex gap-3">
          <figure className="w-28 shrink-0">
            <div className="aspect-[4/5] overflow-hidden border-2 border-[#1c1208]">
              {photo ? (
                <img
                  src={photo}
                  alt={name}
                  className="h-full w-full object-cover"
                  style={{ filter: 'grayscale(1) contrast(1.3) brightness(0.95)' }}
                />
              ) : (
                <Placeholder />
              )}
            </div>
            <figcaption className="bg-[#1c1208] py-0.5 text-center text-[8px] uppercase tracking-widest text-[#e4dcc7]">
              {name}
            </figcaption>
          </figure>
          <div className="text-[12px] leading-snug">
            <p>
              <span className="font-display float-left mr-1 text-4xl leading-[0.75]">
                {line.charAt(0)}
              </span>
              {line.slice(1)}
            </p>
            <p className="mt-2 text-[11px] italic opacity-70">
              “I never even saw the hand move,” said a witness, before spitting
              in the dust.
            </p>
            <p className="mt-2 text-[9px] uppercase tracking-widest opacity-60">
              - Filed by the wire, High Noon
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SheriffStar({ size = 50, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden>
      <g fill="#2b1d0e">
        <polygon points="50,4 60.6,35.4 93.8,35.8 67.1,55.6 77,87.2 50,68 23,87.2 32.9,55.6 6.2,35.8 39.4,35.4" />
        <circle cx="50" cy="4" r="4.5" />
        <circle cx="93.8" cy="35.8" r="4.5" />
        <circle cx="77" cy="87.2" r="4.5" />
        <circle cx="23" cy="87.2" r="4.5" />
        <circle cx="6.2" cy="35.8" r="4.5" />
      </g>
      <circle cx="50" cy="49" r="8.5" fill="none" stroke="#d8c194" strokeWidth="2.5" />
    </svg>
  );
}

function Nail({ className }: { className?: string }) {
  return (
    <span
      className={cn('absolute h-2.5 w-2.5 rounded-full', className)}
      style={{
        background: 'radial-gradient(circle at 35% 35%, #6b5a44, #14100a)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.6)',
      }}
    />
  );
}

function Rule() {
  return (
    <div className="my-2 flex items-center gap-2">
      <span className="h-px flex-1 bg-current opacity-70" />
      <span className="text-xs">✦</span>
      <span className="h-px flex-1 bg-current opacity-70" />
    </div>
  );
}

function Placeholder({ dark = false }: { dark?: boolean }) {
  return (
    <div
      className="flex h-full w-full items-center justify-center text-xs uppercase tracking-widest"
      style={{ background: dark ? '#2b1d0e' : '#1c1208', color: '#d8c194' }}
    >
      no likeness
    </div>
  );
}
