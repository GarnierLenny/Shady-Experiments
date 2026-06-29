'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { WHISPER_LEVELS } from '@shadyexperiments/shared';
import { useMic } from '@/hooks/useMic';
import { useVoice } from '@/hooks/useVoice';
import { useWhisper } from '@/hooks/useWhisper';
import { DisturbanceChain } from '@/lib/whisper-audio';
import { MicGate } from '@/components/whisper/MicGate';
import { HackerTerminal } from '@/components/whisper/HackerTerminal';
import { OperatorManual } from '@/components/whisper/OperatorManual';

/** Per-level accent [base, bright] — yellow / green / violet (from the mock). */
const LEVEL_ACCENT: Record<number, [string, string]> = {
  1: ['#e9ba4c', '#f8d066'],
  2: ['#3ddc84', '#74f0a8'],
  3: ['#a07bf5', '#c4adff'],
};

function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function accentStyle(level: number): React.CSSProperties {
  const [a, b] = LEVEL_ACCENT[level] ?? LEVEL_ACCENT[1];
  return { ['--amber' as string]: a, ['--amber-b' as string]: b } as React.CSSProperties;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="btn"
      style={{ padding: '9px 16px' }}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          window.setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked */
        }
      }}
    >
      {done ? 'COPIED ✓' : label}
    </button>
  );
}

