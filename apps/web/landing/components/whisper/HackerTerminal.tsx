'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CITY_MAPS,
  CityMapInstance,
  ConstellationInstance,
  CoordInstance,
  GRID_COLS,
  GRID_ROWS,
  HandshakeInstance,
  IdInstance,
  MAZES,
  MazeInstance,
  NODE_COLORS,
  PuzzleSlot,
  SHAPES,
  SIGNALS,
  SignalInstance,
  SlidersInstance,
  WAVEFORMS,
  WIRE_COLORS,
  WIRE_SLOTS,
  WiringInstance,
  checkPuzzle,
  ekey,
  formatIdDate,
  generatePuzzle,
  mazeGrid,
  mazeMines,
  puzzleDuration,
} from '@shadyexperiments/shared';
import { dialSvg, faceSvg, mazeFogSvg, waveSvg } from '../../lib/whisper-draw';
import { playTones } from '../../lib/whisper-signal';

function fmt(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function Shape({ id }: { id: string }) {
  const s = SHAPES.find((x) => x.id === id);
  if (!s) return null;
  return <svg viewBox="0 0 24 24" fill="currentColor" dangerouslySetInnerHTML={{ __html: s.svg }} />;
}

function Svg({ html, className, style }: { html: string; className?: string; style?: React.CSSProperties }) {
  return <div className={className} style={style} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Pointer position in an SVG's viewBox units. */
function svgXY(svg: SVGSVGElement | null, e: React.PointerEvent, vw: number, vh: number) {
  if (!svg) return { x: 0, y: 0 };
  const r = svg.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * vw, y: ((e.clientY - r.top) / r.height) * vh };
}

interface HackerProps {
  puzzles: PuzzleSlot[];
  level: number;
  totalLevels: number;
  startedAt: number | null;
  onSolved: (index: number, seed: string) => void;
}

export function HackerTerminal({ puzzles, onSolved }: HackerProps) {
  const [active, setActive] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [fb, setFb] = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  // Prefer an unsolved tab once the active one clears.
  useEffect(() => {
    if (puzzles[active]?.solved) {
      const next = puzzles.findIndex((p) => !p.solved);
      if (next >= 0) setActive(next);
    }
  }, [puzzles, active]);

  const slot = puzzles[active];

  function tryAnswer(ok: boolean, index: number, seed: string) {
    if (ok) {
      setFb({ msg: '✓ ACCESS GRANTED', ok: true });
      onSolved(index, seed);
    } else {
      setFb({ msg: '✕ ACCESS DENIED', ok: false });
      window.setTimeout(() => setFb(null), 1200);
    }
  }

  return (
    <div className="center">
      <div className="hud">
        <span className="corner tl" /><span className="corner tr" /><span className="corner bl" /><span className="corner br" />

        <div className="tabs">
          {puzzles.map((p, i) => {
            const dur = puzzleDuration(p.type) * 1000;
            const remain = p.deadline ? Math.max(0, p.deadline - now) : 0;
            const warn = !p.solved && remain <= 8000;
            const pct = p.solved ? 100 : Math.max(0, Math.min(100, (remain / dur) * 100));
            return (
              <div
                key={p.index}
                className={['tab', i === active ? 'active' : '', p.solved ? 'done' : ''].join(' ')}
                onClick={() => setActive(i)}
              >
                <div className="n">
                  <span>SYS 0{i + 1}</span>
                  <span className={`cd${warn ? ' warn' : ''}`}>{p.solved ? '✓' : fmt(remain)}</span>
                </div>
                <div className="t">
                  <span>{p.name}</span>
                  {p.solved && <span className="chk">✓</span>}
                </div>
                <div className="bar"><i className={warn ? 'warn' : ''} style={{ width: `${pct}%` }} /></div>
              </div>
            );
          })}
        </div>

        <div className="pcard" style={{ marginTop: 18 }}>
          {slot ? (
            slot.solved ? (
              <>
                <h1 className="htitle">{slot.title}</h1>
                <div className="uline" />
                <div className="pbody">
                  <p className="prompt" style={{ color: 'var(--green)', textAlign: 'center', marginTop: 24 }}>
                    ✓ Subsystem secured. Pivot to another tab.
                  </p>
                </div>
              </>
            ) : (
              <HackerPuzzle
                key={`${slot.index}:${slot.seed}`}
                slot={slot}
                onTry={(ok) => tryAnswer(ok, slot.index, slot.seed)}
              />
            )
          ) : null}
        </div>

        <div className={`fb${fb ? (fb.ok ? ' ok' : ' bad') : ''}`}>{fb?.msg ?? ''}</div>
      </div>
    </div>
  );
}

function HackerPuzzle({ slot, onTry }: { slot: PuzzleSlot; onTry: (ok: boolean) => void }) {
  const inst = useMemo(() => generatePuzzle(slot.type, slot.seed), [slot.type, slot.seed]);
  return (
    <>
      <h1 className="htitle">{slot.title}</h1>
      <div className="uline" />
      <div className="pbody">
        {inst.type === 'handshake' ? <Handshake inst={inst} onTry={onTry} />
          : inst.type === 'coord' ? <Coord inst={inst} onTry={onTry} />
          : inst.type === 'wiring' ? <Wiring inst={inst} onTry={onTry} />
          : inst.type === 'sliders' ? <Sliders inst={inst} onTry={onTry} />
          : inst.type === 'constellation' ? <Constellation inst={inst} onTry={onTry} />
          : inst.type === 'id' ? <IdCheck inst={inst} onTry={onTry} />
          : inst.type === 'citymap' ? <CityMap inst={inst} onTry={onTry} />
          : inst.type === 'maze' ? <Maze inst={inst} onTry={onTry} />
          : inst.type === 'signal' ? <Signal inst={inst} onTry={onTry} />
          : null}
      </div>
    </>
  );
}

const KEYPAD = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

function Handshake({ inst, onTry }: { inst: HandshakeInstance; onTry: (ok: boolean) => void }) {
  const [val, setVal] = useState('');
  const type = (l: string) => setVal((v) => (v.length >= 4 ? v : v + l));
  return (
    <>
      <div className="hschallenge">
        <div className="hslbl">Read this callsign aloud</div>
        <div className="hsval">{inst.challenge}</div>
      </div>
      <div className="hsslots">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`hsbox${i === val.length ? ' cur' : ''}`}>{val[i] ?? ''}</div>
        ))}
      </div>
      <div className="keypad">
        {KEYPAD.map((row, ri) => (
          <div key={ri} className="kprow">
            {row.split('').map((l) => (
              <button key={l} className="key" onClick={() => type(l)}>{l}</button>
            ))}
            {ri === 2 && (
              <button className="key bs" onClick={() => setVal((v) => v.slice(0, -1))}>DEL</button>
            )}
          </div>
        ))}
      </div>
      <button className="btn submit" disabled={val.length !== 4} onClick={() => onTry(checkPuzzle(inst, val))}>
        ESTABLISH LINK
      </button>
    </>
  );
}

