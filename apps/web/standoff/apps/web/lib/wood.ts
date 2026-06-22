import type { CSSProperties } from 'react';

const BOARD_SHADES = [
  '#5b3a1d',
  '#583719',
  '#5f3e20',
  '#543518',
  '#5c3b1e',
  '#613f21',
];

function drawKnot(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.save();
  for (let r = 26; r > 3; r -= 3) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r * 0.6, 0, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(28,14,3,${0.05 + ((26 - r) / 26) * 0.14})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(24,12,3,0.45)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, 5, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Draw a clean plank-wood surface (boards + flowing grain + knots). */
export function drawWood(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.fillStyle = '#5a3a1d';
  ctx.fillRect(0, 0, W, H);

  const plankH = 104;
  let i = 0;
  for (let y = 0; y < H; y += plankH, i++) {
    ctx.fillStyle = BOARD_SHADES[i % BOARD_SHADES.length];
    ctx.fillRect(0, y, W, plankH + 1);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y, W, plankH);
    ctx.clip();
    const lines = 26;
    for (let k = 0; k < lines; k++) {
      const gy = y + ((k + 0.5) / lines) * plankH;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      for (let x = 0; x <= W; x += 36) {
        const yy =
          gy +
          Math.sin(x * 0.008 + k * 0.5 + i * 1.3) * 4 +
          Math.sin(x * 0.03 + k) * 1.3;
        ctx.lineTo(x, yy);
      }
      const dark = k % 4 === 0;
      ctx.strokeStyle = dark ? 'rgba(38,20,5,0.22)' : 'rgba(255,226,182,0.05)';
      ctx.lineWidth = dark ? 1.6 : 1;
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, y + plankH - 1, W, 2);
    ctx.fillStyle = 'rgba(255,222,182,0.06)';
    ctx.fillRect(0, y + plankH + 1, W, 1);
  }

  drawKnot(ctx, W * 0.2, plankH * 1.5);
  drawKnot(ctx, W * 0.74, plankH * 3.5);
  drawKnot(ctx, W * 0.42, plankH * 5.5);
}

/** Render the wood once to an offscreen canvas and use it as a CSS background. */
export function woodBackgroundStyle(): CSSProperties {
  if (typeof document === 'undefined') {
    return { backgroundColor: '#4a2f17' };
  }
  const c = document.createElement('canvas');
  c.width = 1400;
  c.height = 900;
  const ctx = c.getContext('2d');
  if (ctx) drawWood(ctx, c.width, c.height);
  return {
    backgroundColor: '#4a2f17',
    backgroundImage: `url("${c.toDataURL('image/jpeg', 0.85)}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    boxShadow: 'inset 0 0 220px rgba(0,0,0,0.68)',
  };
}