export function WhisperRoom({ roomId, name }: { roomId: string; name: string }) {
  const mic = useMic(true);
  const wh = useWhisper(roomId, name);
  const voice = useVoice(wh.socket, mic.stream, wh.initiator);

  // Degradation chain: connect the received voice, re-tune by level.
  const chainRef = useRef<DisturbanceChain | null>(null);
  const levelRef = useRef(wh.level);
  levelRef.current = wh.level;
  useEffect(() => {
    chainRef.current = new DisturbanceChain();
    return () => chainRef.current?.dispose();
  }, []);
  useEffect(() => {
    if (voice.remoteStream) {
      chainRef.current?.connect(voice.remoteStream);
      chainRef.current?.setLevel(levelRef.current);
    }
  }, [voice.remoteStream]);
  useEffect(() => {
    chainRef.current?.setLevel(wh.level);
  }, [wh.level]);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const inviteUrl = `${origin}/whispering-hacker/room/${roomId}`;
  const levelMeta = WHISPER_LEVELS[wh.level - 1] ?? WHISPER_LEVELS[0];

  // ---- Hard errors ------------------------------------------------------
  if (wh.error) {
    return (
      <Stage level={1}>
        <div className="lobby" style={{ textAlign: 'center' }}>
          <p className="hsval" style={{ color: 'var(--red)' }}>CONNECTION REFUSED</p>
          <p className="muted" style={{ marginTop: 12 }}>{wh.error.message}</p>
          <Link href="/whispering-hacker" className="btn" style={{ display: 'inline-block', marginTop: 18, padding: '12px 22px' }}>
            NEW ROOM
          </Link>
        </div>
      </Stage>
    );
  }

  // ---- Completion -------------------------------------------------------
  if (wh.result || wh.status === 'complete') {
    return (
      <Stage level={wh.level}>
        <div className="endcard">
          <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
          <div className="end-over">// transmission complete</div>
          <h1 className="end-head" style={{ color: 'var(--green)' }}>MISSION COMPLETE</h1>
          <div className="end-uline" style={{ background: 'var(--green)' }} />
          <div className="end-stat">
            time <b>{fmt(wh.result?.elapsedMs ?? 0)}</b> · secured <b>{wh.result?.puzzlesSolved ?? 0}</b>
          </div>
          <div className="end-btns">
            <button className="btn primary" onClick={wh.rematch}>PLAY AGAIN</button>
            <Link href="/whispering-hacker" className="btn">NEW ROOM</Link>
            {wh.result && (
              <CopyButton value={`${origin}/whispering-hacker/r/${wh.result.resultId}`} label="COPY RESULT LINK" />
            )}
          </div>
        </div>
      </Stage>
    );
  }

  // ---- Level cleared (awaiting NEXT) / failed (awaiting RETRY) -----------
  if (wh.status === 'cleared') {
    return <EndScreen kind="complete" level={wh.level} strikes={wh.strikes} maxStrikes={wh.maxStrikes} onNext={wh.next} />;
  }
  if (wh.status === 'failed') {
    return <EndScreen kind="failed" level={wh.level} reason={wh.levelFailReason} onRetry={wh.retry} />;
  }

  // ---- Playing — full device shell --------------------------------------
  if (wh.status === 'playing' && wh.puzzles.length) {
    const elapsed = wh.startedAt ? Date.now() - wh.startedAt : 0;
    return (
      <div className="device" style={accentStyle(wh.level)}>
        <TopBar
          level={wh.level}
          totalLevels={wh.totalLevels}
          levelName={levelMeta?.name ?? ''}
          role={wh.selfRole}
          roomId={roomId}
          voiceOk={voice.status === 'connected'}
        />
        <div className="body">
          <LeftRail level={wh.level} totalLevels={wh.totalLevels} levelName={levelMeta?.name ?? ''} levelDeadline={wh.levelDeadline} strikes={wh.strikes} maxStrikes={wh.maxStrikes} />
          {wh.selfRole === 'operator' ? (
            <OperatorManual puzzles={wh.puzzles} level={wh.level} />
          ) : (
            <HackerTerminal puzzles={wh.puzzles} level={wh.level} totalLevels={wh.totalLevels} startedAt={wh.startedAt} onSolved={wh.solved} onFailed={wh.failed} />
          )}
          <RightRail voice={voice} level={wh.level} levelName={levelMeta?.name ?? ''} initialElapsed={elapsed} />
        </div>
        <BottomBar role={wh.selfRole} />
      </div>
    );
  }

  // ---- Lobby ------------------------------------------------------------
  const self = wh.players.find((p) => p.id === wh.selfId) ?? null;
  const other = wh.players.find((p) => p.id !== wh.selfId) ?? null;

  return (
    <Stage level={1}>
      <div className="lobby">
        <div style={{ textAlign: 'center' }}>
          <p className="faint" style={{ letterSpacing: '.4em', fontSize: 12 }}>// SECURE ROOM</p>
          <h1 className="big amber" style={{ fontSize: 44, letterSpacing: '.2em' }}>{roomId}</h1>
          <p className="muted" style={{ marginTop: 8 }}>Two operatives. One terminal. You can only talk by voice.</p>
        </div>

        <div style={{ marginTop: 26 }}>
          {wh.players.map((p) => (
            <div key={p.id} className="prow">
              <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="toppill role" style={{ fontSize: 10 }}>{p.role.toUpperCase()}</span>
                <span>{p.name}{p.id === wh.selfId && <span className="faint"> (you)</span>}</span>
              </span>
              <span className={p.ready ? 'accent' : 'faint'}>{p.ready ? 'READY ✓' : 'standby'}</span>
            </div>
          ))}
          {!other && <div className="prow faint" style={{ justifyContent: 'center', borderStyle: 'dashed' }}>waiting for your partner…</div>}
        </div>

        {wh.selfRole && (
          <p className="muted" style={{ textAlign: 'center', marginTop: 18, fontSize: 13, lineHeight: 1.6 }}>
            You are the <span className="accent">{wh.selfRole.toUpperCase()}</span> —{' '}
            {wh.selfRole === 'hacker'
              ? 'you get the terminal. You have nothing; your partner has everything.'
              : 'you get the manual. The answers are yours; read them out.'}
          </p>
        )}

        {!wh.full && (
          <div className="panel" style={{ marginTop: 22, textAlign: 'center' }}>
            <p className="faint" style={{ fontSize: 11, letterSpacing: '.3em' }}>SEND THIS TO YOUR PARTNER</p>
            <p className="muted" style={{ marginTop: 8, wordBreak: 'break-all', fontSize: 12 }}>{inviteUrl}</p>
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', gap: 8 }}>
              <CopyButton value={inviteUrl} label="COPY INVITE" />
              <CopyButton value={roomId} label="COPY CODE" />
            </div>
          </div>
        )}

        <div style={{ marginTop: 26 }}>
          {mic.errorKind ? (
            <MicGate kind={mic.errorKind} onRetry={mic.retry} />
          ) : !mic.stream ? (
            <p className="faint" style={{ textAlign: 'center' }}>requesting microphone…</p>
          ) : !wh.full ? (
            <p className="faint" style={{ textAlign: 'center' }}>waiting for a second operative to join…</p>
          ) : self?.ready ? (
            <p className="muted" style={{ textAlign: 'center' }}>READY ✓ — waiting for {other?.name ?? 'your partner'}…</p>
          ) : (
            <button className="btn submit" onClick={wh.ready}>READY — BEGIN {WHISPER_LEVELS[0]?.name}</button>
          )}
        </div>

        <p className="faint" style={{ textAlign: 'center', marginTop: 16, fontSize: 11, letterSpacing: '.1em' }}>
          {voice.status === 'connected' ? '● voice channel open' : '○ opening voice channel…'}
          {!wh.connected && ' · establishing uplink…'}
        </p>
      </div>
    </Stage>
  );
}