function Coord({ inst, onTry }: { inst: CoordInstance; onTry: (ok: boolean) => void }) {
  const [sel, setSel] = useState<string[]>([]);
  const color = NODE_COLORS.find((c) => c.id === inst.target.color);
  const shape = SHAPES.find((s) => s.id === inst.target.shape);
  const toggle = (cell: string) => setSel((s) => (s.includes(cell) ? s.filter((x) => x !== cell) : [...s, cell]));
  return (
    <>
      <div className="entlbl">Read the target — select every match</div>
      <div className="target">
        <div className="tgt">
          <span className="tgtsw" style={{ background: color?.hex }} />
          <span className="tgtlbl">{inst.target.color.toUpperCase()}</span>
        </div>
        <div className="tgt">
          <span className="tgtshape"><Shape id={inst.target.shape} /></span>
          <span className="tgtlbl">{shape?.name}</span>
        </div>
      </div>
      <div className="gridwrap">
        <div className="grid5">
          <div className="ghead" />
          {GRID_COLS.map((c) => <div key={c} className="ghead">{c}</div>)}
          {GRID_ROWS.map((r) => (
            <CoordRow key={r} r={r} sel={sel} toggle={toggle} />
          ))}
        </div>
      </div>
      <button className="btn submit" disabled={sel.length === 0} onClick={() => onTry(checkPuzzle(inst, sel))}>
        LOCK {sel.length} CELL{sel.length === 1 ? '' : 'S'}
      </button>
    </>
  );
}

