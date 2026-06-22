'use client';

import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { DUEL_TIMINGS, GameStartPayload } from '@standoffduel/shared';
import type { CinematicPhase } from '@/hooks/useDuel';
import type { EyeFocus } from '@/hooks/useFaceFocus';

interface DuelStageProps {
  localVideo: HTMLVideoElement | null;
  remoteVideo: HTMLVideoElement | null;
  remoteReady: boolean;
  phase: CinematicPhase;
  start: GameStartPayload | null;
  focusLocal: MutableRefObject<EyeFocus>;
  focusRemote: MutableRefObject<EyeFocus>;
  selfName: string;
  oppName: string;
  /** Which half topples during the showdown beat ('left' = local player). */
  loserSide: 'left' | 'right' | null;
  /** Hands the composited canvas to the parent so the duel can be recorded. */
  onReady?: (canvas: HTMLCanvasElement) => void;
  /** Stack the duelists top/bottom instead of side-by-side (portrait phones). */
  vertical?: boolean;
}

const ZOOM_MAX = 2.7;
// Final letterbox tightness: the visible strip height as a fraction of the
// screen once the bars are fully in. Smaller = thicker bars = tighter on the
// eyes. 0.22 ≈ a narrow Leone slit showing just the gaze.
const EYE_STRIP_FRAC = 0.22;

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeIn = (t: number) => t * t * t;
// Once the eyes are revealed, frame the full bodies centered (matches the raw
// video + the hand-circle overlay) instead of staying pinned on the eyes.
const CENTER_FOCUS: EyeFocus = { x: 0.5, y: 0.5, scale: 0.1, found: true };
const lerpFocus = (a: EyeFocus, b: EyeFocus, t: number): EyeFocus => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  scale: a.scale + (b.scale - a.scale) * t,
  found: true,
});
// Showdown beat: how long everything freezes before the loser's frame topples.
const SHOWDOWN_FREEZE_MS = 1500;
const SHOWDOWN_FALL_MS = 1100;

/**
 * The cinematic surface. A single requestAnimationFrame loop composites both
 * webcams with a Sergio-Leone push-in on the eyes, a 2.4:1 letterbox, the
 * white draw-flash and the DRAW! title - all driven by the phase + server timing.
 */
