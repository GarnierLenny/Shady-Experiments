/**
 * Whispering Hacker — signal puzzle audio. Synthesises the tone patterns from
 * the shared SIGNALS bank with the Web Audio API (no asset files). Each player
 * only hears what they trigger locally; coordination happens by voice.
 */
import type { ToneDef } from '@shadyexperiments/shared';

let ctx: AudioContext | null = null;
function audioCtx(): AudioContext {
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
  }
  return ctx;
}

/** Play a tone sequence. Safe to call on a user gesture (resumes a suspended ctx). */
export function playTones(tones: ToneDef[]): void {
  const ac = audioCtx();
  if (ac.state === 'suspended') void ac.resume();
  let t = ac.currentTime + 0.05;
  for (const tn of tones) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    const d = tn.d ?? 0.18;
    o.type = tn.type ?? 'sine';
    o.frequency.value = tn.f;
    o.connect(g);
    g.connect(ac.destination);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.2, t + 0.012);
    g.gain.setValueAtTime(0.2, t + Math.max(0.02, d - 0.03));
    g.gain.linearRampToValueAtTime(0, t + d);
    o.start(t);
    o.stop(t + d + 0.02);
    t += d + (tn.gap ?? 0.07);
  }
}
