import { Howl } from 'howler';

type Cue = 'tension' | 'gunshot' | 'victory';

const FILES: Record<Cue, string> = {
  tension: '/audio/tension.mp3',
  gunshot: '/audio/gunshot.mp3',
  victory: '/audio/victory.mp3',
};

/**
 * Plays the duel's audio cues. Prefers real files in /public/audio (via Howler)
 * but synthesizes everything with the WebAudio API when they're missing, so the
 * game is never silent out of the box.
 *
 * Must be `unlock()`ed from a user gesture (the Ready click) to satisfy
 * browser autoplay policies.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private howls: Partial<Record<Cue, Howl>> = {};
  private fileOk: Partial<Record<Cue, boolean>> = {};
  private droneStop: (() => void) | null = null;
  private heartTimer: number | null = null;
  private unlocked = false;

  unlock(): void {
    if (this.unlocked || typeof window === 'undefined') return;
    this.unlocked = true;

    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new Ctx();
      void this.ctx.resume();
    } catch {
      this.ctx = null;
    }

    (Object.keys(FILES) as Cue[]).forEach((cue) => {
      const howl = new Howl({
        src: [FILES[cue]],
        loop: cue === 'tension',
        volume: cue === 'tension' ? 0.45 : 0.9,
        preload: true,
        onload: () => {
          this.fileOk[cue] = true;
        },
        onloaderror: () => {
          this.fileOk[cue] = false;
        },
      });
      this.howls[cue] = howl;
    });
  }

  startTension(): void {
    if (this.fileOk.tension && this.howls.tension) this.howls.tension.play();
    else this.startDrone();
  }

  stopTension(): void {
    if (this.howls.tension?.playing()) {
      this.howls.tension.fade(this.howls.tension.volume(), 0, 400);
      window.setTimeout(() => this.howls.tension?.stop(), 420);
    }
    this.stopDrone();
  }

  gunshot(): void {
    if (this.fileOk.gunshot && this.howls.gunshot) this.howls.gunshot.play();
    else this.synthGunshot();
  }

  victory(): void {
    if (this.fileOk.victory && this.howls.victory) this.howls.victory.play();
    else this.synthVictory();
  }

  dispose(): void {
    this.stopDrone();
    this.stopHeartbeat();
    Object.values(this.howls).forEach((h) => h?.unload());
    this.howls = {};
    try {
      void this.ctx?.close();
    } catch {
      /* noop */
    }
    this.ctx = null;
  }

  // -------- WebAudio fallbacks --------

  private startDrone(): void {
    const ctx = this.ctx;
    if (!ctx || this.droneStop) return;
    const t = ctx.currentTime;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, t);
    master.gain.exponentialRampToValueAtTime(0.16, t + 0.8);
    master.connect(ctx.destination);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 440;
    lp.connect(master);

    const o1 = ctx.createOscillator();
    o1.type = 'sawtooth';
    o1.frequency.value = 55;
    const o2 = ctx.createOscillator();
    o2.type = 'sawtooth';
    o2.frequency.value = 55.5;
    o1.connect(lp);
    o2.connect(lp);

    // Slow tremolo on the filter for an uneasy, swelling drone.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 4.5;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 70;
    lfo.connect(lfoGain);
    lfoGain.connect(lp.frequency);

    o1.start();
    o2.start();
    lfo.start();

    this.droneStop = () => {
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
      o1.stop(now + 0.45);
      o2.stop(now + 0.45);
      lfo.stop(now + 0.45);
    };
  }

  private stopDrone(): void {
    if (this.droneStop) {
      try {
        this.droneStop();
      } catch {
        /* noop */
      }
      this.droneStop = null;
    }
  }

  private synthGunshot(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;

    // Sharp noise crack.
    const dur = 0.3;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 700;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(1, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + dur);
    noise.connect(hp);
    hp.connect(ng);
    ng.connect(ctx.destination);
    noise.start(t);

    // Low thump under the crack.
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.9, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(og);
    og.connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.26);
  }

  /** Tense western ambience for the showdown freeze: a wind swell + a bell toll. */
  ambience(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;

    // Wind swell (band-passed noise).
    const dur = 1.9;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 480;
    bp.Q.value = 0.7;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.12, t + 0.7);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    noise.connect(bp);
    bp.connect(ng);
    ng.connect(ctx.destination);
    noise.start(t);

    // Distant bell toll (inharmonic partials, long decay).
    const f0 = 196;
    [1, 2.76, 5.4, 8.93].forEach((p, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f0 * p;
      const g = ctx.createGain();
      const peak = 0.28 / (i + 1);
      g.gain.setValueAtTime(0.0001, t + 0.15);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.18);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t + 0.15);
      o.stop(t + 2.3);
    });
  }

  /**
   * A low, quickening heart-thud for the silent hold before the draw. The
   * interval tightens with each beat so the dread ratchets up - tension in the
   * quiet rather than breaking it with music.
   */
  heartbeat(): void {
    const ctx = this.ctx;
    if (!ctx || this.heartTimer !== null) return;
    let interval = 900;
    const beat = (): void => {
      this.heartThump(0);
      this.heartThump(0.17); // lub-dub
      interval = Math.max(360, interval * 0.9);
      this.heartTimer = window.setTimeout(beat, interval);
    };
    beat();
  }

  stopHeartbeat(): void {
    if (this.heartTimer !== null) {
      window.clearTimeout(this.heartTimer);
      this.heartTimer = null;
    }
  }

  private heartThump(delay: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(72, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.2);
  }

  // -------- Standoff distractions (atmosphere only) --------

  /** Play one random western disturbance to rattle the duelists' nerves. */
  distract(): void {
    if (!this.ctx) return;
    const picks = [
      () => this.crowCaw(),
      () => this.flyBuzz(),
      () => this.coyoteHowl(),
      () => this.hammerCock(),
    ];
    picks[Math.floor(Math.random() * picks.length)]();
  }

  /** Harsh, raspy two-note crow caw. */
  private crowCaw(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const caw = (t: number, f0: number) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(f0 * 0.62, t + 0.18);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1300;
      bp.Q.value = 2.5;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      // Ring-mod the gain for the raspy crow grain.
      const ring = ctx.createOscillator();
      ring.type = 'square';
      ring.frequency.value = 45;
      const ringAmt = ctx.createGain();
      ringAmt.gain.value = 0.22;
      ring.connect(ringAmt);
      ringAmt.connect(g.gain);
      osc.connect(bp);
      bp.connect(g);
      g.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.24);
      ring.start(t);
      ring.stop(t + 0.24);
    };
    const t0 = ctx.currentTime;
    caw(t0, 1000);
    caw(t0 + 0.3, 920);
  }

  /** A fly circling your face - buzzing in and out, drifting side to side. */
  private flyBuzz(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const dur = 2.4;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 170;
    const vib = ctx.createOscillator();
    vib.frequency.value = 7;
    const vibAmt = ctx.createGain();
    vibAmt.gain.value = 18;
    vib.connect(vibAmt);
    vibAmt.connect(osc.frequency);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 950;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.5);
    g.gain.linearRampToValueAtTime(0.02, t + 1.1);
    g.gain.linearRampToValueAtTime(0.1, t + 1.7);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    osc.connect(lp);
    lp.connect(g);
    const panner =
      typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
    if (panner) {
      const pan = ctx.createOscillator();
      pan.frequency.value = 0.7;
      const panAmt = ctx.createGain();
      panAmt.gain.value = 0.85;
      pan.connect(panAmt);
      panAmt.connect(panner.pan);
      g.connect(panner);
      panner.connect(ctx.destination);
      pan.start(t);
      pan.stop(t + dur);
    } else {
      g.connect(ctx.destination);
    }
    osc.start(t);
    osc.stop(t + dur);
    vib.start(t);
    vib.stop(t + dur);
  }

  /** A lone coyote howl rolling across the plain - rise, hold, mournful fall. */
  private coyoteHowl(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(520, t + 0.5);
    osc.frequency.setValueAtTime(520, t + 1.1);
    osc.frequency.exponentialRampToValueAtTime(340, t + 1.9);
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.5;
    const vibAmt = ctx.createGain();
    vibAmt.gain.value = 12;
    vib.connect(vibAmt);
    vibAmt.connect(osc.frequency);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 780;
    bp.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.13, t + 0.5);
    g.gain.setValueAtTime(0.13, t + 1.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.0);
    osc.connect(bp);
    bp.connect(g);
    g.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 2.05);
    vib.start(t);
    vib.stop(t + 2.05);
  }

  /** The click-CLACK of a revolver hammer being thumbed back. */
  private hammerCock(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const click = (when: number, hp: number, amp: number, dur: number) => {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = hp;
      const g = ctx.createGain();
      g.gain.value = amp;
      src.connect(f);
      f.connect(g);
      g.connect(ctx.destination);
      src.start(when);
    };
    click(t, 2500, 0.45, 0.02); // cylinder tick
    click(t + 0.12, 1800, 0.6, 0.035); // hammer lock, heavier
    // A small low tock under the lock.
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(180, t + 0.12);
    o.frequency.exponentialRampToValueAtTime(90, t + 0.17);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t + 0.12);
    og.gain.exponentialRampToValueAtTime(0.22, t + 0.125);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(og);
    og.connect(ctx.destination);
    o.start(t + 0.12);
    o.stop(t + 0.21);
  }

  /** A low body-fall thud for the showdown beat. */
  thud(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(95, t);
    o.frequency.exponentialRampToValueAtTime(34, t + 0.26);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.85, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.44);
  }

  private synthVictory(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      const t = t0 + i * 0.13;
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.52);
    });
  }
}
