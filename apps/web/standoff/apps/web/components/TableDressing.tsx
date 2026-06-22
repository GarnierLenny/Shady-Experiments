'use client';

import type { CSSProperties } from 'react';
import { cn } from '@/lib/cn';

/**
 * Decorative western props scattered on the wooden table behind the result
 * cards - whiskey-ring stains, spent cartridges, a dead man's hand, coins and a
 * loose sheriff star. Purely cosmetic; sits behind the poster/newspaper.
 */
export function TableDressing() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <StainRing className="left-[4%] top-[11%] h-36 w-36" />
      <StainRing className="right-[6%] top-[52%] h-44 w-44" />
      <StainRing className="left-[29%] bottom-[6%] h-32 w-32" />
      <StainRing className="right-[31%] top-[9%] h-28 w-28" />

      <Badge className="left-[3%] top-[28%] h-32 w-32 -rotate-12" />

      <Coin className="right-[5%] top-[16%] h-12 w-12" />
      <Coin className="right-[9%] top-[25%] h-12 w-12" style={{ opacity: 0.95 }} />
      <Coin className="left-[7%] top-[58%] h-12 w-12" />
      <Coin className="left-[16%] bottom-[20%] h-10 w-10" style={{ transform: 'scale(0.95)' }} />

      {/* a stray card up top-left */}
      <Card className="left-[8%] top-[13%] rotate-[14deg]" rank="6" suit="♥" red />

      {/* spent cartridges, bottom-left */}
      <Cartridge className="bottom-[15%] left-[6%] rotate-[24deg]" />
      <Cartridge className="bottom-[11%] left-[10%] rotate-[62deg]" />
      <Cartridge className="bottom-[7%] left-[3%] rotate-[6deg]" />
      <Cartridge className="bottom-[12%] left-[13%] rotate-[100deg]" />

      {/* dead man's hand, bottom-right, fanned wide */}
      <Card className="bottom-[6%] right-[3%] rotate-[-26deg]" rank="A" suit="♠" />
      <Card className="bottom-[8%] right-[8%] rotate-[-11deg]" rank="A" suit="♣" />
      <Card className="bottom-[10%] right-[13%] rotate-[4deg]" rank="8" suit="♠" />
      <Card className="bottom-[8%] right-[18%] rotate-[19deg]" rank="8" suit="♣" />
    </div>
  );
}

function StainRing({ className }: { className?: string }) {
  return (
    <div
      className={cn('absolute rounded-full', className)}
      style={{
        border: '5px solid rgba(28,14,3,0.20)',
        boxShadow: 'inset 0 0 22px rgba(28,14,3,0.12)',
      }}
    />
  );
}

function Coin({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cn('absolute rounded-full', className)}
      style={{
        background:
          'radial-gradient(circle at 38% 30%, #ffe9a8 0%, #e8c454 32%, #bd8a2e 72%, #835c1c 100%)',
        boxShadow: [
          '0 5px 10px rgba(0,0,0,0.55)',
          'inset 0 0 0 3px rgba(150,108,34,0.65)',
          'inset 0 0 0 5px rgba(255,236,176,0.30)',
          'inset 0 3px 6px rgba(255,245,205,0.45)',
          'inset 0 -4px 7px rgba(85,52,12,0.5)',
        ].join(','),
        ...style,
      }}
    />
  );
}

function Cartridge({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 22 64"
      className={cn('absolute h-20 drop-shadow-md', className)}
      aria-hidden
    >
      <defs>
        <linearGradient id="sd-brass" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6e4f1a" />
          <stop offset="0.5" stopColor="#e3c06a" />
          <stop offset="1" stopColor="#6e4f1a" />
        </linearGradient>
        <linearGradient id="sd-copper" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7a3b15" />
          <stop offset="0.5" stopColor="#d08a4e" />
          <stop offset="1" stopColor="#7a3b15" />
        </linearGradient>
      </defs>
      <rect x="3" y="20" width="16" height="40" rx="2" fill="url(#sd-brass)" stroke="#2b1d0e" strokeWidth="0.6" />
      <rect x="2" y="55" width="18" height="7" rx="1.5" fill="url(#sd-brass)" stroke="#2b1d0e" strokeWidth="0.6" />
      <path d="M5 21 Q11 1 17 21 Z" fill="url(#sd-copper)" stroke="#2b1d0e" strokeWidth="0.6" />
      <line x1="3.5" y1="33" x2="18.5" y2="33" stroke="#2b1d0e" strokeOpacity="0.3" />
    </svg>
  );
}

function Card({
  rank,
  suit,
  red,
  className,
}: {
  rank: string;
  suit: string;
  red?: boolean;
  className?: string;
}) {
  const color = red ? '#b41722' : '#161616';
  return (
    <div
      className={cn(
        'absolute h-[132px] w-[92px] overflow-hidden rounded-lg shadow-[0_6px_16px_rgba(0,0,0,0.55)]',
        className,
      )}
      style={{
        background: 'linear-gradient(145deg,#ffffff,#f1ece0)',
        border: '1px solid rgba(0,0,0,0.22)',
      }}
    >
      <div
        className="pointer-events-none absolute inset-[5px] rounded-md"
        style={{ boxShadow: 'inset 0 0 0 1.5px rgba(0,0,0,0.06)' }}
      />
      <span
        className="absolute left-2 top-1.5 text-center text-[13px] font-bold leading-[0.95]"
        style={{ color }}
      >
        {rank}
        <br />
        {suit}
      </span>
      <span
        className="absolute bottom-1.5 right-2 rotate-180 text-center text-[13px] font-bold leading-[0.95]"
        style={{ color }}
      >
        {rank}
        <br />
        {suit}
      </span>
      <CardCenter rank={rank} suit={suit} color={color} />
    </div>
  );
}

const PIP_COUNT: Record<string, number | undefined> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
};

function CardCenter({
  rank,
  suit,
  color,
}: {
  rank: string;
  suit: string;
  color: string;
}) {
  const count = PIP_COUNT[rank];
  if (count) {
    const rows = Math.ceil(count / 2);
    const flipFrom = Math.ceil(rows / 2);
    return (
      <div
        className="absolute inset-x-4 inset-y-6 grid grid-cols-2 content-between justify-items-center"
        style={{ color }}
      >
        {Array.from({ length: count }).map((_, i) => (
          <span
            key={i}
            className={cn(
              'text-xl leading-none',
              Math.floor(i / 2) >= flipFrom && 'rotate-180',
            )}
          >
            {suit}
          </span>
        ))}
      </div>
    );
  }
  // Aces / face cards → a single large pip.
  return (
    <span
      className="absolute inset-0 flex items-center justify-center text-[44px]"
      style={{ color }}
    >
      {suit}
    </span>
  );
}

function Badge({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={cn('absolute drop-shadow-lg', className)} aria-hidden>
      <polygon
        points="50,4 60.6,35.4 93.8,35.8 67.1,55.6 77,87.2 50,68 23,87.2 32.9,55.6 6.2,35.8 39.4,35.4"
        fill="#c9a13a"
        stroke="#7a5212"
        strokeWidth="3"
      />
      {([[50, 4], [93.8, 35.8], [77, 87.2], [23, 87.2], [6.2, 35.8]] as const).map(
        ([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="4" fill="#c9a13a" stroke="#7a5212" strokeWidth="1.5" />
        ),
      )}
      <circle cx="50" cy="49" r="9" fill="none" stroke="#7a5212" strokeWidth="3" />
    </svg>
  );
}