export function DuelStage(props: DuelStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const phaseStart = useRef(performance.now());

  useEffect(() => {
    phaseStart.current = performance.now();
  }, [props.phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Expose the live canvas so the parent can capture a shareable clip.
    propsRef.current.onReady?.(canvas);

    let raf = 0;
    let stopped = false;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(2, Math.round(rect.width * dpr));
      canvas.height = Math.max(2, Math.round(rect.height * dpr));
    };
    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      if (stopped) return;
      raf = requestAnimationFrame(render);

      const {
        phase,
        start,
        localVideo,
        remoteVideo,
        remoteReady,
        focusLocal,
        focusRemote,
        selfName,
        oppName,
        loserSide,
      } = propsRef.current;

      const W = canvas.width;
      const H = canvas.height;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);

      const zoomMs = start?.zoomMs ?? DUEL_TIMINGS.ZOOM_MS;
      const dezoomMs = start?.dezoomMs ?? DUEL_TIMINGS.DEZOOM_MS;
      const elapsed = performance.now() - phaseStart.current;

      let zoom = 1;
      let bar = 0; // 0 = no letterbox (full frame for the duel), 1 = full bars
      let dezoomE = 0;
      if (phase === 'zoom') {
        const e = easeInOut(clamp(elapsed / zoomMs, 0, 1));
        zoom = 1 + (ZOOM_MAX - 1) * e;
        bar = e; // push in + close the bars on the eyes
      } else if (phase === 'dezoom') {
        // Snap back fast (capped) to clear the frame for the duel.
        dezoomE = easeOut(clamp(elapsed / Math.min(dezoomMs, 1100), 0, 1));
        zoom = ZOOM_MAX - (ZOOM_MAX - 1) * dezoomE;
        bar = 1 - dezoomE; // open the letterbox back up
      }

      // ----- Orientation-aware framing -----
      // Landscape: panels side by side, letterbox bars top + bottom.
      // Portrait (phones): panels stacked top/bottom, letterbox bars left + right.
      const vertical = propsRef.current.vertical ?? false;
      const strip = lerp(1, EYE_STRIP_FRAC, bar);

      let contentX: number;
      let contentY: number;
      let contentW: number;
      let contentH: number;
      let lx: number; // local panel origin
      let ly: number;
      let rx: number; // remote panel origin
      let ry: number;
      let pw: number; // panel size
      let ph: number;
      if (vertical) {
        // Full-width stacked panels. The eye push-in comes from `zoom` + focus;
        // we skip the letterbox slit here because narrowing the width would crop
        // the (horizontal) eyes sideways. Bars stay zero-width.
        contentW = W;
        contentX = 0;
        contentH = H;
        contentY = 0;
        pw = W;
        ph = H / 2;
        lx = 0;
        ly = 0; // local = top
        rx = 0;
        ry = H / 2; // remote = bottom
      } else {
        contentH = H * strip;
        contentY = (H - contentH) / 2;
        contentW = W;
        contentX = 0;
        pw = W / 2;
        ph = contentH;
        lx = 0; // local = left
        ly = contentY;
        rx = W / 2; // remote = right
        ry = contentY;
      }

      // Eyes during the push-in; during the pull-back, glide the focus from the
      // eyes to centre so it doesn't snap sideways when the duel framing starts.
      let fLocal: EyeFocus;
      let fRemote: EyeFocus;
      if (phase === 'zoom') {
        fLocal = focusLocal.current;
        fRemote = focusRemote.current;
      } else if (phase === 'dezoom') {
        fLocal = lerpFocus(focusLocal.current, CENTER_FOCUS, dezoomE);
        fRemote = lerpFocus(focusRemote.current, CENTER_FOCUS, dezoomE);
      } else {
        fLocal = CENTER_FOCUS;
        fRemote = CENTER_FOCUS;
      }
      drawHalf(ctx, localVideo, lx, ly, pw, ph, zoom, fLocal, true);
      if (remoteReady && remoteVideo) {
        drawHalf(ctx, remoteVideo, rx, ry, pw, ph, zoom, fRemote, false);
      } else {
        drawWaiting(ctx, rx, ry, pw, ph, H);
      }

      // Divider between the duelists.
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      if (vertical) ctx.fillRect(contentX, H / 2 - 1, contentW, 2);
      else ctx.fillRect(W / 2 - 1, contentY, 2, contentH);

      // Showdown: the loser's frame falls away, bleeding red.
      if (phase === 'showdown' && loserSide) {
        const isLeftLoser = loserSide === 'left';
        const px = isLeftLoser ? lx : rx;
        const py = isLeftLoser ? ly : ry;
        const fall = easeIn(
          clamp((elapsed - SHOWDOWN_FREEZE_MS) / SHOWDOWN_FALL_MS, 0, 1),
        );
        const loserVideo = isLeftLoser ? localVideo : remoteVideo;
        // Black void behind the departing panel.
        ctx.fillStyle = '#000';
        ctx.fillRect(px, py, pw, ph);
        ctx.save();
        if (vertical) {
          // Slide the loser's panel out toward its own edge, clipped to its cell.
          ctx.beginPath();
          ctx.rect(px, py, pw, ph);
          ctx.clip();
          ctx.translate(0, (isLeftLoser ? -1 : 1) * fall * ph * 0.6);
          ctx.globalAlpha = 1 - fall * 0.7;
        } else {
          // Tip off the bottom edge + drop.
          const pivotX = px + pw / 2;
          const pivotY = py + ph;
          ctx.translate(pivotX, pivotY);
          ctx.rotate((isLeftLoser ? -1 : 1) * fall * 1.3);
          ctx.translate(-pivotX, -pivotY);
          ctx.translate(0, fall * ph * 0.25);
          ctx.globalAlpha = 1 - fall * 0.5;
        }
        drawHalf(ctx, loserVideo, px, py, pw, ph, 1, CENTER_FOCUS, isLeftLoser);
        ctx.restore();
        // Blood wash creeping over the loser.
        ctx.fillStyle = `rgba(124,29,18,${0.12 + fall * 0.45})`;
        ctx.fillRect(px, py, pw, ph);
      }

      vignette(ctx, contentX, contentY, contentW, contentH);

      // Gunsmoke drifting from the winner's muzzle (between the duelists).
      if (phase === 'showdown') {
        const st = clamp(elapsed / 1600, 0, 1);
        if (vertical) {
          drawSmoke(ctx, contentX + contentW * 0.5, H / 2, st, contentW * 0.1);
        } else {
          const size = pw * 0.1;
          const yMuzzle = contentY + contentH * 0.58;
          if (loserSide !== 'left') drawSmoke(ctx, pw * 0.8, yMuzzle, st, size);
          if (loserSide !== 'right') drawSmoke(ctx, pw * 1.2, yMuzzle, st, size);
        }
      }

      // Crisp letterbox bars.
      ctx.fillStyle = '#000';
      if (vertical) {
        ctx.fillRect(0, 0, contentX, H);
        ctx.fillRect(contentX + contentW, 0, W - (contentX + contentW), H);
      } else {
        ctx.fillRect(0, 0, W, contentY);
        ctx.fillRect(0, contentY + contentH, W, H - (contentY + contentH));
      }

      // Name plates (fade out as we push in).
      const plateAlpha =
        phase === 'zoom'
          ? 1 - clamp(elapsed / zoomMs, 0, 1)
          : phase === 'dezoom'
            ? clamp(elapsed / dezoomMs, 0, 1)
            : phase === 'wait'
              ? 1
              : 0;
      drawNamePlate(ctx, selfName, lx, ly, pw, ph, H, plateAlpha, false);
      drawNamePlate(ctx, oppName, rx, ry, pw, ph, H, plateAlpha, !vertical);

      if (phase === 'draw') {
        const flash = clamp(1 - elapsed / 420, 0, 1);
        if (flash > 0) {
          ctx.fillStyle = `rgba(255,255,255,${flash})`;
          ctx.fillRect(0, 0, W, H);
        }
        drawDrawTitle(ctx, W, H, elapsed);
      }

      if (phase === 'result') {
        ctx.fillStyle = 'rgba(12,10,9,0.55)';
        ctx.fillRect(0, 0, W, H);
      }
    };

    raf = requestAnimationFrame(render);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />;
}

