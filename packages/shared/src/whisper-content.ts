/**
 * Whispering Hacker — puzzle engine, shared by server and both clients.
 *
 * The game is co-op and voice-only: the HACKER (P1) sees an interactive console,
 * the OPERATOR (P2) sees a reference manual. Each round a puzzle has a random
 * *instance* (what P1 reads/sees); the operator's manual is a constant reference.
 *
 * Determinism is the whole trick: the server hands both clients a per-puzzle
 * `seed` and they each run `generatePuzzle(type, seed)`, so P1's instance and
 * P2's reference can never disagree without any extra syncing. The hacker's
 * client validates locally (`checkPuzzle`) and tells the server it solved —
 * cheating only hurts your own team, so the server trusts it.
 *
 * EVERY generator is seeded — no `Math.random`, no wall-clock dates (epoch math
 * is done in UTC) — so the two clients build byte-identical instances.
 */

// ---------------------------------------------------------------------------
// Deterministic RNG — identical output on server + both clients for a given seed
// ---------------------------------------------------------------------------

/** FNV-1a hash of a string to a 32-bit seed. */
export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 PRNG seeded by a string or number; returns a () => [0,1) function. */
export function makeRng(seed: string | number): () => number {
  let a = typeof seed === 'number' ? seed >>> 0 : hashStr(seed);
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(r: () => number, arr: readonly T[]): T {
  return arr[Math.floor(r() * arr.length)];
}

// ---------------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------------

export interface WhisperLevel {
  level: number;
  name: string;
  tagline: string;
  /** 0-1 audio degradation intensity passed to the client DisturbanceChain. */
  audioIntensity: number;
}

export const WHISPER_LEVELS: WhisperLevel[] = [
  { level: 1, name: 'WHISPER', tagline: 'Keep your voice down.', audioIntensity: 0 },
  { level: 2, name: 'DISTURBANCE', tagline: 'The line is getting noisy.', audioIntensity: 0.5 },
  { level: 3, name: 'CHAOS', tagline: 'Say again? Say again?', audioIntensity: 1 },
];

// ---------------------------------------------------------------------------
// Puzzle registry
// ---------------------------------------------------------------------------

export type WhisperPuzzleType =
  | 'handshake'
  | 'coord'
  | 'wiring'
  | 'sliders'
  | 'constellation'
  | 'id'
  | 'citymap'
  | 'maze'
  | 'signal';

export interface PuzzleDef {
  type: WhisperPuzzleType;
  /** Short tab label on the hacker console + operator tab strip. */
  name: string;
  /** Puzzle header title. */
  title: string;
}

/** Which puzzles each level runs, in tab order. */
export const LEVEL_PUZZLES: Record<number, PuzzleDef[]> = {
  1: [
    { type: 'handshake', name: 'HANDSHAKE', title: 'HANDSHAKE' },
    { type: 'coord', name: 'NODE LOCK', title: 'NODE LOCK' },
  ],
  2: [
    { type: 'wiring', name: 'WIRING', title: 'WIRING' },
    { type: 'sliders', name: 'CALIBRATION', title: 'CALIBRATION' },
    { type: 'constellation', name: 'CONSTELLATION', title: 'CONSTELLATION' },
  ],
  3: [
    { type: 'id', name: 'ID CHECK', title: 'IDENTITY CHECK' },
    { type: 'citymap', name: 'CITY MAP', title: 'CITY MAP' },
    { type: 'maze', name: 'MAZE', title: 'MAZE' },
    { type: 'signal', name: 'SIGNAL', title: 'SIGNAL DECODE' },
  ],
};

/** Highest level with a puzzle plan — the run ends after this level. */
export const TOTAL_LEVELS = Object.keys(LEVEL_PUZZLES).length;

/** Per-puzzle countdown (seconds) before a tab reseeds with a fresh instance. */
export const PUZZLE_DURATION: Record<WhisperPuzzleType, number> = {
  handshake: 40,
  coord: 35,
  wiring: 45,
  sliders: 45,
  constellation: 55,
  id: 60,
  citymap: 60,
  maze: 75,
  signal: 55,
};

export function puzzleDuration(type: WhisperPuzzleType): number {
  return PUZZLE_DURATION[type] ?? 40;
}

// ---------------------------------------------------------------------------
// Level countdown (KTANE-style): one clock per level, errors burn it down
// ---------------------------------------------------------------------------

/** Seconds on the level countdown. Hit zero → the level fails and restarts. */
export const LEVEL_TIME: Record<number, number> = { 1: 180, 2: 240, 3: 300 };
export function levelTime(level: number): number {
  return LEVEL_TIME[level] ?? 180;
}
/** Survivable wrong answers per level (they light the crosses); the NEXT one fails it. */
export const MAX_STRIKES = 3;
/** Seconds each wrong answer chips off the level countdown. */
export const STRIKE_PENALTY_SEC = 15;

// ---------------------------------------------------------------------------
// Content banks (constant reference the operator reads from)
// ---------------------------------------------------------------------------

export interface ShapeDef {
  id: string;
  glyph: string;
  name: string;
  /** Inner SVG (viewBox 0 0 24 24, fill=currentColor) for crisp rendering. */
  svg: string;
}

export const SHAPES: ShapeDef[] = [
  { id: 'tri', glyph: '▲', name: 'TRIANGLE', svg: '<path d="M13.73 4a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>' },
  { id: 'cir', glyph: '●', name: 'CIRCLE', svg: '<circle cx="12" cy="12" r="10"/>' },
  { id: 'sqr', glyph: '■', name: 'SQUARE', svg: '<rect width="18" height="18" x="3" y="3" rx="2"/>' },
  { id: 'dia', glyph: '◆', name: 'DIAMOND', svg: '<path d="M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41L13.7 2.71a2.41 2.41 0 0 0-3.41 0Z"/>' },
];

export interface ColorDef {
  id: string;
  hex: string;
}

export const NODE_COLORS: ColorDef[] = [
  { id: 'green', hex: '#30a46c' },
  { id: 'amber', hex: '#f5a524' },
  { id: 'crimson', hex: '#e5484d' },
  { id: 'azure', hex: '#3b82f6' },
  { id: 'violet', hex: '#8b5cf6' },
  { id: 'bone', hex: '#d8cdb0' },
];

export const GRID_COLS = ['A', 'B', 'C', 'D', 'E'] as const;
export const GRID_ROWS = [1, 2, 3, 4, 5] as const;

/**
 * One 5×5 grid per color, each cell either empty or holding a shape. Built once
 * with a *fixed* seed so it is byte-identical on every client (the operator's
 * lookup table). Each shape appears 2-3 times per color.
 */
export const NODE_GRIDS: Record<string, Record<string, string>> = (() => {
  const cells: string[] = [];
  for (const c of GRID_COLS) for (const r of GRID_ROWS) cells.push(`${c}${r}`);
  const grids: Record<string, Record<string, string>> = {};
  for (const col of NODE_COLORS) {
    const r = makeRng(`nodegrid-v1-${col.id}`);
    const shuffled = [...cells].sort(() => r() - 0.5);
    const g: Record<string, string> = {};
    let idx = 0;
    for (const s of SHAPES) {
      const n = 2 + Math.floor(r() * 2); // 2 or 3
      for (let k = 0; k < n && idx < shuffled.length; k++) g[shuffled[idx++]] = s.id;
    }
    grids[col.id] = g;
  }
  return grids;
})();

/** Callsign → 4-char key codebook (phonetically-confusable letters on purpose). */
export const HANDSHAKE_BOOK: { cs: string; key: string }[] = [
  { cs: 'NORTH-2', key: 'BDGP' }, { cs: 'NORTH-5', key: 'TCVM' }, { cs: 'NORTH-8', key: 'PNTB' },
  { cs: 'RAVEN-1', key: 'GBSD' }, { cs: 'RAVEN-4', key: 'MCPV' }, { cs: 'RAVEN-7', key: 'DTGN' },
  { cs: 'OSCAR-3', key: 'VBPC' }, { cs: 'OSCAR-6', key: 'SNDG' }, { cs: 'OSCAR-9', key: 'PBTM' },
  { cs: 'FALCON-2', key: 'GCVN' }, { cs: 'FALCON-5', key: 'BMDP' }, { cs: 'FALCON-8', key: 'TVGC' },
  { cs: 'COBALT-1', key: 'NPBS' }, { cs: 'COBALT-4', key: 'CDTV' },
  { cs: 'ZEPHYR-3', key: 'MBGN' }, { cs: 'ZEPHYR-6', key: 'DPCT' },
];

// ---- Wiring (Among-Us style): 4 colored wires, fixed waveform → port manual ----
export interface WireColorDef { id: string; hex: string; name: string }
export const WIRE_COLORS: WireColorDef[] = [
  { id: 'red', hex: '#e5484d', name: 'RED' },
  { id: 'green', hex: '#30a46c', name: 'GREEN' },
  { id: 'blue', hex: '#3b82f6', name: 'BLUE' },
  { id: 'yellow', hex: '#f5c542', name: 'YELLOW' },
];
/** Wire slots A-D always map to WIRE_COLORS in order. */
export const WIRE_SLOTS = ['A', 'B', 'C', 'D'] as const;

export interface WaveformDef { id: string; pts: number[]; map: Record<string, number> }
export const WAVEFORMS: WaveformDef[] = [
  { id: 'w1', pts: [0.1, 0.1, 0.5, 0.5, 0.9, 0.9], map: { red: 3, green: 4, blue: 1, yellow: 2 } },
  { id: 'w2', pts: [0.1, 0.9, 0.9, 0.1, 0.1, 0.9], map: { red: 3, green: 1, blue: 4, yellow: 2 } },
  { id: 'w3', pts: [0.1, 0.4, 0.8, 1, 0.6, 0.2], map: { red: 4, green: 3, blue: 2, yellow: 1 } },
  { id: 'w4', pts: [0.9, 0.6, 0.2, 0.1, 0.5, 0.9], map: { red: 2, green: 4, blue: 1, yellow: 3 } },
  { id: 'w5', pts: [0.2, 0.9, 0.2, 0.9, 0.2, 0.9], map: { red: 1, green: 4, blue: 2, yellow: 3 } },
  { id: 'w6', pts: [0.9, 0.9, 0.5, 0.5, 0.1, 0.1], map: { red: 3, green: 2, blue: 4, yellow: 1 } },
];

// ---- Sliders: a calibration dial points at two symbols → fixed target values ----
export interface DialSymDef { id: string; svg: string }
export const DIAL_SYMS: DialSymDef[] = [
  { id: 'bolt', svg: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>' },
  { id: 'star', svg: '<path d="M12 2l2.9 6.3 6.9.6-5.2 4.5 1.6 6.7L12 16.9 5.8 20.6l1.6-6.7L2.2 8.9l6.9-.6z"/>' },
  { id: 'cross', svg: '<path d="M10.5 3h3v7.5H21v3h-7.5V21h-3v-7.5H3v-3h7.5z"/>' },
  { id: 'moon', svg: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>' },
  { id: 'drop', svg: '<path d="M12 2s7 7.3 7 12a7 7 0 1 1-14 0c0-4.7 7-12 7-12z"/>' },
  { id: 'heart', svg: '<path d="M12 21S4 13.6 4 8.5A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 8 2.5C20 13.6 12 21 12 21z"/>' },
];
/** needle ① → [Power, Cooling] */
export const SLIDER_PROFILES_A: Record<string, [number, number]> = {
  bolt: [70, 30], star: [40, 75], cross: [90, 55], moon: [25, 60], drop: [55, 15], heart: [80, 40],
};
/** needle ② → [Signal, Pressure] */
export const SLIDER_PROFILES_B: Record<string, [number, number]> = {
  bolt: [45, 85], star: [20, 65], cross: [95, 35], moon: [60, 10], drop: [30, 90], heart: [75, 50],
};

// ---- Constellation: link scattered stars into the named shape ----
export interface ConstellationDef {
  id: string;
  name: string;
  stars: [number, number][];
  closed?: boolean;
  edges?: [number, number][];
  note: string;
}
export const CONSTELLATIONS: ConstellationDef[] = [
  { id: 'cassiopeia', name: 'CASSIOPEIA', stars: [[0.06, 0.36], [0.28, 0.66], [0.5, 0.4], [0.72, 0.68], [0.94, 0.42]], note: '5 stars in a big zig-zag W' },
  { id: 'triangulum', name: 'TRIANGULUM', stars: [[0.5, 0.2], [0.2, 0.76], [0.8, 0.72]], closed: true, note: '3 stars · a clean triangle' },
  { id: 'corona', name: 'CORONA BOREALIS', stars: [[0.08, 0.62], [0.24, 0.42], [0.42, 0.32], [0.6, 0.34], [0.78, 0.48], [0.92, 0.7]], note: '6 stars curving like a crown' },
  { id: 'delphinus', name: 'DELPHINUS', stars: [[0.4, 0.28], [0.58, 0.22], [0.66, 0.42], [0.46, 0.48], [0.7, 0.72]], edges: [[0, 1], [1, 2], [2, 3], [3, 0], [2, 4]], note: 'a 4-star kite with one tail star' },
  { id: 'plough', name: 'THE PLOUGH', stars: [[0.08, 0.66], [0.28, 0.6], [0.48, 0.64], [0.64, 0.56], [0.66, 0.34], [0.88, 0.3], [0.86, 0.54]], edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]], note: '7 stars · a saucepan with a handle' },
];
export function ekey(a: number, b: number): string {
  return `${Math.min(a, b)}-${Math.max(a, b)}`;
}
export function constEdgeList(c: ConstellationDef): [number, number][] {
  if (c.edges) return c.edges;
  const chain = c.stars
    .map((_, i) => (i < c.stars.length - 1 ? ([i, i + 1] as [number, number]) : null))
    .filter((x): x is [number, number] => x !== null);
  return c.closed ? chain.concat([[c.stars.length - 1, 0]]) : chain;
}

// ---- Identity check: read an ID card, verify it against the registry + date ----
export interface FaceDef {
  skin: string;
  hair: 'short' | 'long' | 'bun' | 'bald';
  hairColor: string;
  glasses: boolean;
  beard: boolean;
}
export interface PersonDef {
  nom: string;
  prenom: string;
  sexe: 'M' | 'F';
  age: number;
  pays: string;
  eyes: string;
  face: FaceDef;
}
export const COUNTRIES = ['CANADA', 'FRANCE', 'BRAZIL', 'JAPAN', 'NIGERIA', 'GERMANY', 'MEXICO', 'SWEDEN', 'EGYPT', 'NORWAY', 'ITALY', 'BELGIUM', 'PORTUGAL', 'AUSTRIA', 'MOROCCO', 'CROATIA'];
export const EYE_COLORS = ['BROWN', 'BLUE', 'GREEN', 'HAZEL', 'GRAY', 'AMBER'];
export const PEOPLE: PersonDef[] = [
  { nom: 'MERCER', prenom: 'JONAS', sexe: 'M', age: 34, pays: 'CANADA', eyes: 'BROWN', face: { skin: '#e8b98f', hair: 'short', hairColor: '#2a1d12', glasses: false, beard: true } },
  { nom: 'MERCIER', prenom: 'JONAH', sexe: 'M', age: 38, pays: 'BELGIUM', eyes: 'GREEN', face: { skin: '#f1c9a5', hair: 'short', hairColor: '#5a3a1e', glasses: true, beard: false } },
  { nom: 'OKAFOR', prenom: 'AMARA', sexe: 'F', age: 29, pays: 'NIGERIA', eyes: 'BROWN', face: { skin: '#7a4a24', hair: 'bun', hairColor: '#1a1208', glasses: false, beard: false } },
  { nom: 'OKADA', prenom: 'AMIRA', sexe: 'F', age: 31, pays: 'JAPAN', eyes: 'BROWN', face: { skin: '#f0cda3', hair: 'long', hairColor: '#15110c', glasses: true, beard: false } },
  { nom: 'TANAKA', prenom: 'KENJI', sexe: 'M', age: 41, pays: 'JAPAN', eyes: 'BROWN', face: { skin: '#f0cda3', hair: 'short', hairColor: '#15110c', glasses: true, beard: false } },
  { nom: 'TANAKA', prenom: 'KENTA', sexe: 'M', age: 27, pays: 'JAPAN', eyes: 'BROWN', face: { skin: '#e3b88c', hair: 'short', hairColor: '#15110c', glasses: false, beard: true } },
  { nom: 'NAKATA', prenom: 'KENJI', sexe: 'M', age: 47, pays: 'JAPAN', eyes: 'GRAY', face: { skin: '#f0cda3', hair: 'bald', hairColor: '#9a9a98', glasses: false, beard: false } },
  { nom: 'LINDQVIST', prenom: 'ELSA', sexe: 'F', age: 26, pays: 'SWEDEN', eyes: 'BLUE', face: { skin: '#f3d2b3', hair: 'long', hairColor: '#caa15a', glasses: false, beard: false } },
  { nom: 'LINDGREN', prenom: 'ELLA', sexe: 'F', age: 24, pays: 'NORWAY', eyes: 'GREEN', face: { skin: '#f3d2b3', hair: 'bun', hairColor: '#caa15a', glasses: true, beard: false } },
  { nom: 'ROSSI', prenom: 'MARCO', sexe: 'M', age: 52, pays: 'ITALY', eyes: 'GREEN', face: { skin: '#e3b88c', hair: 'bald', hairColor: '#9a9a98', glasses: true, beard: true } },
  { nom: 'BOSSI', prenom: 'MARCO', sexe: 'M', age: 45, pays: 'ITALY', eyes: 'BROWN', face: { skin: '#d9a06b', hair: 'short', hairColor: '#3a2616', glasses: false, beard: true } },
  { nom: 'ROSSO', prenom: 'MARKUS', sexe: 'M', age: 39, pays: 'GERMANY', eyes: 'BLUE', face: { skin: '#f3d2b3', hair: 'short', hairColor: '#caa15a', glasses: false, beard: false } },
  { nom: 'SILVA', prenom: 'BEATRIZ', sexe: 'F', age: 37, pays: 'BRAZIL', eyes: 'HAZEL', face: { skin: '#c89160', hair: 'long', hairColor: '#3a2616', glasses: false, beard: false } },
  { nom: 'SILVA', prenom: 'BEATRIX', sexe: 'F', age: 33, pays: 'PORTUGAL', eyes: 'BROWN', face: { skin: '#c89160', hair: 'bun', hairColor: '#1a1208', glasses: true, beard: false } },
  { nom: 'SILVEIRA', prenom: 'BIANCA', sexe: 'F', age: 30, pays: 'BRAZIL', eyes: 'BROWN', face: { skin: '#b97f47', hair: 'long', hairColor: '#3a2616', glasses: false, beard: false } },
  { nom: 'MULLER', prenom: 'LUKAS', sexe: 'M', age: 23, pays: 'GERMANY', eyes: 'GRAY', face: { skin: '#f1c9a5', hair: 'short', hairColor: '#caa15a', glasses: false, beard: false } },
  { nom: 'MOLLER', prenom: 'LUCAS', sexe: 'M', age: 29, pays: 'AUSTRIA', eyes: 'BROWN', face: { skin: '#f1c9a5', hair: 'short', hairColor: '#5a3a1e', glasses: false, beard: true } },
  { nom: 'HASSAN', prenom: 'NORA', sexe: 'F', age: 45, pays: 'EGYPT', eyes: 'AMBER', face: { skin: '#b97f47', hair: 'bun', hairColor: '#1a1208', glasses: true, beard: false } },
  { nom: 'HASSEN', prenom: 'NOORA', sexe: 'F', age: 41, pays: 'MOROCCO', eyes: 'BROWN', face: { skin: '#b97f47', hair: 'long', hairColor: '#1a1208', glasses: false, beard: false } },
  { nom: 'KOVAC', prenom: 'MILAN', sexe: 'M', age: 36, pays: 'CROATIA', eyes: 'BLUE', face: { skin: '#e8b98f', hair: 'short', hairColor: '#5a3a1e', glasses: false, beard: true } },
];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
/** Format an epoch (ms) as `DD MON YYYY` in UTC, so both clients agree. */
export function formatIdDate(epoch: number): string {
  const d = new Date(epoch);
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// ---- City map: describe a top-down city, guide the dig onto the treasure ----
// Each map is a square top-down image; `treasure` is the dig target in the
// 300×300 view space and `landmark` is what the operator points P1 to.
export interface CityMapDef {
  id: string;
  name: string;
  img: string;
  treasure: [number, number];
  desc: string;
  landmark: string;
}
export const CITY_MAPS: CityMapDef[] = [
  {
    id: 'loop', name: 'THE LOOP', img: '/whispering-hacker/maps/map1.png',
    treasure: [120, 262], landmark: 'the train station on the south track',
    desc: 'Railway tracks ring the whole city, with a river and three bridges down the east side',
  },
  {
    id: 'fort', name: 'THE FORT', img: '/whispering-hacker/maps/map2.png',
    treasure: [242, 50], landmark: 'inside the walled fort',
    desc: 'A walled fort in the north-east corner, a green roundabout dead centre, water along the west and south',
  },
  {
    id: 'mercy', name: 'MERCY GENERAL', img: '/whispering-hacker/maps/map3.png',
    treasure: [222, 140], landmark: 'the hospital with the red cross',
    desc: 'A hospital marked with a red cross on the east side, a football pitch north-east, a small jetty south-west',
  },
  {
    id: 'waterworks', name: 'WATERWORKS', img: '/whispering-hacker/maps/map4.png',
    treasure: [78, 232], landmark: 'the water tower in the south-west',
    desc: 'A football pitch north-east, a smokestack factory south-east, and a lone water tower south-west',
  },
  {
    id: 'airfield', name: 'AIRFIELD', img: '/whispering-hacker/maps/map5.png',
    treasure: [52, 54], landmark: 'the airfield with the parked plane',
    desc: 'A small airfield with a plane north-west, a factory north-east, and a football pitch in the south',
  },
];

// ---- Maze (démineur): P1 blind, P2 has the full map + mines ----
export interface MazeDef {
  id: string;
  name: string;
  cols: number;
  rows: number;
  start: [number, number];
  exit: [number, number];
}
export const MAZES: MazeDef[] = [
  { id: 'MZ1', name: 'MAZE ALPHA', cols: 6, rows: 5, start: [0, 0], exit: [5, 4] },
  { id: 'MZ2', name: 'MAZE BRAVO', cols: 7, rows: 5, start: [0, 4], exit: [6, 0] },
  { id: 'MZ3', name: 'MAZE CHARLIE', cols: 6, rows: 6, start: [0, 0], exit: [5, 5] },
  { id: 'MZ4', name: 'MAZE DELTA', cols: 7, rows: 6, start: [3, 0], exit: [3, 5] },
  { id: 'MZ5', name: 'MAZE ECHO', cols: 5, rows: 5, start: [0, 0], exit: [4, 4] },
];
export interface MazeGrid { cols: number; rows: number; open: Set<string> }
/** Recursive-backtracker perfect maze, deterministic per id. `open` holds `a-b` cell-pair keys. */
export function mazeGrid(id: string): MazeGrid {
  const m = MAZES.find((x) => x.id === id)!;
  const { cols, rows } = m;
  const r = makeRng(id);
  const idx = (c: number, rr: number) => rr * cols + c;
  const vis = new Array(cols * rows).fill(false);
  const open = new Set<string>();
  const st: [number, number][] = [[0, 0]];
  vis[0] = true;
  while (st.length) {
    const [c, rr] = st[st.length - 1];
    const nb: [number, number][] = [];
    if (rr > 0 && !vis[idx(c, rr - 1)]) nb.push([c, rr - 1]);
    if (rr < rows - 1 && !vis[idx(c, rr + 1)]) nb.push([c, rr + 1]);
    if (c > 0 && !vis[idx(c - 1, rr)]) nb.push([c - 1, rr]);
    if (c < cols - 1 && !vis[idx(c + 1, rr)]) nb.push([c + 1, rr]);
    if (nb.length) {
      const [nc, nr] = nb[Math.floor(r() * nb.length)];
      open.add(`${idx(c, rr)}-${idx(nc, nr)}`);
      open.add(`${idx(nc, nr)}-${idx(c, rr)}`);
      vis[idx(nc, nr)] = true;
      st.push([nc, nr]);
    } else st.pop();
  }
  return { cols, rows, open };
}
/** The unique start→exit path through a perfect maze. */
export function mazePath(id: string): [number, number][] {
  const m = MAZES.find((x) => x.id === id)!;
  const g = mazeGrid(id);
  const { cols, rows, open } = g;
  const idx = (c: number, r: number) => r * cols + c;
  const s = idx(m.start[0], m.start[1]);
  const e = idx(m.exit[0], m.exit[1]);
  const prev = new Array(cols * rows).fill(-2);
  prev[s] = -1;
  const q = [s];
  while (q.length) {
    const cur = q.shift()!;
    if (cur === e) break;
    const c = cur % cols;
    const r = (cur - c) / cols;
    for (const [nc, nr] of [[c, r - 1], [c, r + 1], [c - 1, r], [c + 1, r]] as [number, number][]) {
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const n = idx(nc, nr);
      if (prev[n] !== -2) continue;
      if (!open.has(`${cur}-${n}`)) continue;
      prev[n] = cur;
      q.push(n);
    }
  }
  const path: [number, number][] = [];
  let cur = e;
  while (cur >= 0) {
    const c = cur % cols;
    path.push([c, (cur - c) / cols]);
    cur = prev[cur];
  }
  return path.reverse();
}
/** Every cell that isn't on the safe corridor → a mine. Safe path stays mine-free. */
export function mazeMines(id: string): Set<string> {
  const m = MAZES.find((x) => x.id === id)!;
  const g = mazeGrid(id);
  const path = mazePath(id);
  const ps = new Set(path.map(([c, r]) => `${c},${r}`));
  const sk = m.start.join(',');
  const ek = m.exit.join(',');
  const mines = new Set<string>();
  for (let r = 0; r < g.rows; r++)
    for (let c = 0; c < g.cols; c++) {
      const k = `${c},${r}`;
      if (ps.has(k) || k === sk || k === ek) continue;
      mines.add(k);
    }
  return mines;
}

// ---- Signal: a private synth pattern mapped to one fixed order of the 4 shapes ----
export interface ToneDef { f: number; d?: number; gap?: number; type?: 'sine' | 'square' | 'triangle' | 'sawtooth' }
export interface SignalDef { id: string; name: string; desc: string; order: string[]; tones: ToneDef[] }
export const SIGNALS: SignalDef[] = [
  { id: 'rise', name: 'RISING', desc: 'three beeps climbing up', order: ['tri', 'cir', 'sqr', 'dia'], tones: [{ f: 440, d: 0.16 }, { f: 620, d: 0.16 }, { f: 880, d: 0.24 }] },
  { id: 'fall', name: 'FALLING', desc: 'three beeps dropping down', order: ['dia', 'sqr', 'cir', 'tri'], tones: [{ f: 880, d: 0.16 }, { f: 620, d: 0.16 }, { f: 440, d: 0.24 }] },
  { id: 'alarm', name: 'ALARM', desc: 'fast two-tone warble', order: ['cir', 'tri', 'dia', 'sqr'], tones: [{ f: 760, d: 0.1, gap: 0.02 }, { f: 520, d: 0.1, gap: 0.02 }, { f: 760, d: 0.1, gap: 0.02 }, { f: 520, d: 0.1, gap: 0.02 }, { f: 760, d: 0.1, gap: 0.02 }, { f: 520, d: 0.1 }] },
  { id: 'morse', name: 'MORSE', desc: 'three short then one long', order: ['tri', 'sqr', 'dia', 'cir'], tones: [{ f: 600, d: 0.09, gap: 0.07 }, { f: 600, d: 0.09, gap: 0.07 }, { f: 600, d: 0.09, gap: 0.13 }, { f: 600, d: 0.36 }] },
  { id: 'pulse', name: 'PULSE', desc: 'four flat, even beeps', order: ['dia', 'cir', 'sqr', 'tri'], tones: [{ f: 520, d: 0.12, gap: 0.1 }, { f: 520, d: 0.12, gap: 0.1 }, { f: 520, d: 0.12, gap: 0.1 }, { f: 520, d: 0.12 }] },
  { id: 'chirp', name: 'CHIRP', desc: 'quick high sweep then a low thud', order: ['sqr', 'dia', 'tri', 'cir'], tones: [{ f: 1040, d: 0.1, type: 'square' }, { f: 880, d: 0.08, type: 'square' }, { f: 180, d: 0.28, type: 'sine' }] },
];

// ---------------------------------------------------------------------------
// Instances + generation
// ---------------------------------------------------------------------------

export interface HandshakeInstance {
  type: 'handshake';
  challenge: string;
  answer: { key: string };
}
export interface CoordInstance {
  type: 'coord';
  target: { color: string; shape: string };
  answer: { cells: string[] };
}
export interface WiringInstance {
  type: 'wiring';
  /** Waveform id the hacker describes. */
  wave: string;
  /** Wire slot (A-D) → port (1-4). */
  answer: { map: Record<string, number> };
}
export interface SlidersInstance {
  type: 'sliders';
  sym1: string;
  sym2: string;
  answer: { p: number; c: number; s: number; x: number };
}
export interface ConstellationStar { id: number; x: number; y: number; r: number }
export interface ConstellationInstance {
  type: 'constellation';
  cid: string;
  stars: ConstellationStar[];
  vb: [number, number];
  answer: { edges: string[] };
}
export interface IdCard {
  nom: string;
  prenom: string;
  sexe: string;
  age: number;
  pays: string;
  eyes: string;
  face: FaceDef;
  /** Epoch ms (UTC). */
  expiry: number;
}
export interface IdInstance {
  type: 'id';
  /** Epoch ms (UTC) the operator checks expiry against. */
  today: number;
  card: IdCard;
  /** Whether the card should be granted (precomputed; the operator deduces it). */
  valid: boolean;
}
export interface CityMapInstance {
  type: 'citymap';
  cid: string;
  treasure: [number, number];
}
export interface MazeInstance {
  type: 'maze';
  cid: string;
}
export interface SignalInstance {
  type: 'signal';
  sig: string;
  answer: { order: string[] };
}

export type PuzzleInstance =
  | HandshakeInstance
  | CoordInstance
  | WiringInstance
  | SlidersInstance
  | ConstellationInstance
  | IdInstance
  | CityMapInstance
  | MazeInstance
  | SignalInstance;

/** A random-ish UTC "system date" derived from the seed. */
function genSysDate(r: () => number): number {
  const y = 2024 + Math.floor(r() * 6);
  const mo = Math.floor(r() * 12);
  const da = 1 + Math.floor(r() * 28);
  return Date.UTC(y, mo, da, Math.floor(r() * 24), Math.floor(r() * 60), Math.floor(r() * 60));
}
function expiryFrom(r: () => number, today: number, future: boolean): number {
  const day = 864e5;
  return Math.round(today + (future ? 200 + r() * 2200 : -(30 + r() * 1300)) * day);
}

/** Deterministically build a puzzle instance from a seed (same on every client). */
export function generatePuzzle(type: WhisperPuzzleType, seed: string): PuzzleInstance {
  const r = makeRng(seed);
  switch (type) {
    case 'handshake': {
      const e = pick(r, HANDSHAKE_BOOK);
      return { type: 'handshake', challenge: e.cs, answer: { key: e.key } };
    }
    case 'coord': {
      const color = pick(r, NODE_COLORS).id;
      const shape = pick(r, SHAPES).id;
      const grid = NODE_GRIDS[color];
      const cells = Object.keys(grid).filter((c) => grid[c] === shape).sort();
      return { type: 'coord', target: { color, shape }, answer: { cells } };
    }
    case 'wiring': {
      const wv = pick(r, WAVEFORMS);
      const map: Record<string, number> = {};
      WIRE_SLOTS.forEach((slot, i) => { map[slot] = wv.map[WIRE_COLORS[i].id]; });
      return { type: 'wiring', wave: wv.id, answer: { map } };
    }
    case 'sliders': {
      const a = pick(r, DIAL_SYMS);
      const b = pick(r, DIAL_SYMS);
      const pa = SLIDER_PROFILES_A[a.id];
      const pb = SLIDER_PROFILES_B[b.id];
      return { type: 'sliders', sym1: a.id, sym2: b.id, answer: { p: pa[0], c: pa[1], s: pb[0], x: pb[1] } };
    }
    case 'constellation': {
      const c = pick(r, CONSTELLATIONS);
      const W = 460;
      const H = 300;
      const pad = 42;
      const stars: ConstellationStar[] = c.stars.map((p, i) => ({
        id: i,
        x: +(pad + (p[0] + (r() - 0.5) * 0.035) * (W - 2 * pad)).toFixed(1),
        y: +(pad + (p[1] + (r() - 0.5) * 0.035) * (H - 2 * pad)).toFixed(1),
        r: pick(r, [3.3, 4.0, 4.8, 5.4]),
      }));
      const edges = constEdgeList(c).map((e) => ekey(e[0], e[1]));
      return { type: 'constellation', cid: c.id, stars, vb: [W, H], answer: { edges } };
    }
    case 'id': {
      const person = pick(r, PEOPLE);
      const forge = r() < 0.5;
      const ftype = forge ? pick(r, ['photo', 'eyes', 'age', 'pays', 'sexe', 'expired']) : null;
      const today = genSysDate(r);
      const card: IdCard = {
        nom: person.nom, prenom: person.prenom, sexe: person.sexe, age: person.age,
        pays: person.pays, eyes: person.eyes, face: person.face, expiry: expiryFrom(r, today, true),
      };
      if (ftype === 'photo') card.face = pick(r, PEOPLE.filter((p) => p !== person)).face;
      else if (ftype === 'eyes') card.eyes = pick(r, EYE_COLORS.filter((e) => e !== person.eyes));
      else if (ftype === 'age') card.age = person.age + (r() < 0.5 ? -1 : 1) * (4 + Math.floor(r() * 10));
      else if (ftype === 'pays') card.pays = pick(r, COUNTRIES.filter((c) => c !== person.pays));
      else if (ftype === 'sexe') card.sexe = person.sexe === 'M' ? 'F' : 'M';
      else if (ftype === 'expired') card.expiry = expiryFrom(r, today, false);
      return { type: 'id', today, card, valid: !forge };
    }
    case 'citymap': {
      const m = pick(r, CITY_MAPS);
      return { type: 'citymap', cid: m.id, treasure: m.treasure };
    }
    case 'maze': {
      const m = pick(r, MAZES);
      return { type: 'maze', cid: m.id };
    }
    case 'signal': {
      const s = pick(r, SIGNALS);
      return { type: 'signal', sig: s.id, answer: { order: [...s.order] } };
    }
  }
}

/** Hacker-side validation. `submission` shape depends on the puzzle type. */
export function checkPuzzle(instance: PuzzleInstance, submission: unknown): boolean {
  switch (instance.type) {
    case 'handshake':
      return typeof submission === 'string' && submission === instance.answer.key;
    case 'coord': {
      if (!Array.isArray(submission)) return false;
      const a = [...instance.answer.cells].sort().join(',');
      const b = [...submission].map(String).sort().join(',');
      return a.length > 0 && a === b;
    }
    case 'wiring': {
      if (!submission || typeof submission !== 'object') return false;
      const sub = submission as Record<string, number>;
      return WIRE_SLOTS.every((slot) => sub[slot] === instance.answer.map[slot]);
    }
    case 'sliders': {
      if (!submission || typeof submission !== 'object') return false;
      const s = submission as { p: number; c: number; s: number; x: number };
      const a = instance.answer;
      return s.p === a.p && s.c === a.c && s.s === a.s && s.x === a.x;
    }
    case 'constellation': {
      if (!Array.isArray(submission)) return false;
      const a = [...instance.answer.edges].sort().join(',');
      const b = [...submission].map(String).sort().join(',');
      return a.length > 0 && a === b;
    }
    case 'id':
      return typeof submission === 'boolean' && submission === instance.valid;
    case 'citymap': {
      if (!Array.isArray(submission) || submission.length !== 2) return false;
      const [x, y] = submission as number[];
      const [tx, ty] = instance.treasure;
      return Math.hypot(x - tx, y - ty) <= 24;
    }
    case 'maze': {
      // Submission is the cell `[c,r]` the token reached; solved when it's the exit.
      if (!Array.isArray(submission) || submission.length !== 2) return false;
      const m = MAZES.find((x) => x.id === instance.cid);
      return !!m && submission[0] === m.exit[0] && submission[1] === m.exit[1];
    }
    case 'signal': {
      if (!Array.isArray(submission)) return false;
      return submission.map(String).join('-') === instance.answer.order.join('-');
    }
  }
}
