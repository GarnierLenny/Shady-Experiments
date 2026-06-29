/**
 * Whispering Hacker — pure SVG-string builders for the heavier, non-interactive
 * puzzle visuals. They take plain data (deterministic instances + shared banks)
 * and return SVG markup injected via `dangerouslySetInnerHTML`. Interactive
 * puzzles (wiring/constellation drags, dials, maze d-pad) are real JSX in the
 * components; these are the static pictures only.
 */
import {
  CITY_MAPS,
  ConstellationDef,
  DIAL_SYMS,
  MAZES,
  WIRE_COLORS,
  constEdgeList,
  makeRng,
  mazeGrid,
  mazeMines,
} from '@shadyexperiments/shared';

// ---- waveform + wiring ----
export function waveSvg(pts: number[], w: number, h: number, stroke: string): string {
  const n = pts.length;
  const pl = pts.map((v, i) => `${((i / (n - 1)) * w).toFixed(1)},${((1 - v) * h).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="overflow:visible;display:block"><polyline points="${pl}" fill="none" stroke="${stroke}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

export function wireDiagram(map: Record<string, number>): string {
  const W = 142, H = 128, lx = 34, rx = W - 18, ys = [16, 48, 80, 112], cs = WIRE_COLORS, L = ['A', 'B', 'C', 'D'];
  let g = '';
  cs.forEach((c, i) => { g += `<line x1="${lx}" y1="${ys[i]}" x2="${rx}" y2="${ys[map[c.id] - 1]}" stroke="${c.hex}" stroke-width="3.5" stroke-linecap="round"/>`; });
  cs.forEach((c, i) => { g += `<text x="13" y="${ys[i] + 4}" text-anchor="middle" font-size="13" font-weight="700" font-family="monospace" fill="#cfd4d5">${L[i]}</text><circle cx="${lx}" cy="${ys[i]}" r="7.5" fill="${c.hex}" stroke="#2a2114" stroke-width="1.5"/>`; });
  [1, 2, 3, 4].forEach((n, i) => { g += `<rect x="${rx - 9}" y="${ys[i] - 9}" width="18" height="18" rx="3" fill="#efe6cf" stroke="#2a2114" stroke-width="1.5"/><text x="${rx}" y="${ys[i] + 4}" text-anchor="middle" font-size="11" font-family="monospace" fill="#2a2114">${n}</text>`; });
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${g}</svg>`;
}

// ---- calibration dial (static, hacker side) ----
export function dialSvg(s1: string, s2: string): string {
  const R = 46, cx = 70, cy = 70;
  let syms = '';
  DIAL_SYMS.forEach((s, i) => {
    const a = ((-90 + i * 60) * Math.PI) / 180, x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
    let col = 'var(--faint)';
    if (s.id === s1) col = '#f8d066'; else if (s.id === s2) col = '#6fd3ec';
    syms += `<g transform="translate(${(x - 9).toFixed(1)},${(y - 9).toFixed(1)})" style="color:${col}"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">${s.svg}</svg></g>`;
  });
  const ndl = (idx: number, len: number, col: string) => {
    const a = ((-90 + idx * 60) * Math.PI) / 180;
    return `<line x1="${cx}" y1="${cy}" x2="${(cx + len * Math.cos(a)).toFixed(1)}" y2="${(cy + len * Math.sin(a)).toFixed(1)}" stroke="${col}" stroke-width="3" stroke-linecap="round"/>`;
  };
  const i1 = DIAL_SYMS.findIndex((s) => s.id === s1), i2 = DIAL_SYMS.findIndex((s) => s.id === s2);
  return `<svg viewBox="0 0 140 140" width="134" height="134"><circle cx="${cx}" cy="${cy}" r="58" fill="none" stroke="var(--line2)" stroke-width="1.5"/>${ndl(i1, 40, '#f0b43e')}${ndl(i2, 30, '#5cc8e6')}<circle cx="${cx}" cy="${cy}" r="4.5" fill="var(--ink)"/>${syms}</svg>`;
}

// ---- constellation reference chart (operator side) ----
export function constChart(c: ConstellationDef): string {
  const W = 240, H = 168, pad = 28;
  const pts = c.stars.map((p) => [pad + p[0] * (W - 2 * pad), pad + p[1] * (H - 2 * pad)]);
  const eds = constEdgeList(c);
  const L = eds.map((e) => `<line x1="${pts[e[0]][0].toFixed(1)}" y1="${pts[e[0]][1].toFixed(1)}" x2="${pts[e[1]][0].toFixed(1)}" y2="${pts[e[1]][1].toFixed(1)}" stroke="var(--amber)" stroke-width="2" stroke-linecap="round" opacity=".85"/>`).join('');
  const S = pts.map((p) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4.2" fill="#eef3ff"/>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block">${L}${S}</svg>`;
}

// ---- identity portrait ----
export function faceSvg(f: { skin: string; hair: string; hairColor: string; glasses: boolean; beard: boolean }, size: number): string {
  const s = size || 100, skin = f.skin, hc = f.hairColor;
  let g = '';
  g += `<rect x="43" y="73" width="14" height="16" fill="${skin}"/>`;
  g += `<circle cx="27" cy="54" r="4.5" fill="${skin}"/><circle cx="73" cy="54" r="4.5" fill="${skin}"/>`;
  g += `<ellipse cx="50" cy="52" rx="22" ry="26" fill="${skin}"/>`;
  if (f.hair === 'short') g += `<path d="M28 52 Q26 24 50 24 Q74 24 72 52 Q70 38 64 34 Q58 30 50 30 Q42 30 36 34 Q30 38 28 52Z" fill="${hc}"/>`;
  else if (f.hair === 'long') g += `<path d="M25 80 Q21 40 50 22 Q79 40 75 80 Q71 56 69 50 Q73 30 50 28 Q27 30 31 50 Q29 56 25 80Z" fill="${hc}"/>`;
  else if (f.hair === 'bun') g += `<circle cx="50" cy="21" r="7" fill="${hc}"/><path d="M28 52 Q28 27 50 27 Q72 27 72 52 Q72 37 50 37 Q28 37 28 52Z" fill="${hc}"/>`;
  else if (f.hair === 'bald') g += `<path d="M31 49 Q31 45 34 43 M69 49 Q69 45 66 43" stroke="${hc}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  g += `<path d="M38 47 h8 M54 47 h8" stroke="${hc}" stroke-width="1.7" stroke-linecap="round"/>`;
  g += `<circle cx="42" cy="52" r="2.4" fill="#2a2118"/><circle cx="58" cy="52" r="2.4" fill="#2a2118"/>`;
  g += `<path d="M50 55 v5 l-3 2" stroke="rgba(0,0,0,.22)" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
  if (f.beard) g += `<path d="M30 56 Q33 82 50 84 Q67 82 70 56 Q66 71 50 71 Q34 71 30 56Z" fill="${hc}" opacity=".92"/>`;
  g += `<path d="M44 67 Q50 ${f.beard ? 70 : 71} 56 67" stroke="#7a4a40" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  if (f.glasses) g += `<g stroke="#15151a" stroke-width="2" fill="none"><circle cx="42" cy="52" r="7"/><circle cx="58" cy="52" r="7"/><path d="M49 52h2"/><path d="M35 51l-6-2"/><path d="M65 51l6-2"/></g>`;
  return `<svg viewBox="0 0 100 100" width="${s}" height="${s}" style="display:block">${g}</svg>`;
}

// ---- city map ----
function distSeg(px: number, py: number, a: number[], b: number[]): number {
  const vx = b[0] - a[0], vy = b[1] - a[1], wx = px - a[0], wy = py - a[1], c1 = vx * wx + vy * wy;
  if (c1 <= 0) return Math.hypot(px - a[0], py - a[1]);
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return Math.hypot(px - b[0], py - b[1]);
  const t = c1 / c2;
  return Math.hypot(px - (a[0] + t * vx), py - (a[1] + t * vy));
}
function inRect(rs: { x: number; y: number; w: number; h: number }[] | undefined, x: number, y: number): boolean {
  if (rs) for (const p of rs) if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) return true;
  return false;
}
function smoothPath(pts: number[][]): string {
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    d += ` Q ${a[0]} ${a[1]} ${mx} ${my}`;
  }
  const e = pts[pts.length - 1];
  return d + ` L ${e[0]} ${e[1]}`;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function landClear(m: any, x: number, y: number): boolean {
  if (m.rivers) for (const r of m.rivers) for (let i = 0; i < r.pts.length - 1; i++) if (distSeg(x, y, r.pts[i], r.pts[i + 1]) < r.w / 2 + 15) return false;
  if (m.lakes) for (const l of m.lakes) { const dx = (x - l.cx) / (l.rx + 13), dy = (y - l.cy) / (l.ry + 13); if (dx * dx + dy * dy <= 1) return false; }
  if (inRect(m.parks, x, y)) return false;
  if (m.roads) for (const s of m.roads) if (distSeg(x, y, s[0], s[1]) < 16) return false;
  return true;
}
function fillCell(R: () => number, cx: number, cy: number, cell: number, dt: boolean): string {
  const pal = dt ? ['#4a5564', '#535f70'] : ['#353d48', '#3d4651'];
  const col = () => pal[Math.floor(R() * pal.length)];
  const pad = 6, x = cx + pad, y = cy + pad, s = cell - 2 * pad;
  const rc = (X: number, Y: number, W: number, H: number) => `<rect x="${X.toFixed(1)}" y="${Y.toFixed(1)}" width="${W.toFixed(1)}" height="${H.toFixed(1)}" rx="2" fill="${col()}" stroke="#13161b" stroke-width=".8"/>`;
  const r = R();
  if (r < 0.72) { const w = s * (0.8 + R() * 0.2), h = s * (0.8 + R() * 0.2); return rc(x + (s - w) * R(), y + (s - h) * R(), w, h); }
  if (r < 0.88) { const g = 3, hh = (s - g) / 2; return rc(x, y, s, hh) + rc(x, y + hh + g, s, hh); }
  const g = 3, ww = (s - g) / 2;
  return rc(x, y, ww, s) + rc(x + ww + g, y, ww, s);
}
export function drawMap(id: string): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = CITY_MAPS.find((x) => x.id === id) as any;
  const R = makeRng(id), W = 300, H = 220, cell = 34;
  let g = `<rect width="${W}" height="${H}" fill="#171a20"/>`;
  (m.roads || []).forEach((s: number[][]) => { const d = `M ${s[0][0]} ${s[0][1]} L ${s[1][0]} ${s[1][1]}`; g += `<path d="${d}" fill="none" stroke="#2c333d" stroke-width="11" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#434d5b" stroke-width="6" stroke-linecap="round"/>`; });
  (m.rivers || []).forEach((r: { pts: number[][]; w: number }) => { const d = smoothPath(r.pts); g += `<path d="${d}" fill="none" stroke="#234a66" stroke-width="${r.w + 8}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#1b3b54" stroke-width="${r.w}" stroke-linecap="round" stroke-linejoin="round"/>`; });
  (m.lakes || []).forEach((l: { cx: number; cy: number; rx: number; ry: number }) => { g += `<ellipse cx="${l.cx}" cy="${l.cy}" rx="${l.rx + 2.5}" ry="${l.ry + 2.5}" fill="#234a66"/><ellipse cx="${l.cx}" cy="${l.cy}" rx="${l.rx}" ry="${l.ry}" fill="#1b3b54"/>`; });
  (m.parks || []).forEach((p: { x: number; y: number; w: number; h: number }) => { g += `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="7" fill="#244430"/>`; const n = Math.floor((p.w * p.h) / 620); for (let i = 0; i < n; i++) { const tx = p.x + 6 + R() * (p.w - 12), ty = p.y + 6 + R() * (p.h - 12); g += `<circle cx="${tx.toFixed(1)}" cy="${ty.toFixed(1)}" r="${(2.5 + R() * 2).toFixed(1)}" fill="#356046"/>`; } });
  let bl = '';
  for (let cx = 0; cx < W; cx += cell) for (let cy = 0; cy < H; cy += cell) {
    const mx = cx + cell / 2, my = cy + cell / 2;
    if (!landClear(m, mx, my)) continue;
    if (R() < 0.3) continue;
    const dt = m.dt && mx > m.dt.x && mx < m.dt.x + m.dt.w && my > m.dt.y && my < m.dt.y + m.dt.h;
    bl += fillCell(R, cx, cy, cell, dt);
  }
  g += bl;
  (m.bridges || []).forEach((b: number[]) => { g += `<rect x="${b[0]}" y="${b[1]}" width="${b[2]}" height="${b[3]}" rx="1.5" fill="#6b7280" stroke="#888f9b" stroke-width="1"/>`; });
  (m.labels || []).forEach((l: { x: number; y: number; t: string; r?: number; s?: number }) => { g += `<text x="${l.x}" y="${l.y}" fill="#828e9e" font-size="${l.s || 8}" font-family="monospace" letter-spacing="1.2" opacity=".85"${l.r ? ` transform="rotate(${l.r} ${l.x} ${l.y})"` : ''}>${l.t}</text>`; });
  return g;
}
export function treasureMark(x: number, y: number): string {
  return `<g transform="translate(${x},${y})"><circle r="11" fill="rgba(245,197,66,.18)"/><circle r="11" fill="none" stroke="#f5c542" stroke-width="2"/><path d="M-4.5 -4.5 4.5 4.5 M4.5 -4.5 -4.5 4.5" stroke="#f5c542" stroke-width="2.6" stroke-linecap="round"/></g>`;
}
export function digMark(x: number, y: number): string {
  return `<g transform="translate(${(+x).toFixed(1)},${(+y).toFixed(1)})"><circle r="8.5" fill="rgba(255,255,255,.12)" stroke="var(--amber)" stroke-width="2"/><circle r="1.8" fill="var(--amber)"/></g>`;
}

// ---- maze ----
export function mazeFogSvg(id: string, pos: [number, number]): string {
  const g = mazeGrid(id), cols = g.cols, rows = g.rows, idx = (c: number, r: number) => r * cols + c;
  const c = pos[0], r = pos[1], VW = 300, VH = 250, cs = 72, cx = VW / 2, cy = VH / 2, hl = cs / 2;
  const open = (dc: number, dr: number) => {
    const nc = c + dc, nr = r + dr;
    if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) return false;
    return g.open.has(`${idx(c, r)}-${idx(nc, nr)}`);
  };
  const rect = (gx: number, gy: number, sz: number, f: string) => `<rect x="${(gx - sz / 2).toFixed(1)}" y="${(gy - sz / 2).toFixed(1)}" width="${sz}" height="${sz}" rx="4" fill="${f}"/>`;
  let s = '';
  ([[0, -1], [0, 1], [-1, 0], [1, 0]] as [number, number][]).forEach(([dc, dr]) => { if (open(dc, dr)) s += rect(cx + dc * cs, cy + dr * cs, cs - 18, 'rgba(255,255,255,.05)'); });
  s += rect(cx, cy, cs - 4, 'rgba(255,255,255,.10)');
  const wall = (x1: number, y1: number, x2: number, y2: number) => `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="var(--amber-b)" stroke-width="3.5" stroke-linecap="round"/>`;
  if (!open(0, -1)) s += wall(cx - hl, cy - hl, cx + hl, cy - hl);
  if (!open(0, 1)) s += wall(cx - hl, cy + hl, cx + hl, cy + hl);
  if (!open(-1, 0)) s += wall(cx - hl, cy - hl, cx - hl, cy + hl);
  if (!open(1, 0)) s += wall(cx + hl, cy - hl, cx + hl, cy + hl);
  const arr = (dc: number, dr: number, ch: string) => `<text x="${(cx + dc * (hl + 16)).toFixed(1)}" y="${(cy + dr * (hl + 16) + 6).toFixed(1)}" text-anchor="middle" font-size="18" fill="var(--amber-b)" font-family="monospace">${ch}</text>`;
  if (open(0, -1)) s += arr(0, -1, '↑');
  if (open(0, 1)) s += arr(0, 1, '↓');
  if (open(-1, 0)) s += arr(-1, 0, '←');
  if (open(1, 0)) s += arr(1, 0, '→');
  s += `<circle cx="${cx}" cy="${cy}" r="${(cs * 0.24).toFixed(1)}" fill="var(--amber-b)" stroke="#0a0b0c" stroke-width="1.5"/>`;
  return `<svg class="maze" viewBox="0 0 ${VW} ${VH}">${s}</svg>`;
}
export function mazeDangerGrid(id: string): string {
  const m = MAZES.find((x) => x.id === id)!, g = mazeGrid(id), cols = g.cols, rows = g.rows, mines = mazeMines(id), idx = (c: number, r: number) => r * cols + c;
  const VW = 300, padL = 22, padR = 12, padT = 24, padB = 12, cs = Math.min((VW - padL - padR) / cols, 40), ox = padL + ((VW - padL - padR) - cs * cols) / 2, oy = padT, VH = oy + cs * rows + padB;
  let lbl = '';
  for (let c = 0; c < cols; c++) lbl += `<text x="${(ox + (c + 0.5) * cs).toFixed(1)}" y="${(oy - 7).toFixed(1)}" text-anchor="middle" font-size="11" fill="var(--faint)" font-family="monospace">${String.fromCharCode(65 + c)}</text>`;
  for (let r = 0; r < rows; r++) lbl += `<text x="${(ox - 10).toFixed(1)}" y="${(oy + (r + 0.5) * cs + 4).toFixed(1)}" text-anchor="middle" font-size="11" fill="var(--faint)" font-family="monospace">${r + 1}</text>`;
  let cells = '';
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = ox + c * cs, y = oy + r * cs, mx = x + cs / 2, my = y + cs / 2;
    const mine = mines.has(`${c},${r}`), st = c === m.start[0] && r === m.start[1], ex = c === m.exit[0] && r === m.exit[1];
    if (mine) cells += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${cs.toFixed(1)}" height="${cs.toFixed(1)}" fill="rgba(239,91,84,.13)"/>`;
    if (mine) cells += `<g transform="translate(${mx.toFixed(1)},${my.toFixed(1)})" stroke="#ef5b54" stroke-width="1.7" stroke-linecap="round"><circle r="${(cs * 0.12).toFixed(1)}" fill="#ef5b54" stroke="none"/><path d="M0 ${(-cs * 0.27).toFixed(1)}V${(cs * 0.27).toFixed(1)}M${(-cs * 0.27).toFixed(1)} 0H${(cs * 0.27).toFixed(1)}M${(-cs * 0.19).toFixed(1)} ${(-cs * 0.19).toFixed(1)}L${(cs * 0.19).toFixed(1)} ${(cs * 0.19).toFixed(1)}M${(cs * 0.19).toFixed(1)} ${(-cs * 0.19).toFixed(1)}L${(-cs * 0.19).toFixed(1)} ${(cs * 0.19).toFixed(1)}"/></g>`;
    if (st) cells += `<circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="${(cs * 0.2).toFixed(1)}" fill="#4ec46a"/>`;
    if (ex) cells += `<g transform="translate(${mx.toFixed(1)},${my.toFixed(1)})" stroke="#f5c542" stroke-linecap="round"><circle r="${(cs * 0.26).toFixed(1)}" fill="rgba(245,197,66,.16)" stroke="#f5c542" stroke-width="1.5"/><path d="M${(-cs * 0.12).toFixed(1)} 0H${(cs * 0.12).toFixed(1)}M0 ${(-cs * 0.12).toFixed(1)}V${(cs * 0.12).toFixed(1)}" stroke-width="2.2"/></g>`;
  }
  let w = '';
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = ox + c * cs, y = oy + r * cs;
    if (r === 0 || !g.open.has(`${idx(c, r)}-${idx(c, r - 1)}`)) w += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + cs).toFixed(1)}" y2="${y.toFixed(1)}"/>`;
    if (c === 0 || !g.open.has(`${idx(c, r)}-${idx(c - 1, r)}`)) w += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y + cs).toFixed(1)}"/>`;
  }
  w += `<line x1="${(ox + cs * cols).toFixed(1)}" y1="${oy.toFixed(1)}" x2="${(ox + cs * cols).toFixed(1)}" y2="${(oy + cs * rows).toFixed(1)}"/><line x1="${ox.toFixed(1)}" y1="${(oy + cs * rows).toFixed(1)}" x2="${(ox + cs * cols).toFixed(1)}" y2="${(oy + cs * rows).toFixed(1)}"/>`;
  return `<div class="mazeref"><svg viewBox="0 0 ${VW} ${VH.toFixed(0)}" style="display:block;width:100%;height:auto">${lbl}${cells}<g stroke="#7a8493" stroke-width="2.3" stroke-linecap="round">${w}</g></svg></div>`;
}