/** A simple centered dark stage (top bar + center) for lobby/complete/error. */
function Stage({ children, level }: { children: React.ReactNode; level: number }) {
  return (
    <div className="device" style={accentStyle(level)}>
      <div className="top">
        <div className="brand">WHISPERING HACKER <em>EXP #002</em></div>
        <div className="spacer" />
        <Link href="/whispering-hacker" className="leave">LEAVE</Link>
      </div>
      <div className="center-stage">{children}</div>
      <div className="bot"><div className="wlogo">W</div><div>PROTOCOL &nbsp; WHSP v1.0</div></div>
    </div>
  );
}

function TopBar({
  level, totalLevels, levelName, role, roomId, voiceOk,
}: { level: number; totalLevels: number; levelName: string; role: string | null; roomId: string; voiceOk: boolean }) {
  return (
    <div className="top">
      <div className="brand">WHISPERING HACKER <em>EXP #002</em></div>
      <span className="toppill accent">LVL {level}/{totalLevels} · {levelName}</span>
      {role && <span className="toppill role">{role.toUpperCase()}</span>}
      <div className="spacer" />
      <div className="kv"><div className="k">Session</div><div className="v">{roomId}</div></div>
      <div className="kv"><div className="k">Voice</div><div className={`v ${voiceOk ? 'green' : ''}`}>{voiceOk ? <><span className="dotg" />LIVE</> : 'connecting'}</div></div>
      <Link href="/whispering-hacker" className="leave">LEAVE</Link>
    </div>
  );
}

function LeftRail({ level, totalLevels, levelName, levelDeadline, strikes, maxStrikes }: { level: number; totalLevels: number; levelName: string; levelDeadline: number | null; strikes: number; maxStrikes: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);
  const remain = levelDeadline ? Math.max(0, levelDeadline - now) : 0;
  const low = remain <= 30000;
  return (
    <div className="col left">
      <div className="lbl muted">Level</div>
      <div className="big"><span className="amber">{level}</span> <span className="faint">/ {totalLevels}</span></div>
      <div className="sub">{levelName}</div>
      <div className="rule" />
      <div className="lbl muted">Time left</div>
      <div className="big" style={{ fontSize: 34, color: low ? 'var(--red)' : 'var(--amber)' }}>{fmt(remain)}</div>
      <div className="rule" />
      <StrikePanel strikes={strikes} maxStrikes={maxStrikes} />
      <div className="micsection">
        <div className="lbl muted">Mic</div>
        <div className="micv">
          <VU label="P1" you />
          <VU label="P2" />
        </div>
      </div>
    </div>
  );
}

/** Both-players strike panel: three dark-red crosses that light up per error;
 *  once all three are lit (one more is fatal) it blinks LAST CHANCE. */
function StrikePanel({ strikes, maxStrikes }: { strikes: number; maxStrikes: number }) {
  const last = strikes >= maxStrikes;
  return (
    <div className={`strikebox${last ? ' lastchance' : ''}`}>
      <div className="lbl muted">Strikes <span className="faint">/ {maxStrikes}</span></div>
      <div className="strikes">
        {Array.from({ length: maxStrikes }, (_, i) => (
          <span key={i} className={`strikex${i < strikes ? ' on' : ''}`}>✕</span>
        ))}
      </div>
      {last && <div className="lastchance-txt">LAST CHANCE</div>}
    </div>
  );
}

