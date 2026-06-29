'use client';

/**
 * Voice + effects lab (debug) — a stripped two-player room that reuses the real
 * voice plumbing (useMic + useWhisper + useVoice + DisturbanceChain) but skips
 * the game: nobody readies up, so it stays in the lobby with a live voice link.
 * Either player can pick a disturbance phase and hear it applied to the partner's
 * received voice in real time. Open /whispering-hacker/debug/voice (share the link).
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useMic } from '@/hooks/useMic';
import { useWhisper } from '@/hooks/useWhisper';
import { useVoice } from '@/hooks/useVoice';
import { DisturbanceChain, WHISPER_PHASES } from '@/lib/whisper-audio';
import { MicGate } from '@/components/whisper/MicGate';

const LEVELS = [1, 2, 3];

export function VoiceLab({ room, name }: { room: string; name: string }) {
  const mic = useMic(true);
  const wh = useWhisper(room, name);
  const voice = useVoice(wh.socket, mic.stream, wh.initiator, wh.handshakeGen);

  const chainRef = useRef<DisturbanceChain | null>(null);
  const [phase, setPhase] = useState('whisper');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    chainRef.current = new DisturbanceChain();
    return () => chainRef.current?.dispose();
  }, []);
  // Wire the partner's voice into the chain once it arrives, with the current phase.
  useEffect(() => {
    if (voice.remoteStream) {
      chainRef.current?.connect(voice.remoteStream);
      chainRef.current?.setPhase(phase);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.remoteStream]);
  useEffect(() => {
    if (voice.remoteStream) chainRef.current?.setPhase(phase);
  }, [phase, voice.remoteStream]);

  const inviteUrl = typeof window !== 'undefined' ? window.location.href : '';
  const other = wh.players.find((p) => p.id !== wh.selfId) ?? null;
  const current = WHISPER_PHASES.find((p) => p.id === phase);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <div className="center" style={{ overflowY: 'auto' }}>
      <div style={{ maxWidth: 780, margin: '0 auto', width: '100%', padding: '8px 0 40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link className="leave" href="/whispering-hacker">← back</Link>
          <span className="toppill accent">DEBUG · VOICE</span>
        </div>
        <h1 className="htitle" style={{ marginTop: 14 }}>VOICE + EFFECTS LAB</h1>
        <div className="uline" />
        <p className="prompt">Two players, real voice. Share the link, both join, then pick an effect to hear it applied
          to your partner&apos;s voice live. (The game never starts — this stays in the lobby.)</p>

        {/* room + status */}
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="prow"><span className="faint">ROOM</span><span className="accent" style={{ letterSpacing: '.2em' }}>{room}</span></div>
          <div className="prow"><span className="faint">YOU</span>
            <span>{name}{wh.selfRole && <span className="toppill role" style={{ fontSize: 10, marginLeft: 8 }}>{wh.selfRole.toUpperCase()}</span>}</span>
          </div>
          <div className="prow"><span className="faint">PARTNER</span><span>{other ? other.name : <span className="faint">waiting…</span>}</span></div>
          <div className="prow"><span className="faint">VOICE</span>
            <span className={voice.status === 'connected' ? 'accent' : 'faint'}>
              {voice.status === 'connected' ? '● live' : voice.status === 'failed' ? 'failed' : 'connecting…'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn" style={{ padding: '10px 16px' }} onClick={copy}>{copied ? 'COPIED ✓' : 'COPY INVITE LINK'}</button>
            {voice.status === 'failed' && <button className="btn" style={{ padding: '10px 16px' }} onClick={voice.retry}>RECONNECT</button>}
          </div>
        </div>

        {mic.errorKind && <div style={{ marginTop: 16 }}><MicGate kind={mic.errorKind} onRetry={mic.retry} /></div>}

        {/* current phase + role hint */}
        <p className="sub" style={{ marginTop: 18 }}>
          Applied to your partner&apos;s voice: <span className="accent">{current?.name ?? phase}</span> — {current?.blurb}
        </p>
        {wh.selfRole && (
          <p className="faint" style={{ fontSize: 11, marginTop: 4 }}>
            {wh.selfRole === 'hacker'
              ? 'You picked the effect — have your partner keep talking to hear it.'
              : 'Keep talking so your partner can hear the effect on your voice. (You can pick effects on your side too.)'}
          </p>
        )}

        {/* phase picker */}
        {LEVELS.map((lvl) => (
          <div className="panel" style={{ marginTop: 14 }} key={lvl}>
            <div className="lbl">Level {lvl} phases</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10, marginTop: 12 }}>
              {WHISPER_PHASES.filter((p) => p.level === lvl).map((p) => (
                <button
                  key={p.id}
                  className="btn"
                  disabled={!voice.remoteStream}
                  style={{ padding: '12px 14px', textAlign: 'left', borderColor: phase === p.id ? 'var(--amber)' : undefined, color: phase === p.id ? 'var(--amber-b)' : undefined }}
                  onClick={() => setPhase(p.id)}
                >
                  {phase === p.id ? '▶ ' : ''}{p.name}
                  <div className="faint" style={{ fontSize: 11, marginTop: 4, letterSpacing: 0 }}>{p.blurb}</div>
                </button>
              ))}
            </div>
          </div>
        ))}
        {!voice.remoteStream && (
          <p className="faint" style={{ textAlign: 'center', marginTop: 16 }}>effects unlock once your partner&apos;s voice connects.</p>
        )}
      </div>
    </div>
  );
}