function CoordRow({ r, sel, toggle }: { r: number; sel: string[]; toggle: (cell: string) => void }) {
  return (
    <>
      <div className="rowlbl">{r}</div>
      {GRID_COLS.map((c) => {
        const cell = `${c}${r}`;
        return (
          <div key={cell} className={`cell${sel.includes(cell) ? ' sel' : ''}`} onClick={() => toggle(cell)}>
            {cell}
          </div>
        );
      })}
    </>
  );
}

// --- Wiring: drag each colored wire (A-D) onto a port (1-4) ---
const WIRE_VW = 300, WIRE_VH = 232, WIRE_LY = [34, 90, 146, 202];
function Wiring({ inst, onTry }: { inst: WiringInstance; onTry: (ok: boolean) => void }) {
  const wave = WAVEFORMS.find((w) => w.id === inst.wave)!;
  const svgRef = useRef<SVGSVGElement>(null);
  const [conns, setConns] = useState<Record<string, number>>({});
  const [drag, setDrag] = useState<(typeof WIRE_SLOTS)[number] | null>(null);
  const [ptr, setPtr] = useState<{ x: number; y: number } | null>(null);
  const [mag, setMag] = useState<number | null>(null);

  const plugX = 50, portX = 250;
  const onDown = (e: React.PointerEvent) => {
    const pt = svgXY(svgRef.current, e, WIRE_VW, WIRE_VH);
    let hit: (typeof WIRE_SLOTS)[number] | null = null;
    WIRE_SLOTS.forEach((s, i) => { if (Math.hypot(pt.x - plugX, pt.y - WIRE_LY[i]) < 24) hit = s; });
    if (hit) {
      e.currentTarget.setPointerCapture(e.pointerId);
      setConns((c) => { const n = { ...c }; delete n[hit!]; return n; });
      setDrag(hit); setPtr(pt); setMag(null);
    }
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const pt = svgXY(svgRef.current, e, WIRE_VW, WIRE_VH);
    let best = 1e9, m: number | null = null;
    [1, 2, 3, 4].forEach((n, i) => { const d = Math.hypot(pt.x - portX, pt.y - WIRE_LY[i]); if (d < 42 && d < best) { best = d; m = n; } });
    setPtr(pt); setMag(m);
  };
  const onUp = () => {
    if (drag && mag != null) {
      const next = { ...conns };
      for (const k of Object.keys(next)) if (next[k] === mag) delete next[k];
      next[drag] = mag;
      setConns(next);
      if (WIRE_SLOTS.every((s) => next[s])) onTry(checkPuzzle(inst, next));
    }
    setDrag(null); setPtr(null); setMag(null);
  };

  return (
    <>
      <div className="entlbl" style={{ textAlign: 'center' }}>Describe the waveform — connect each wire to the port the operator names</div>
      <Svg className="wavebox" html={waveSvg(wave.pts, 160, 46, 'currentColor')} />
      <div className="wirewrap">
        <svg ref={svgRef} className="wiresvg2" viewBox={`0 0 ${WIRE_VW} ${WIRE_VH}`}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} style={{ touchAction: 'none' }}>
          {WIRE_SLOTS.map((s, i) => conns[s] && (
            <line key={`c${s}`} x1={plugX} y1={WIRE_LY[i]} x2={portX} y2={WIRE_LY[conns[s] - 1]}
              stroke={WIRE_COLORS[i].hex} strokeWidth={7} strokeLinecap="round" />
          ))}
          {drag && ptr && (
            <line x1={plugX} y1={WIRE_LY[WIRE_SLOTS.indexOf(drag)]}
              x2={mag != null ? portX : ptr.x} y2={mag != null ? WIRE_LY[mag - 1] : ptr.y}
              stroke={WIRE_COLORS[WIRE_SLOTS.indexOf(drag)].hex} strokeWidth={7} strokeLinecap="round" opacity={0.85} />
          )}
          {WIRE_SLOTS.map((s, i) => (
            <g key={s}>
              <circle cx={plugX} cy={WIRE_LY[i]} r={15} fill={WIRE_COLORS[i].hex} stroke="#0a0b0c" strokeWidth={1.5} />
              <text x={plugX} y={WIRE_LY[i] + 5} textAnchor="middle" fontSize={14} fontWeight={700} fontFamily="monospace" fill="#0a0b0c">{s}</text>
            </g>
          ))}
          {[1, 2, 3, 4].map((n, i) => {
            const taken = Object.values(conns).includes(n);
            return (
              <g key={n}>
                <rect x={portX - 15} y={WIRE_LY[i] - 15} width={30} height={30} rx={5}
                  fill={mag === n ? 'rgba(233,186,76,.18)' : 'rgba(255,255,255,.03)'}
                  stroke={mag === n ? 'var(--amber)' : taken ? 'var(--line2)' : 'var(--line2)'} strokeWidth={1.5} />
                <text x={portX} y={WIRE_LY[i] + 5} textAnchor="middle" fontSize={14} fontFamily="monospace" fill="var(--ink)">{n}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </>
  );
}

// --- Sliders: set the four gauges to the values the operator reads off the dial ---
const SLIDER_ROWS: [string, 'p' | 'c' | 's' | 'x'][] = [['POWER', 'p'], ['COOLING', 'c'], ['SIGNAL', 's'], ['PRESSURE', 'x']];
function Sliders({ inst, onTry }: { inst: SlidersInstance; onTry: (ok: boolean) => void }) {
  const [vals, setVals] = useState({ p: 50, c: 50, s: 50, x: 50 });
  const set = (k: 'p' | 'c' | 's' | 'x', v: number) => {
    const next = { ...vals, [k]: v };
    setVals(next);
    if (checkPuzzle(inst, next)) onTry(true);
  };
  return (
    <>
      <Svg className="dialbox" html={`<span class="wavelbl">Calibration dial — name both needles (① amber · ② cyan)</span>${dialSvg(inst.sym1, inst.sym2)}`} />
      <div className="sldpanel">
        {SLIDER_ROWS.map(([lbl, k]) => (
          <div key={k} className="sldrow">
            <span className="sldlbl">{lbl}</span>
            <input type="range" min={0} max={100} step={5} value={vals[k]} className="sld" onChange={(e) => set(k, +e.target.value)} />
            <span className="sldval">{vals[k]}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// --- Constellation: drag star to star to link them into the named shape ---
function Constellation({ inst, onTry }: { inst: ConstellationInstance; onTry: (ok: boolean) => void }) {
  const [W, H] = inst.vb;
  const svgRef = useRef<SVGSVGElement>(null);
  const [edges, setEdges] = useState<Set<string>>(new Set());
  const [drag, setDrag] = useState<number | null>(null);
  const [ptr, setPtr] = useState<{ x: number; y: number } | null>(null);
  const [mag, setMag] = useState<number | null>(null);

  const onDown = (e: React.PointerEvent) => {
    const pt = svgXY(svgRef.current, e, W, H);
    let best = 1e9, hit: number | null = null;
    inst.stars.forEach((s) => { const d = Math.hypot(s.x - pt.x, s.y - pt.y); if (d < s.r + 14 && d < best) { best = d; hit = s.id; } });
    if (hit != null) { e.currentTarget.setPointerCapture(e.pointerId); setDrag(hit); setPtr(pt); setMag(null); }
  };
  const onMove = (e: React.PointerEvent) => {
    if (drag == null) return;
    const pt = svgXY(svgRef.current, e, W, H);
    let best = 1e9, m: number | null = null;
    inst.stars.forEach((s) => { if (s.id === drag) return; const d = Math.hypot(s.x - pt.x, s.y - pt.y); if (d < 38 && d < best) { best = d; m = s.id; } });
    setPtr(pt); setMag(m);
  };
  const onUp = () => {
    if (drag != null && mag != null && mag !== drag) {
      const k = ekey(drag, mag);
      const next = new Set(edges);
      if (next.has(k)) next.delete(k); else next.add(k);
      setEdges(next);
      if (checkPuzzle(inst, [...next])) onTry(true);
    }
    setDrag(null); setPtr(null); setMag(null);
  };

  return (
    <>
      <div className="entlbl" style={{ textAlign: 'center' }}>Drag star to star to link them — they snap magnetically. Describe what you see.</div>
      <div className="skywrap">
        <svg ref={svgRef} className="sky" viewBox={`0 0 ${W} ${H}`} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} style={{ touchAction: 'none' }}>
          {[...edges].map((k) => {
            const [a, b] = k.split('-').map(Number);
            const s1 = inst.stars.find((s) => s.id === a), s2 = inst.stars.find((s) => s.id === b);
            return s1 && s2 ? <line key={k} x1={s1.x} y1={s1.y} x2={s2.x} y2={s2.y} stroke="var(--amber)" strokeWidth={2.5} strokeLinecap="round" opacity={0.9} /> : null;
          })}
          {drag != null && ptr && (() => {
            const a = inst.stars.find((s) => s.id === drag)!;
            const m = mag != null ? inst.stars.find((s) => s.id === mag) : null;
            return <line x1={a.x} y1={a.y} x2={m ? m.x : ptr.x} y2={m ? m.y : ptr.y} stroke="var(--amber)" strokeWidth={2.5} strokeLinecap="round" opacity={0.5} strokeDasharray="2 7" />;
          })()}
          {inst.stars.map((s) => {
            const hot = drag === s.id || mag === s.id;
            return (
              <g key={s.id}>
                {hot && <circle cx={s.x} cy={s.y} r={s.r + 5} fill="none" stroke="var(--amber)" strokeWidth={1.5} opacity={mag === s.id ? 0.9 : 0.5} />}
                <circle className={`stardot${hot ? ' sel' : ''}`} cx={s.x} cy={s.y} r={mag === s.id ? s.r + 1 : s.r} fill={hot ? 'var(--amber-b)' : '#eef3ff'} />
              </g>
            );
          })}
        </svg>
      </div>
      <div className="skybtns">
        <button className="btn ghost" onClick={() => setEdges(new Set())}>CLEAR</button>
        <span className="skycount">{edges.size} link{edges.size === 1 ? '' : 's'} drawn</span>
      </div>
    </>
  );
}

// --- Identity check: read the card aloud, grant only if it all checks out ---
function IdCheck({ inst, onTry }: { inst: IdInstance; onTry: (ok: boolean) => void }) {
  const c = inst.card;
  const F = (l: string, v: string | number) => (
    <div className="idfield"><span>{l}</span><b>{v}</b></div>
  );
  return (
    <>
      <div className="entlbl" style={{ textAlign: 'center' }}>Read every field to your operator — grant entry only if it all checks out</div>
      <div className="idcard">
        <div className="idleft">
          <Svg className="idphoto" html={faceSvg(c.face, 132)} />
          <div className="idphotocap">PHOTO</div>
        </div>
        <div className="idright">
          <div className="idhead"><span>IDENTITY CARD</span><span className="idchip" /></div>
          <div className="idgrid">
            {F('SURNAME', c.nom)}{F('GIVEN NAME', c.prenom)}{F('SEX', c.sexe)}{F('AGE', c.age)}
            {F('COUNTRY', c.pays)}{F('EYES', c.eyes)}{F('EXPIRES', formatIdDate(c.expiry))}
          </div>
        </div>
      </div>
      <div className="idbtns">
        <button className="btn idgrant" onClick={() => onTry(checkPuzzle(inst, true))}>✓ GRANT ENTRY</button>
        <button className="btn iddeny" onClick={() => onTry(checkPuzzle(inst, false))}>✕ DENY ENTRY</button>
      </div>
    </>
  );
}

// --- City map: describe the city, then dig where the operator points ---
const MAP_VW = 300, MAP_VH = 300;
function CityMap({ inst, onTry }: { inst: CityMapInstance; onTry: (ok: boolean) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dig, setDig] = useState<{ x: number; y: number } | null>(null);
  const m = useMemo(() => CITY_MAPS.find((x) => x.id === inst.cid), [inst.cid]);
  const onClick = (e: React.MouseEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    setDig({ x: ((e.clientX - r.left) / r.width) * MAP_VW, y: ((e.clientY - r.top) / r.height) * MAP_VH });
  };
  return (
    <>
      <div className="entlbl" style={{ textAlign: 'center' }}>Describe your map to the operator, then dig exactly where they point you</div>
      <div className="mapwrap">
        <svg ref={svgRef} className="citymap" viewBox={`0 0 ${MAP_VW} ${MAP_VH}`} onClick={onClick}>
          {m && (
            <image
              href={m.img}
              x="0"
              y="0"
              width={MAP_VW}
              height={MAP_VH}
              preserveAspectRatio="xMidYMid slice"
            />
          )}
          {dig && (
            <g transform={`translate(${dig.x.toFixed(1)},${dig.y.toFixed(1)})`}>
              <circle r="8.5" fill="rgba(255,255,255,.12)" stroke="var(--amber)" strokeWidth="2" />
              <circle r="1.8" fill="var(--amber)" />
            </g>
          )}
        </svg>
      </div>
      <div className="mapbtns">
        <button className="btn ghost" onClick={() => setDig(null)}>RESET</button>
        <button className="btn" disabled={!dig} onClick={() => dig && onTry(checkPuzzle(inst, [dig.x, dig.y]))}>DIG HERE</button>
      </div>
    </>
  );
}

// --- Maze (démineur): blind run, operator steers you around the mines ---
function Maze({ inst, onTry }: { inst: MazeInstance; onTry: (ok: boolean) => void }) {
  const m = MAZES.find((x) => x.id === inst.cid)!;
  const g = useMemo(() => mazeGrid(inst.cid), [inst.cid]);
  const mines = useMemo(() => mazeMines(inst.cid), [inst.cid]);
  const [pos, setPos] = useState<[number, number]>([m.start[0], m.start[1]]);
  const [strikes, setStrikes] = useState(0);
  const idx = (c: number, r: number) => r * g.cols + c;

  const step = (dx: number, dy: number) => {
    const [c, r] = pos;
    const nc = c + dx, nr = r + dy;
    if (nc < 0 || nr < 0 || nc >= g.cols || nr >= g.rows) return; // off-grid
    if (!g.open.has(`${idx(c, r)}-${idx(nc, nr)}`)) return; // wall (visible to P1)
    if (mines.has(`${nc},${nr}`)) { // stepped on a mine → strike + knockback
      setStrikes((s) => Math.min(3, s + 1));
      setPos([m.start[0], m.start[1]]);
      return;
    }
    setPos([nc, nr]);
    if (nc === m.exit[0] && nr === m.exit[1]) onTry(checkPuzzle(inst, [nc, nr]));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
      if (map[e.key]) { e.preventDefault(); step(map[e.key][0], map[e.key][1]); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const [c, r] = pos;
  const lab = `${String.fromCharCode(65 + c)}${r + 1}`;
  const exits = ([['UP', 0, -1], ['DOWN', 0, 1], ['LEFT', -1, 0], ['RIGHT', 1, 0]] as [string, number, number][])
    .filter(([, dc, dr]) => { const nc = c + dc, nr = r + dr; return nc >= 0 && nr >= 0 && nc < g.cols && nr < g.rows && g.open.has(`${idx(c, r)}-${idx(nc, nr)}`); })
    .map((o) => o[0]);

  return (
    <>
      <div className="entlbl" style={{ textAlign: 'center' }}>Blind run — you can&apos;t see the mines. Call your cell + exits; the operator steers you clear.</div>
      <div className="mzhud">
        <div>CELL <b>{lab}</b></div>
        <div>EXITS <b>{exits.join(' · ') || '—'}</b></div>
        <div>MINES {[0, 1, 2].map((i) => <span key={i} className={`mzstrike${i < strikes ? ' on' : ''}`}>✕</span>)}</div>
      </div>
      <Svg className="mazewrap" html={mazeFogSvg(inst.cid, pos)} />
      <div className="dpad">
        <button className="dbtn up" onClick={() => step(0, -1)}>▲</button>
        <button className="dbtn left" onClick={() => step(-1, 0)}>◀</button>
        <button className="dbtn down" onClick={() => step(0, 1)}>▼</button>
        <button className="dbtn right" onClick={() => step(1, 0)}>▶</button>
      </div>
      <div className="mzcode">GRID <b>{m.name}</b> — read this to your operator first</div>
    </>
  );
}

// --- Signal: play your private sound, enter the shape order the operator reads ---
const SIG_BTNS = ['sqr', 'cir', 'dia', 'tri'];
function Signal({ inst, onTry }: { inst: SignalInstance; onTry: (ok: boolean) => void }) {
  const sig = SIGNALS.find((s) => s.id === inst.sig)!;
  const [seq, setSeq] = useState<string[]>([]);
  const push = (id: string) => { if (seq.length >= 4 || seq.includes(id)) return; setSeq([...seq, id]); };
  const lock = () => { const ok = checkPuzzle(inst, seq); if (!ok) setSeq([]); onTry(ok); };
  return (
    <>
      <div className="entlbl" style={{ textAlign: 'center' }}>Play your signal, describe it to the operator, then tap the four shapes in the order they read back</div>
      <div className="sigplay">
        <button className="btn sigplaybtn" onClick={() => playTones(sig.tones)}>▶ PLAY SIGNAL</button>
        <div className="sighint">only you can hear this</div>
      </div>
      <div className="sigslots">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`sigslot${seq[i] ? ' filled' : ''}`}>
            {seq[i] ? <Shape id={seq[i]} /> : <span style={{ color: 'var(--faint)' }}>{i + 1}</span>}
          </div>
        ))}
      </div>
      <div className="sigpad">
        {SIG_BTNS.map((id) => {
          const ix = seq.indexOf(id);
          return (
            <button key={id} className={`sigbtn${ix >= 0 ? ' on' : ''}`} disabled={ix >= 0} onClick={() => push(id)}>
              <span className="sigsh"><Shape id={id} /></span>
              {ix >= 0 && <span className="sigord">{ix + 1}</span>}
            </button>
          );
        })}
      </div>
      <div className="sigbtns">
        <button className="btn ghost" onClick={() => setSeq([])}>CLEAR</button>
        <button className="btn" disabled={seq.length !== 4} onClick={lock}>LOCK SEQUENCE</button>
      </div>
    </>
  );
}
