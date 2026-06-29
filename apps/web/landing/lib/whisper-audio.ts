/**
 * DisturbanceChain — the heart of Whispering Hacker's comedy: a Web Audio graph
 * that degrades the *received* voice. Two ways to drive it:
 *  - `setLevel`/`setIntensity` — the continuous clean→chaos model the game uses.
 *  - `setPhase` — one of the named disturbance phases (WHISPER, RADIO, ECHO …),
 *    each a distinct effect preset. The effect section is rebuilt on every change
 *    (cheap, infrequent), so phases can have wildly different graphs.
 *
 * Browser quirk: Chrome won't pull samples through a MediaStreamAudioSourceNode
 * unless the stream is also attached to a media element. We attach a muted
 * <audio> purely to keep the pipeline alive; all audible output is the processed
 * graph routed to `destination`.
 */
import { WHISPER_LEVELS } from '@shadyexperiments/shared';

type AnyAudioContext = typeof AudioContext;

function getAudioContextCtor(): AnyAudioContext | null {
  if (typeof window === 'undefined') return null;
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: AnyAudioContext }).webkitAudioContext ||
    null
  );
}

/** Identity curve (clean pass-through). */
function linearCurve(): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(new ArrayBuffer(2 * Float32Array.BYTES_PER_ELEMENT));
  curve[0] = -1;
  curve[1] = 1;
  return curve;
}

/** Harsh clipping curve; `amount` 0..1 scales the drive. */
function distortionCurve(amount: number): Float32Array<ArrayBuffer> {
  const k = amount * 120;
  const n = 256;
  const curve = new Float32Array(new ArrayBuffer(n * Float32Array.BYTES_PER_ELEMENT));
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

function noiseBuffer(ctx: AudioContext, seconds = 2): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}
function loopNoise(ctx: AudioContext): AudioBufferSourceNode {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer(ctx);
  s.loop = true;
  return s;
}
function impulseBuffer(ctx: AudioContext, seconds = 1.6, decay = 2.4): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

// Looping sample beds (real recordings, served from /public) for crowd / wind.
const CROWD_URL = '/whispering-hacker/audio/crowd.mp3';
const WIND_URL = '/whispering-hacker/audio/wind.mp3';
const _sampleBytes = new Map<string, Promise<ArrayBuffer>>();
function fetchSample(url: string): Promise<ArrayBuffer> {
  let p = _sampleBytes.get(url);
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`failed to load ${url}`);
      return r.arrayBuffer();
    });
    _sampleBytes.set(url, p);
  }
  return p;
}
async function loadLoopingSample(ctx: AudioContext, url: string): Promise<AudioBufferSourceNode> {
  const bytes = await fetchSample(url);
  const buf = await ctx.decodeAudioData(bytes.slice(0)); // slice: keep the cached bytes intact
  const node = ctx.createBufferSource();
  node.buffer = buf;
  node.loop = true;
  return node;
}
/** Builder: the voice passes clean, a looping recording sits underneath it. */
function sampleBed(url: string, gain: number): PhaseBuilder {
  return (ctx, src, out) => {
    src.connect(out);
    const g = ctx.createGain();
    g.gain.value = gain;
    g.connect(out);
    let node: AudioBufferSourceNode | null = null;
    let cancelled = false;
    loadLoopingSample(ctx, url)
      .then((s) => { if (cancelled) return; node = s; s.connect(g); s.start(); })
      .catch(() => {});
    return () => {
      cancelled = true;
      try { node?.stop(); } catch { /* ignore */ }
      node?.disconnect();
      g.disconnect();
    };
  };
}

// ---------------------------------------------------------------------------
// Named disturbance phases
// ---------------------------------------------------------------------------

export interface WhisperPhase {
  id: string;
  name: string;
  level: number;
  blurb: string;
}

/** The mock's audio-event roster — now each with a real, distinct rendering. */
export const WHISPER_PHASES: WhisperPhase[] = [
  { id: 'whisper', name: 'WHISPER', level: 1, blurb: 'clean line, no ambient noise' },
  { id: 'crowd', name: 'CROWD', level: 2, blurb: 'real crowd recording under the voice' },
  { id: 'radio', name: 'RADIO', level: 2, blurb: 'AM band + static hiss' },
  { id: 'wind', name: 'WIND NOISE', level: 2, blurb: 'real wind recording under the voice' },
  { id: 'compressor', name: 'VOICE COMPRESSOR', level: 2, blurb: 'pumped, squashed dynamics' },
  { id: 'saturated', name: 'SATURATED', level: 2, blurb: 'overdriven, clipping' },
  { id: 'echo', name: 'ECHO', level: 3, blurb: 'repeating delay tail' },
  { id: 'latency', name: 'LATENCY +1s', level: 3, blurb: 'voice arrives ~1s late' },
  { id: 'talkie', name: 'TALKIE-WALKIE', level: 3, blurb: 'narrow band + squelch bursts' },
  { id: 'packetloss', name: 'PACKET LOSS', level: 3, blurb: 'random dropouts' },
  { id: 'robotic', name: 'ROBOTIC VOICE', level: 3, blurb: 'ring-mod robot timbre' },
];

