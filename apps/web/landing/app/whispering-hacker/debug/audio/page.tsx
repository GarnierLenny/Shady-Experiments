'use client';

/**
 * Audio lab (debug) — audition every named disturbance phase without a live peer:
 *  1. the voice line driven by a synthesised "test voice" (or your mic) through
 *     the real DisturbanceChain, switchable between every WHISPER_PHASES preset;
 *  2. the signal-puzzle tone bank (the 6 SIGNALS), each playable.
 *
 * Not linked anywhere — open /whispering-hacker/debug/audio directly.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { SIGNALS } from '@shadyexperiments/shared';
import { DisturbanceChain, WHISPER_PHASES } from '../../../../lib/whisper-audio';
import { playTones } from '../../../../lib/whisper-signal';

/** A looping, voice-ish source so degradation is audible without a peer or mic. */
function buildTestVoice(): { stream: MediaStream; stop: () => void } {
  const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  const dest = ctx.createMediaStreamDestination();

  const carrier = ctx.createOscillator();
  carrier.type = 'sawtooth';
  carrier.frequency.value = 132;
  const vibrato = ctx.createOscillator();
  vibrato.frequency.value = 5;
  const vibratoGain = ctx.createGain();
  vibratoGain.gain.value = 6;
  vibrato.connect(vibratoGain).connect(carrier.frequency);

  const formant = ctx.createBiquadFilter();
  formant.type = 'bandpass';
  formant.frequency.value = 1100;
  formant.Q.value = 1.2;

  const amp = ctx.createGain();
  amp.gain.value = 0.22; // base level; the LFO adds a syllabic pulse on top
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 4.2;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.18;
  lfo.connect(lfoGain).connect(amp.gain);

  carrier.connect(formant).connect(amp).connect(dest);
  carrier.start();
  vibrato.start();
  lfo.start();
  void ctx.resume().catch(() => {});

  return {
    stream: dest.stream,
    stop: () => { try { carrier.stop(); vibrato.stop(); lfo.stop(); void ctx.close(); } catch { /* ignore */ } },
  };
}

const LEVELS = [1, 2, 3];

export default function AudioLab() {
  const chainRef = useRef<DisturbanceChain | null>(null);
  const srcRef = useRef<{ stream: MediaStream; stop: () => void } | null>(null);
  const micRef = useRef<MediaStream | null>(null);

  const [running, setRunning] = useState(false);
  const [useMic, setUseMic] = useState(false);
  const [phase, setPhase] = useState('whisper');
  const [err, setErr] = useState<string | null>(null);

  const stop = useCallback(() => {
    chainRef.current?.dispose();
    chainRef.current = null;
    srcRef.current?.stop();
    srcRef.current = null;
    micRef.current?.getTracks().forEach((t) => t.stop());
    micRef.current = null;
    setRunning(false);
  }, []);

  useEffect(() => stop, [stop]); // clean up on unmount

  useEffect(() => {
    if (running) chainRef.current?.setPhase(phase);
  }, [phase, running]);

  async function start() {
    setErr(null);
    stop();
    try {
      let stream: MediaStream;
      if (useMic) {
        const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false } });
        micRef.current = mic;
        stream = mic;
      } else {
        const src = buildTestVoice();
        srcRef.current = src;
        stream = src.stream;
      }
      const chain = new DisturbanceChain();
      chain.connect(stream);
      chain.setPhase(phase);
      chainRef.current = chain;
      setRunning(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'audio failed to start');
      stop();
    }
  }

  const current = WHISPER_PHASES.find((p) => p.id === phase);

  return (
    <div className="center" style={{ overflowY: 'auto' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', width: '100%', padding: '8px 0 40px' }}>
        <a className="leave" href="/whispering-hacker" style={{ display: 'inline-block', marginBottom: 18 }}>← back</a>
        <h1 className="htitle">AUDIO LAB</h1>
        <div className="uline" />
        <p className="prompt">Audition every disturbance phase without a peer. Press START, then click a phase to
          hear the test voice (or your mic) run through the real <b>DisturbanceChain</b> for that preset.</p>

        {/* ---- controls ---- */}
        <div className="panel" style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn" onClick={running ? stop : start} style={{ padding: '12px 22px' }}>
              {running ? '■ STOP' : '▶ START'}
            </button>
            <label className="miclbl" style={{ cursor: 'pointer', gap: 8 }}>
              <input type="checkbox" checked={useMic} disabled={running} onChange={(e) => setUseMic(e.target.checked)} />
              use microphone <span className="faint">(headphones — feedback otherwise)</span>
            </label>
            {running && <span className="faint" style={{ marginLeft: 'auto' }}>● live · {useMic ? 'mic' : 'test voice'}</span>}
          </div>
          {err && <p className="fb bad" style={{ textAlign: 'left', height: 'auto', marginTop: 10 }}>⚠ {err}</p>}
          <p className="sub" style={{ marginTop: 12 }}>
            Now playing: <span className="accent">{current?.name ?? phase}</span> — {current?.blurb}
          </p>
        </div>

        {/* ---- phases by level ---- */}
        {LEVELS.map((lvl) => (
          <div className="panel" style={{ marginTop: 14 }} key={lvl}>
            <div className="lbl">Level {lvl} phases</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10, marginTop: 12 }}>
              {WHISPER_PHASES.filter((p) => p.level === lvl).map((p) => (
                <button
                  key={p.id}
                  className={`btn${phase === p.id ? ' phase-on' : ''}`}
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

        {/* ---- signal bank ---- */}
        <div className="panel" style={{ marginTop: 14 }}>
          <div className="lbl">Signal puzzle — tone bank</div>
          <p className="sub" style={{ marginTop: 6 }}>The six sounds P1 can play; each maps to a fixed shape order.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 12 }}>
            {SIGNALS.map((s) => (
              <button key={s.id} className="btn" style={{ padding: '12px 14px', textAlign: 'left' }} onClick={() => playTones(s.tones)}>
                ▶ {s.name}
                <div className="faint" style={{ fontSize: 11, marginTop: 4, letterSpacing: 0 }}>{s.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
