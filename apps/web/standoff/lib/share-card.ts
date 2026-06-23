import { drawWood } from '@/lib/wood';

export interface ShareCardData {
  winnerName: string;
  loserName: string;
  reactionMs: number | null;
  winnerPhoto: string | null;
  loserPhoto: string | null;
  loserHeadline: string;
  isTie: boolean;
}

// Sheriff-star outline in a 0..100 box (matches the on-screen SVG).
const STAR: [number, number][] = [
  [50, 4],
  [60.6, 35.4],
  [93.8, 35.8],
  [67.1, 55.6],
  [77, 87.2],
  [50, 68],
  [23, 87.2],
  [32.9, 55.6],
  [6.2, 35.8],
  [39.4, 35.4],
];
const STAR_TIPS: [number, number][] = [
  [50, 4],
  [93.8, 35.8],
  [77, 87.2],
  [23, 87.2],
  [6.2, 35.8],
];

function loadImage(src: string | null): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function line(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  const ir = img.width / img.height;
  const dr = dw / dh;
  let sw: number;
  let sh: number;
  let sx: number;
  let sy: number;
  if (ir > dr) {
    sh = img.height;
    sw = sh * dr;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / dr;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  maxW: number,
  makeFont: (size: number) => string,
  startSize: number,
  minSize: number,
) {
  let size = startSize;
  ctx.font = makeFont(size);
  while (size > minSize && ctx.measureText(text).width > maxW) {
    size -= 2;
    ctx.font = makeFont(size);
  }
  ctx.fillText(text, cx, y);
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineH: number,
) {
  const words = text.split(' ');
  let lineStr = '';
  let yy = y;
  for (const w of words) {
    const test = lineStr ? `${lineStr} ${w}` : w;
    if (ctx.measureText(test).width > maxW && lineStr) {
      ctx.fillText(lineStr, x, yy);
      lineStr = w;
      yy += lineH;
    } else {
      lineStr = test;
    }
  }
  if (lineStr) ctx.fillText(lineStr, x, yy);
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
) {
  const map = (px: number, py: number): [number, number] => [
    cx + ((px - 50) / 50) * r,
    cy + ((py - 50) / 50) * r,
  ];
  ctx.fillStyle = '#2b1d0e';
  ctx.beginPath();
  STAR.forEach(([px, py], i) => {
    const [x, y] = map(px, py);
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  });
  ctx.closePath();
  ctx.fill();
  STAR_TIPS.forEach(([px, py]) => {
    const [x, y] = map(px, py);
    ctx.beginPath();
    ctx.arc(x, y, r * 0.09, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.17, 0, Math.PI * 2);
  ctx.strokeStyle = '#d8c194';
  ctx.lineWidth = Math.max(2, r * 0.05);
  ctx.stroke();
}

function woodBackground(ctx: CanvasRenderingContext2D, W: number, H: number) {
  drawWood(ctx, W, H);
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.72);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.62)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

/** A rectangle path with jittered edges - torn/aged paper. */
function roughRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  jit: number,
) {
  const step = 16;
  ctx.beginPath();
  let first = true;
  const pt = (px: number, py: number) => {
    if (first) {
      ctx.moveTo(px, py);
      first = false;
    } else ctx.lineTo(px, py);
  };
  for (let px = x; px <= x + w; px += step) pt(px, y + (Math.random() - 0.5) * jit);
  for (let py = y; py <= y + h; py += step) pt(x + w + (Math.random() - 0.5) * jit, py);
  for (let px = x + w; px >= x; px -= step) pt(px, y + h + (Math.random() - 0.5) * jit);
  for (let py = y + h; py >= y; py -= step) pt(x + (Math.random() - 0.5) * jit, py);
  ctx.closePath();
}

function drawPoster(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  angle: number,
  name: string,
  photo: HTMLImageElement | null,
  reactionMs: number | null,
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  const x = -w / 2;
  const y = -h / 2;

  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 16;
  const g = ctx.createRadialGradient(0, y + 20, 20, 0, y + 20, h);
  g.addColorStop(0, '#f2e6c6');
  g.addColorStop(0.6, '#d8c194');
  g.addColorStop(1, '#bea66f');
  ctx.fillStyle = g;
  roughRectPath(ctx, x, y, w, h, 9);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.strokeStyle = '#2b1d0e';
  ctx.lineWidth = 4;
  roughRectPath(ctx, x + 6, y + 6, w - 12, h - 12, 7);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#2b1d0e';
  drawStar(ctx, 0, y + 48, 26);
  ctx.font = '46px "Rye", Georgia, serif';
  ctx.fillText('SHERIFF', 0, y + 110);

  const pw = 150;
  const ph = 188;
  const px = -pw / 2;
  const py = y + 130;
  ctx.fillStyle = '#2b1d0e';
  ctx.fillRect(px - 5, py - 5, pw + 10, ph + 10);
  if (photo) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(px, py, pw, ph);
    ctx.clip();
    ctx.filter = 'sepia(0.55) contrast(1.06) saturate(0.85)';
    drawImageCover(ctx, photo, px, py, pw, ph);
    ctx.filter = 'none';
    ctx.restore();
  } else {
    ctx.fillStyle = '#d8c194';
    ctx.font = '14px sans-serif';
    ctx.fillText('no likeness', 0, py + ph / 2);
  }

  ctx.fillStyle = '#2b1d0e';
  fitText(
    ctx,
    name.toUpperCase(),
    0,
    py + ph + 46,
    w - 36,
    (s) => `${s}px "Rye", Georgia, serif`,
    30,
    14,
  );
  ctx.font = '600 14px "Oswald", sans-serif';
  ctx.fillText('FASTEST GUN IN THE WEST', 0, py + ph + 72);
  ctx.font = '700 22px "Oswald", Impact, sans-serif';
  ctx.fillText(
    reactionMs != null ? `DREW IN ${reactionMs} MS` : 'THE LAW WINS',
    0,
    py + ph + 106,
  );
  ctx.restore();
}