/** Each builder wires `input -> … -> output`, plus any side beds, and returns a teardown. */
type PhaseBuilder = (ctx: AudioContext, input: AudioNode, output: AudioNode) => () => void;

const PHASE_BUILDERS: Record<string, PhaseBuilder> = {
  whisper: (ctx, src, out) => {
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 60;
    src.connect(hp).connect(out);
    return () => hp.disconnect();
  },
  crowd: sampleBed(CROWD_URL, 0.6),
  radio: (ctx, src, out) => {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1600;
    bp.Q.value = 4;
    const sh = ctx.createWaveShaper();
    sh.curve = distortionCurve(0.25);
    src.connect(bp).connect(sh).connect(out);
    const ns = loopNoise(ctx);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2000;
    const ng = ctx.createGain();
    ng.gain.value = 0.08;
    ns.connect(hp).connect(ng).connect(out);
    ns.start();
    return () => { try { ns.stop(); } catch { /**/ } bp.disconnect(); sh.disconnect(); ns.disconnect(); hp.disconnect(); ng.disconnect(); };
  },
  wind: sampleBed(WIND_URL, 0.55),
  compressor: (ctx, src, out) => {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -45;
    comp.knee.value = 6;
    comp.ratio.value = 14;
    comp.attack.value = 0.002;
    comp.release.value = 0.18;
    const mk = ctx.createGain();
    mk.gain.value = 2.4;
    src.connect(comp).connect(mk).connect(out);
    return () => { comp.disconnect(); mk.disconnect(); };
  },
  saturated: (ctx, src, out) => {
    const sh = ctx.createWaveShaper();
    sh.curve = distortionCurve(0.95);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2600;
    const g = ctx.createGain();
    g.gain.value = 0.7;
    src.connect(sh).connect(lp).connect(g).connect(out);
    return () => { sh.disconnect(); lp.disconnect(); g.disconnect(); };
  },
  echo: (ctx, src, out) => {
    const d = ctx.createDelay(1.0);
    d.delayTime.value = 0.28;
    const fb = ctx.createGain();
    fb.gain.value = 0.45;
    const wet = ctx.createGain();
    wet.gain.value = 0.7;
    src.connect(out);
    src.connect(d);
    d.connect(fb).connect(d);
    d.connect(wet).connect(out);
    return () => { d.disconnect(); fb.disconnect(); wet.disconnect(); };
  },
  latency: (ctx, src, out) => {
    const d = ctx.createDelay(2.0);
    d.delayTime.value = 1.0;
    src.connect(d).connect(out);
    return () => d.disconnect();
  },
  talkie: (ctx, src, out) => {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1700;
    bp.Q.value = 6;
    const sh = ctx.createWaveShaper();
    sh.curve = distortionCurve(0.5);
    src.connect(bp).connect(sh).connect(out);
    const ns = loopNoise(ctx);
    const nbp = ctx.createBiquadFilter();
    nbp.type = 'bandpass';
    nbp.frequency.value = 2200;
    nbp.Q.value = 3;
    const ng = ctx.createGain();
    ng.gain.value = 0.0001;
    ns.connect(nbp).connect(ng).connect(out);
    ns.start();
    const timer = window.setInterval(() => {
      const t = ctx.currentTime;
      ng.gain.cancelScheduledValues(t);
      ng.gain.setValueAtTime(0.14, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    }, 1700);
    return () => { window.clearInterval(timer); try { ns.stop(); } catch { /**/ } bp.disconnect(); sh.disconnect(); ns.disconnect(); nbp.disconnect(); ng.disconnect(); };
  },
  packetloss: (ctx, src, out) => {
    const gate = ctx.createGain();
    gate.gain.value = 1;
    src.connect(gate).connect(out);
    const timer = window.setInterval(() => {
      if (Math.random() < 0.4) {
        const t = ctx.currentTime;
        gate.gain.cancelScheduledValues(t);
        gate.gain.setValueAtTime(0, t);
        gate.gain.setValueAtTime(1, t + 0.1 + Math.random() * 0.25);
      }
    }, 420);
    return () => { window.clearInterval(timer); gate.disconnect(); };
  },
  robotic: (ctx, src, out) => {
    // Ring modulation: multiply the signal by a low carrier via a gain whose
    // value is driven (around 0) by an oscillator that swings -1..1.
    const ring = ctx.createGain();
    ring.gain.value = 0;
    const carrier = ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.value = 45;
    carrier.connect(ring.gain);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1400;
    bp.Q.value = 1.5;
    src.connect(ring).connect(bp).connect(out);
    carrier.start();
    return () => { try { carrier.stop(); } catch { /**/ } ring.disconnect(); carrier.disconnect(); bp.disconnect(); };
  },
};

// ---------------------------------------------------------------------------
// Chain
// ---------------------------------------------------------------------------

export class DisturbanceChain {
  private ctx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private master: GainNode | null = null;
  private keepAlive: HTMLAudioElement | null = null;
  private teardown: (() => void) | null = null;
  private level = 1;

  /** Build the graph around a freshly received remote stream. */
  connect(stream: MediaStream): void {
    this.dispose();
    const Ctor = getAudioContextCtor();
    if (!Ctor) return; // SSR / unsupported

    const ctx = new Ctor();
    this.ctx = ctx;

    // Keep-alive element (muted) so Chrome pulls samples through the graph.
    const el = new Audio();
    el.srcObject = stream;
    el.muted = true;
    el.play().catch(() => {});
    this.keepAlive = el;

    this.source = ctx.createMediaStreamSource(stream);
    this.master = ctx.createGain();
    this.master.gain.value = 1;
    this.master.connect(ctx.destination);

    void ctx.resume().catch(() => {});
    this.applyIntensity(WHISPER_LEVELS[this.level - 1]?.audioIntensity ?? 0);
  }

  /** Set the active level (1-3); re-tunes the graph to that intensity. */
  setLevel(level: number): void {
    this.level = level;
    if (this.ctx) this.applyIntensity(WHISPER_LEVELS[level - 1]?.audioIntensity ?? 0);
  }

  /** Apply an arbitrary degradation intensity (0..1) directly. */
  setIntensity(intensity: number): void {
    if (this.ctx) this.applyIntensity(intensity);
  }

  /** Apply a named disturbance phase (see WHISPER_PHASES). */
  setPhase(id: string): void {
    if (!this.ctx || !this.source || !this.master) return;
    const builder = PHASE_BUILDERS[id];
    this.clearEffect();
    this.teardown = builder ? builder(this.ctx, this.source, this.master) : null;
    if (!builder) this.applyIntensity(0);
  }

  private clearEffect(): void {
    if (this.teardown) {
      try { this.teardown(); } catch { /* ignore */ }
      this.teardown = null;
    }
    try { this.source?.disconnect(); } catch { /* ignore */ }
  }

  /** Continuous clean→chaos model (the in-game driver). */
  private applyIntensity(intensity: number): void {
    const ctx = this.ctx;
    const src = this.source;
    const out = this.master;
    if (!ctx || !src || !out) return;
    this.clearEffect();

    const band = ctx.createBiquadFilter();
    const shaper = ctx.createWaveShaper();

    if (intensity <= 0) {
      band.type = 'highpass';
      band.frequency.value = 60;
      band.Q.value = 0.7;
      shaper.curve = linearCurve();
      src.connect(band).connect(shaper).connect(out);
      this.teardown = () => { band.disconnect(); shaper.disconnect(); };
      return;
    }

    band.type = 'bandpass';
    band.frequency.value = 1400;
    band.Q.value = 0.5 + intensity * 6;
    shaper.curve = distortionCurve(intensity);
    const gate = ctx.createGain();
    const conv = ctx.createConvolver();
    conv.buffer = impulseBuffer(ctx);
    const reverb = ctx.createGain();
    reverb.gain.value = Math.max(0, intensity - 0.5) * 0.8;
    src.connect(band).connect(gate).connect(shaper).connect(out);
    shaper.connect(conv).connect(reverb).connect(out);

    const ns = loopNoise(ctx);
    const ng = ctx.createGain();
    ng.gain.value = intensity * 0.12;
    ns.connect(ng).connect(out);
    ns.start();

    let timer = 0;
    if (intensity >= 0.9) {
      timer = window.setInterval(() => {
        if (Math.random() < 0.35) {
          const t = ctx.currentTime;
          gate.gain.cancelScheduledValues(t);
          gate.gain.setValueAtTime(0, t);
          gate.gain.setValueAtTime(1, t + 0.12 + Math.random() * 0.22);
        }
      }, 450);
    }
    this.teardown = () => {
      if (timer) window.clearInterval(timer);
      try { ns.stop(); } catch { /* ignore */ }
      band.disconnect(); gate.disconnect(); shaper.disconnect();
      conv.disconnect(); reverb.disconnect(); ng.disconnect();
    };
  }

  dispose(): void {
    this.clearEffect();
    try { this.master?.disconnect(); } catch { /* ignore */ }
    if (this.keepAlive) {
      this.keepAlive.srcObject = null;
      this.keepAlive = null;
    }
    if (this.ctx) {
      void this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.source = null;
    this.master = null;
  }
}