/** End-of-level screen (variant A — terminal modal): LEVEL COMPLETE → NEXT LEVEL,
 *  or LEVEL FAILED → RETRY; QUIT leaves. Shown to both players. */
function EndScreen({
  kind, level, reason, strikes, maxStrikes, onNext, onRetry,
}: {
  kind: 'complete' | 'failed';
  level: number;
  reason?: 'timeout' | 'strikes' | null;
  strikes?: number;
  maxStrikes?: number;
  onNext?: () => void;
  onRetry?: () => void;
}) {
  const complete = kind === 'complete';
  const color = complete ? 'var(--green)' : 'var(--red)';
  return (
    <Stage level={level}>
      <div className="endcard">
        <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />
        <div className="end-over">{complete ? '// transmission complete' : '// link severed'}</div>
        <h1 className="end-head" style={{ color }}>{complete ? 'LEVEL COMPLETE' : 'LEVEL FAILED'}</h1>
        <div className="end-uline" style={{ background: color }} />
        <div className="end-sub">
          {complete ? `Level ${level} secured` : reason === 'strikes' ? 'too many strikes' : 'the clock ran out'}
        </div>
        {complete && typeof strikes === 'number' && (
          <div className="end-stat">strikes <b>{strikes} / {maxStrikes}</b></div>
        )}
        <div className="end-btns">
          {complete ? (
            <button className="btn primary" onClick={onNext}>NEXT LEVEL</button>
          ) : (
            <button className="btn primary" onClick={onRetry}>RETRY</button>
          )}
          <Link href="/whispering-hacker" className="btn quit">QUIT</Link>
        </div>
      </div>
    </Stage>
  );
}

const VU_SEGS = 13;
function VU({ label, you }: { label: string; you?: boolean }) {
  const [lvl, setLvl] = useState(0.2);
  useEffect(() => {
    const t = setInterval(() => setLvl((v) => Math.max(0.05, Math.min(1, v + (Math.random() - 0.5) * 0.5))), 140);
    return () => clearInterval(t);
  }, []);
  const lit = Math.round(lvl * VU_SEGS);
  return (
    <div className="miccol">
      <div className="vuv">
        <div className="segs">
          {Array.from({ length: VU_SEGS }, (_, i) => {
            const on = i < lit;
            const tier = i / VU_SEGS < 0.55 ? 'g' : i / VU_SEGS < 0.8 ? 'o' : 'r';
            return <i key={i} className={on ? tier : ''} />;
          })}
        </div>
      </div>
      <span className="miclbl">{label} {you && <span className="you">(you)</span>}</span>
    </div>
  );
}

function RightRail({ voice, level, levelName }: { voice: { status: string; retry: () => void }; level: number; levelName: string; initialElapsed: number }) {
  return (
    <div className="col right">
      <div className="lbl muted">Voice link</div>
      <div className="rbox">
        {voice.status === 'connected' ? (
          <span className="voiceline">● partner connected</span>
        ) : voice.status === 'failed' ? (
          <span className="voiceline bad" onClick={voice.retry}>voice failed — reconnect</span>
        ) : (
          <span className="faint">○ connecting voice…</span>
        )}
      </div>
      <div className="lbl muted" style={{ marginTop: 18 }}>Log</div>
      <div className="log">
        <div className="row amber"><span className="ts">··:··</span><span className="ev">level {level} — {levelName}</span></div>
        <div className="row"><span className="ts">··:··</span><span className="ev">voice {voice.status}</span></div>
        <div className="row"><span className="ts">··:··</span><span className="ev">session active</span></div>
      </div>
    </div>
  );
}

function BottomBar({ role }: { role: string | null }) {
  return (
    <div className="bot">
      <div className="wlogo">W</div>
      <div>PROTOCOL &nbsp; WHSP v1.0</div>
      <div className="spacer" />
      <div>CLEARANCE &nbsp; {role ? role.toUpperCase() : 'OPERATOR-PAIR'}</div>
    </div>
  );
}