function drawHalf(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement | null,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  zoom: number,
  focus: EyeFocus,
  mirror: boolean,
) {
  if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
    ctx.fillStyle = '#0c0a09';
    ctx.fillRect(dx, dy, dw, dh);
    return;
  }
  const vW = video.videoWidth;
  const vH = video.videoHeight;
  const destAR = dw / dh;
  const srcAR = vW / vH;

  let cropW: number;
  let cropH: number;
  if (srcAR > destAR) {
    cropH = vH;
    cropW = vH * destAR;
  } else {
    cropW = vW;
    cropH = vW / destAR;
  }
  cropW /= zoom;
  cropH /= zoom;

  const fx = focus?.found ? focus.x : 0.5;
  const fy = focus?.found ? focus.y : 0.35;
  let sx = fx * vW - cropW / 2;
  let sy = fy * vH - cropH / 2;
  sx = clamp(sx, 0, vW - cropW);
  sy = clamp(sy, 0, vH - cropH);

  ctx.save();
  ctx.beginPath();
  ctx.rect(dx, dy, dw, dh);
  ctx.clip();
  if (mirror) {
    ctx.translate(dx + dw, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, cropW, cropH, 0, 0, dw, dh);
  } else {
    ctx.drawImage(video, sx, sy, cropW, cropH, dx, dy, dw, dh);
  }
  ctx.restore();
}

function drawWaiting(
  ctx: CanvasRenderingContext2D,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  H: number,
) {
  ctx.fillStyle = '#15110f';
  ctx.fillRect(dx, dy, dw, dh);
  ctx.fillStyle = '#8a8178';
  ctx.textAlign = 'center';
  ctx.font = `${Math.round(H * 0.026)}px "Special Elite", monospace`;
  ctx.fillText('WAITING FOR', dx + dw / 2, dy + dh / 2 - H * 0.012);
  ctx.fillText('OPPONENT', dx + dw / 2, dy + dh / 2 + H * 0.02);
}

function drawNamePlate(
  ctx: CanvasRenderingContext2D,
  name: string,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  H: number,
  alpha: number,
  alignRight: boolean,
) {
  if (alpha <= 0.02 || !name) return;
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  const pad = H * 0.02;
  ctx.font = `${Math.round(H * 0.03)}px "Oswald", Impact, sans-serif`;
  ctx.textAlign = alignRight ? 'right' : 'left';
  const x = alignRight ? dx + dw - pad : dx + pad;
  const y = dy + dh - pad;
  ctx.lineWidth = Math.max(2, H * 0.004);
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.fillStyle = '#f5efe1';
  ctx.strokeText(name.toUpperCase(), x, y);
  ctx.fillText(name.toUpperCase(), x, y);
  ctx.restore();
}

function vignette(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const g = ctx.createRadialGradient(
    x + w / 2,
    y + h / 2,
    Math.min(w, h) * 0.3,
    x + w / 2,
    y + h / 2,
    Math.max(w, h) * 0.7,
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

function drawDrawTitle(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  elapsed: number,
) {
  const pop = clamp(elapsed / 160, 0, 1);
  const scale = 0.7 + 0.3 * easeInOut(pop);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(scale, scale);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(H * 0.22)}px "Oswald", Impact, sans-serif`;
  ctx.lineWidth = Math.max(4, H * 0.01);
  ctx.strokeStyle = '#0c0a09';
  ctx.fillStyle = '#e8843c';
  ctx.strokeText('DRAW!', 0, 0);
  ctx.fillText('DRAW!', 0, 0);
  ctx.restore();
}

function drawSmoke(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  t: number,
  size: number,
) {
  const N = 6;
  for (let i = 0; i < N; i++) {
    const ph = clamp((t - i * 0.1) / 0.8, 0, 1);
    if (ph <= 0) continue;
    const x = ox + Math.sin(i * 1.7 + ph * 2) * size * 0.5;
    const y = oy - ph * size * 3.2;
    const r = size * (0.5 + ph * 1.4);
    const a = Math.sin(ph * Math.PI) * 0.28;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(222,212,200,${a})`);
    g.addColorStop(1, 'rgba(222,212,200,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}
