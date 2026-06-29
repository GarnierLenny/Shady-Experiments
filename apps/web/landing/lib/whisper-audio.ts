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
/**
 * A looping recording masks the voice. To actually *obstruct* (not just
 * decorate), we flip the signal-to-noise ratio: the voice is muffled (a lowpass
 * kills the high consonants that carry intelligibility) and pulled down, while
 * the bed is loud and swells over it in slow gusts.
 */
function sampleBed(
  url: string,
  opts: { bed: number; voice?: number; muffle?: number; gust?: number },
): PhaseBuilder {
  return (ctx, src, out) => {
    // Voice: muffled + attenuated so the bed wins the channel.
    let voiceTail: AudioNode = src;
    let lp: BiquadFilterNode | null = null;
    if (opts.muffle) {
      lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = opts.muffle;
      src.connect(lp);
      voiceTail = lp;
    }
    const vg = ctx.createGain();
    vg.gain.value = opts.voice ?? 1;
    voiceTail.connect(vg).connect(out);

    // Bed: loud, optionally swelling in slow gusts (base + LFO around it).
    const gust = opts.gust ?? 0;
    const g = ctx.createGain();
    g.gain.value = gust > 0 ? opts.bed * (1 - gust) : opts.bed;
    g.connect(out);
    let lfo: OscillatorNode | null = null;
    let lfoDepth: GainNode | null = null;
    if (gust > 0) {
      lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.16; // ~6s swell
      lfoDepth = ctx.createGain();
      lfoDepth.gain.value = opts.bed * gust;
      lfo.connect(lfoDepth).connect(g.gain);
      lfo.start();
    }

    let node: AudioBufferSourceNode | null = null;
    let cancelled = false;
    loadLoopingSample(ctx, url)
      .then((s) => { if (cancelled) return; node = s; s.connect(g); s.start(); })
      .catch(() => {});
    return () => {
      cancelled = true;
      try { node?.stop(); } catch { /* ignore */ }
      try { lfo?.stop(); } catch { /* ignore */ }
      node?.disconnect();
      g.disconnect();
      vg.disconnect();
      lp?.disconnect();
      lfo?.disconnect();
      lfoDepth?.disconnect();
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
  { id: 'wind', name: 'WIND NOISE', level: 2, blurb: 'real wind recording under the voice' },
  { id: 'saturated', name: 'SATURATED', level: 2, blurb: 'heavily overdriven, crushed' },
  { id: 'echo', name: 'ECHO', level: 3, blurb: 'repeating delay tail' },
  { id: 'latency', name: 'LATENCY +3s', level: 3, blurb: 'voice arrives ~3s late' },
  { id: 'talkie', name: 'TALKIE-WALKIE', level: 3, blurb: 'narrow band + squelch bursts' },
  { id: 'packetloss', name: 'PACKET LOSS', level: 3, blurb: 'random dropouts' },
  { id: 'robotic', name: 'ROBOTIC VOICE', level: 3, blurb: 'ring-mod robot timbre' },
];

// ── Timed rotation ─────────────────────────────────────────────────────────
// The sequencer holds each phase for a random duration inside its band, then
// drops the line clean for SEQUENCE_GAP_S before the next one. Bands by feel:
//   tiring (echo / latency / packetloss) — short, they grate fast.
//   ambiance (crowd / wind / whisper)    — longer, less frustrating.
//   spectacular (robotic / saturated / talkie) — medium.
export const SEQUENCE_GAP_S = 10;
export const PHASE_DURATIONS_S: Record<string, [number, number]> = {
  echo: [10, 20],
  latency: [10, 20],
  packetloss: [10, 20],
  crowd: [20, 40],
  wind: [20, 40],
  whisper: [20, 40],
  robotic: [15, 30],
  saturated: [15, 30],
  talkie: [15, 30],
};

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
  // Loud-bar feel: muffled, quieter voice drowned under swelling chatter.
  crowd: sampleBed(CROWD_URL, { bed: 1.0, voice: 0.68, muffle: 2400, gust: 0.3 }),
  // Howling gale: thinner, muffled voice; the wind gusts up and buries it.
  wind: sampleBed(WIND_URL, { bed: 1.1, voice: 0.7, muffle: 2600, gust: 0.5 }),
  saturated: (ctx, src, out) => {
    const pre = ctx.createGain();
    pre.gain.value = 4; // slam the signal hard into the shaper
    const sh = ctx.createWaveShaper();
    sh.curve = distortionCurve(6); // very heavy clipping
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3400;
    const g = ctx.createGain();
    g.gain.value = 0.5; // tame the boosted level
    src.connect(pre).connect(sh).connect(lp).connect(g).connect(out);
    return () => { pre.disconnect(); sh.disconnect(); lp.disconnect(); g.disconnect(); };
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
    const d = ctx.createDelay(4.0);
    d.delayTime.value = 3.0;
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
  private seqTimer = 0;
  private seqQueue: string[] = [];
  private onSeqChange: ((id: string | null) => void) | null = null;

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

  /**
   * Start the timed rotation: cycle the named phases in a shuffled order, each
   * held for a random duration inside its band (PHASE_DURATIONS_S), with
   * SEQUENCE_GAP_S of clean line between every effect. `onChange` reports the
   * active phase id, or null during a clean gap, for the UI. No-op until
   * `connect` has run; call `stopSequence` (or `dispose`) to end it.
   */
  startSequence(onChange?: (id: string | null) => void): void {
    this.stopSequence();
    this.onSeqChange = onChange ?? null;
    this.seqQueue = [];
    this.runSequenceStep();
  }

  stopSequence(): void {
    if (this.seqTimer) { window.clearTimeout(this.seqTimer); this.seqTimer = 0; }
    this.onSeqChange = null;
  }

  /** Next phase from a shuffled queue, reshuffled (so all 9 play) when drained. */
  private nextSequenceId(): string {
    if (this.seqQueue.length === 0) {
      const ids = Object.keys(PHASE_DURATIONS_S);
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }
      this.seqQueue = ids;
    }
    return this.seqQueue.shift() as string;
  }

  private runSequenceStep(): void {
    if (!this.ctx) return; // not connected / disposed
    const id = this.nextSequenceId();
    const [lo, hi] = PHASE_DURATIONS_S[id] ?? [15, 25];
    const durMs = (lo + Math.random() * (hi - lo)) * 1000;
    this.setPhase(id);
    this.onSeqChange?.(id);
    this.seqTimer = window.setTimeout(() => {
      this.applyIntensity(0); // clean breather between effects
      this.onSeqChange?.(null);
      this.seqTimer = window.setTimeout(() => this.runSequenceStep(), SEQUENCE_GAP_S * 1000);
    }, durMs);
  }

  private clearEffect(): void {
    if (this.teardown) {
      try { this.teardown(); } catch { /* ignore */ }
      this.teardown = null;
    }
    try { this.source?.disconnect(); } catch { /* ignore */ }
  }

  /**
   * Continuous clean→chaos model (the in-game driver). The higher the intensity,
   * the harder it fights the channel: a narrowing bandpass, brutal clipping, a
   * loud broadband hiss bed, smear reverb, an amplitude tremor and — the real
   * intelligibility killer — frequent, lengthening dropouts, with walkie-talkie
   * squelch stabs layered on at the very top. A limiter rides the summed bus so
   * "loud and ugly" never tips into "painful".
   */
  private applyIntensity(intensity: number): void {
    const ctx = this.ctx;
    const src = this.source;
    const out = this.master;
    if (!ctx || !src || !out) return;
    this.clearEffect();

    // Level 1 / clean: trim sub-rumble and pass straight through.
    if (intensity <= 0) {
      const band = ctx.createBiquadFilter();
      band.type = 'highpass';
      band.frequency.value = 60;
      band.Q.value = 0.7;
      const shaper = ctx.createWaveShaper();
      shaper.curve = linearCurve();
      src.connect(band).connect(shaper).connect(out);
      this.teardown = () => { band.disconnect(); shaper.disconnect(); };
      return;
    }

    // Everything sums into `mix`; the limiter tames the boosted peaks. The
    // noise bed sits in the same bus, so the voice ducks it slightly when it
    // punches through — the line "breathes" like a cheap radio's AGC.
    const mix = ctx.createGain();
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -14;
    limiter.knee.value = 6;
    limiter.ratio.value = 14;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    mix.connect(limiter).connect(out);

    // Voice path: hard drive -> narrowing bandpass -> clip -> tremor -> gate.
    const pre = ctx.createGain();
    pre.gain.value = 1 + intensity * 2.6;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1500;
    band.Q.value = 1 + intensity * 9;
    const shaper = ctx.createWaveShaper();
    shaper.curve = distortionCurve(0.35 + intensity * 1.15);
    const trem = ctx.createGain();
    const gate = ctx.createGain();
    const post = ctx.createGain();
    post.gain.value = 0.9;
    src.connect(pre).connect(band).connect(shaper).connect(trem).connect(gate).connect(post).connect(mix);

    // Smear reverb, tapped before the gate so its tail bleeds across dropouts.
    const conv = ctx.createConvolver();
    conv.buffer = impulseBuffer(ctx);
    const reverb = ctx.createGain();
    reverb.gain.value = intensity * 0.6;
    shaper.connect(conv).connect(reverb).connect(mix);

    // Loud broadband hiss fighting the voice for the channel.
    const ns = loopNoise(ctx);
    const ng = ctx.createGain();
    ng.gain.value = intensity * 0.3;
    ns.connect(ng).connect(mix);
    ns.start();

    // Tremor LFO — the line starts to flutter once it is bad.
    let lfo: OscillatorNode | null = null;
    let lfoDepth: GainNode | null = null;
    if (intensity >= 0.45) {
      const depth = Math.min(0.45, (intensity - 0.3) * 0.6);
      trem.gain.value = 1 - depth; // centre so the swing peaks near unity
      lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 5 + intensity * 4;
      lfoDepth = ctx.createGain();
      lfoDepth.gain.value = depth;
      lfo.connect(lfoDepth).connect(trem.gain);
      lfo.start();
    }

    // Squelch — band-limited static stabs, walkie-talkie style. Top level only.
    let squelch: AudioBufferSourceNode | null = null;
    let sbp: BiquadFilterNode | null = null;
    let sg: GainNode | null = null;
    let squelchTimer = 0;
    if (intensity >= 0.85) {
      squelch = loopNoise(ctx);
      sbp = ctx.createBiquadFilter();
      sbp.type = 'bandpass';
      sbp.frequency.value = 2400;
      sbp.Q.value = 2.5;
      sg = ctx.createGain();
      sg.gain.value = 0.0001;
      squelch.connect(sbp).connect(sg).connect(mix);
      squelch.start();
      const burst = sg;
      const peak = 0.25 + intensity * 0.2;
      squelchTimer = window.setInterval(() => {
        if (Math.random() < 0.5) {
          const t = ctx.currentTime;
          burst.gain.cancelScheduledValues(t);
          burst.gain.setValueAtTime(0.0001, t);
          burst.gain.exponentialRampToValueAtTime(peak, t + 0.02);
          burst.gain.exponentialRampToValueAtTime(0.0001, t + 0.18 + Math.random() * 0.12);
        }
      }, 1300);
    }

    // Dropouts — the real intelligibility killer. They start mid-ramp and turn
    // brutal at the top: more frequent, more likely, with longer holes.
    let dropTimer = 0;
    if (intensity >= 0.3) {
      const interval = Math.max(260, 560 - intensity * 260);
      const prob = 0.18 + intensity * 0.5;
      dropTimer = window.setInterval(() => {
        if (Math.random() < prob) {
          const t = ctx.currentTime;
          const len = 0.1 + Math.random() * (0.12 + intensity * 0.45);
          gate.gain.cancelScheduledValues(t);
          gate.gain.setValueAtTime(0, t);
          gate.gain.setValueAtTime(1, t + len);
        }
      }, interval);
    }

    this.teardown = () => {
      if (dropTimer) window.clearInterval(dropTimer);
      if (squelchTimer) window.clearInterval(squelchTimer);
      try { ns.stop(); } catch { /* ignore */ }
      try { squelch?.stop(); } catch { /* ignore */ }
      try { lfo?.stop(); } catch { /* ignore */ }
      pre.disconnect(); band.disconnect(); shaper.disconnect();
      trem.disconnect(); gate.disconnect(); post.disconnect();
      conv.disconnect(); reverb.disconnect(); ng.disconnect();
      lfo?.disconnect(); lfoDepth?.disconnect();
      squelch?.disconnect(); sbp?.disconnect(); sg?.disconnect();
      mix.disconnect(); limiter.disconnect();
    };
  }

  dispose(): void {
    this.stopSequence();
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