function drawNewspaper(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  angle: number,
  name: string,
  photo: HTMLImageElement | null,
  headline: string,
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  const x = -w / 2;
  const y = -h / 2;

  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 16;
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#efe8d7');
  g.addColorStop(1, '#e1d8c2');
  ctx.fillStyle = g;
  roughRectPath(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  ctx.fillStyle = '#1c1208';
  ctx.strokeStyle = '#1c1208';
  ctx.lineWidth = 2;

  ctx.font = '600 11px "Oswald", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('VOL. XLII', x + 18, y + 24);
  ctx.textAlign = 'right';
  ctx.fillText('TWO CENTS', x + w - 18, y + 24);
  ctx.textAlign = 'center';
  ctx.fillText('★ STANDOFF DUEL ★', 0, y + 24);
  line(ctx, x + 16, y + 32, x + w - 16, y + 32);

  ctx.font = '40px "Rye", Georgia, serif';
  ctx.fillText('The Frontier Gazette', 0, y + 74);
  line(ctx, x + 16, y + 86, x + w - 16, y + 86);
  line(ctx, x + 16, y + 90, x + w - 16, y + 90);
  ctx.font = '600 11px "Oswald", sans-serif';
  ctx.fillText('HIGH NOON EDITION · DUSTY GULCH', 0, y + 106);

  fitText(
    ctx,
    headline,
    0,
    y + 152,
    w - 32,
    (s) => `700 ${s}px "Oswald", Impact, sans-serif`,
    42,
    20,
  );

  const pw = 150;
  const ph = 188;
  const ppx = x + 24;
  const ppy = y + 178;
  if (photo) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(ppx, ppy, pw, ph);
    ctx.clip();
    ctx.filter = 'grayscale(1) contrast(1.3) brightness(0.95)';
    drawImageCover(ctx, photo, ppx, ppy, pw, ph);
    ctx.filter = 'none';
    ctx.restore();
    ctx.strokeRect(ppx, ppy, pw, ph);
  } else {
    ctx.fillStyle = '#1c1208';
    ctx.fillRect(ppx, ppy, pw, ph);
    ctx.fillStyle = '#e4dcc7';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('no likeness', ppx + pw / 2, ppy + ph / 2);
  }
  ctx.fillStyle = '#1c1208';
  ctx.fillRect(ppx, ppy + ph, pw, 22);
  ctx.fillStyle = '#e4dcc7';
  ctx.font = '600 11px "Oswald", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(name.toUpperCase().slice(0, 18), ppx + pw / 2, ppy + ph + 15);

  ctx.fillStyle = '#1c1208';
  ctx.textAlign = 'left';
  ctx.font = '15px "Special Elite", Georgia, serif';
  const tx = ppx + pw + 18;
  const tw = x + w - 16 - tx;
  wrapText(
    ctx,
    'The fastest hand in the territory has spoken. Another outlaw learns the dear price of a slow draw.',
    tx,
    ppy + 18,
    tw,
    21,
  );
  ctx.font = 'italic 12px Georgia, serif';
  ctx.fillStyle = 'rgba(28,18,8,0.7)';
  ctx.fillText('- Filed by the wire, High Noon', tx, ppy + ph - 4);
  ctx.restore();
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawStainRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
) {
  ctx.save();
  ctx.strokeStyle = 'rgba(20,10,2,0.22)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(20,10,2,0.1)';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx - 3, ry - 2, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawCoin(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 4;
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
  g.addColorStop(0, '#ffe9a8');
  g.addColorStop(0.35, '#e8c454');
  g.addColorStop(0.75, '#bd8a2e');
  g.addColorStop(1, '#835c1c');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  // raised rim
  ctx.strokeStyle = 'rgba(120,80,20,0.7)';
  ctx.lineWidth = Math.max(2, r * 0.12);
  ctx.beginPath();
  ctx.arc(cx, cy, r - r * 0.06, 0, Math.PI * 2);
  ctx.stroke();
  // inner light ring
  ctx.strokeStyle = 'rgba(255,238,180,0.4)';
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.beginPath();
  ctx.arc(cx, cy, r - r * 0.2, 0, Math.PI * 2);
  ctx.stroke();
  // top glint
  ctx.strokeStyle = 'rgba(255,248,214,0.5)';
  ctx.lineWidth = r * 0.08;
  ctx.beginPath();
  ctx.arc(cx, cy, r - r * 0.1, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
  ctx.restore();
}

function drawCartridge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  scale: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 3;
  const bg = ctx.createLinearGradient(-8, 0, 8, 0);
  bg.addColorStop(0, '#6e4f1a');
  bg.addColorStop(0.5, '#e3c06a');
  bg.addColorStop(1, '#6e4f1a');
  ctx.fillStyle = bg;
  ctx.strokeStyle = '#2b1d0e';
  ctx.lineWidth = 0.8;
  roundRectPath(ctx, -8, -20, 16, 40, 2);
  ctx.fill();
  ctx.stroke();
  roundRectPath(ctx, -9, 16, 18, 7, 2);
  ctx.fill();
  ctx.stroke();
  ctx.shadowColor = 'transparent';
  const cp = ctx.createLinearGradient(-6, 0, 6, 0);
  cp.addColorStop(0, '#7a3b15');
  cp.addColorStop(0.5, '#d08a4e');
  cp.addColorStop(1, '#7a3b15');
  ctx.fillStyle = cp;
  ctx.beginPath();
  ctx.moveTo(-6, -20);
  ctx.quadraticCurveTo(0, -40, 6, -20);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  rank: string,
  suit: string,
  red: boolean,
  scale = 1,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  const w = 60;
  const h = 86;
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#fbf7ee';
  roundRectPath(ctx, -w / 2, -h / 2, w, h, 6);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.07)';
  roundRectPath(ctx, -w / 2 + 4, -h / 2 + 4, w - 8, h - 8, 4);
  ctx.stroke();

  const color = red ? '#b41722' : '#161616';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  const corner = (ix: number, iy: number, rot: number) => {
    ctx.save();
    ctx.translate(ix, iy);
    ctx.rotate(rot);
    ctx.textBaseline = 'alphabetic';
    ctx.font = 'bold 11px "Oswald", sans-serif';
    ctx.fillText(rank, 0, 0);
    ctx.font = '11px Georgia, serif';
    ctx.fillText(suit, 0, 11);
    ctx.restore();
  };
  corner(-w / 2 + 9, -h / 2 + 14, 0);
  corner(w / 2 - 9, h / 2 - 6, Math.PI);

  ctx.textBaseline = 'middle';
  if (rank === '8') {
    const xs = [-9, 9];
    const ys = [-26, -9, 9, 26];
    ctx.font = '15px Georgia, serif';
    let i = 0;
    for (const cy of ys) {
      for (const cx of xs) {
        ctx.save();
        ctx.translate(cx, cy);
        if (i >= 4) ctx.rotate(Math.PI);
        ctx.fillText(suit, 0, 0);
        ctx.restore();
        i++;
      }
    }
  } else {
    ctx.font = '34px Georgia, serif';
    ctx.fillText(suit, 0, 2);
  }
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

function drawProps(ctx: CanvasRenderingContext2D) {
  drawStainRing(ctx, 165, 110, 52, 32);
  drawStainRing(ctx, 1050, 120, 46, 28);
  drawStainRing(ctx, 600, 250, 44, 27);
  drawCartridge(ctx, 110, 555, 0.4, 1.6);
  drawCartridge(ctx, 150, 580, 1.0, 1.5);
  drawCartridge(ctx, 84, 596, 0.15, 1.5);
  drawCartridge(ctx, 138, 535, 0.7, 1.4);
  drawCoin(ctx, 92, 300, 24);
  drawCoin(ctx, 1112, 360, 24);
  drawCoin(ctx, 540, 330, 22);
  drawCoin(ctx, 548, 374, 18);
  drawCard(ctx, 250, 606, -0.12, '8', '♠', false, 1.4);
  drawCard(ctx, 305, 610, 0.12, 'A', '♠', false, 1.4);
}

/** Render the full wood-table scene (sheriff poster + gazette) as a share PNG. */
export async function renderShareCard(d: ShareCardData): Promise<Blob> {
  const W = 1200;
  const H = 630;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas unsupported');

  try {
    await Promise.all([
      document.fonts.load('400 48px "Rye"'),
      document.fonts.load('700 40px "Oswald"'),
      document.fonts.load('600 14px "Oswald"'),
      document.fonts.load('15px "Special Elite"'),
    ]);
    await document.fonts.ready;
  } catch {
    /* fonts will fall back to serif/sans */
  }

  const [winImg, loseImg] = await Promise.all([
    loadImage(d.winnerPhoto),
    loadImage(d.loserPhoto),
  ]);

  woodBackground(ctx, W, H);
  drawProps(ctx);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8843c';
  ctx.font = '700 30px "Oswald", Impact, sans-serif';
  ctx.fillText('S T A N D O F F   D U E L', W / 2, 54);

  if (d.isTie) {
    drawNewspaper(
      ctx,
      W / 2,
      350,
      540,
      450,
      0,
      'THE STREET',
      loseImg ?? winImg,
      'NO BLOOD SPILLED',
    );
  } else {
    drawPoster(ctx, 330, 352, 330, 460, -0.05, d.winnerName, winImg, d.reactionMs);
    drawNewspaper(
      ctx,
      822,
      350,
      470,
      460,
      0.05,
      d.loserName,
      loseImg,
      d.loserHeadline,
    );
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(232,220,200,0.92)';
  ctx.font = '600 22px "Oswald", sans-serif';
  ctx.fillText('Think you’re faster?  ·  StandoffDuel', W / 2, H - 24);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
      'image/png',
    );
  });
}

/** Share the card via the Web Share API, falling back to a download. */
export async function shareOrDownload(
  blob: Blob,
  filename: string,
  text: string,
): Promise<void> {
  const file = new File([blob], filename, { type: blob.type || 'image/png' });
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files?: File[]; text?: string }) => Promise<void>;
  };
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], text });
      return;
    } catch {
      /* user cancelled or unsupported - fall through to download */
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
