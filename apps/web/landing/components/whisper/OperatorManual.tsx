'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CITY_MAPS,
  CONSTELLATIONS,
  DIAL_SYMS,
  GRID_COLS,
  GRID_ROWS,
  HANDSHAKE_BOOK,
  IdInstance,
  MAZES,
  NODE_COLORS,
  NODE_GRIDS,
  PEOPLE,
  PuzzleSlot,
  SHAPES,
  SIGNALS,
  SLIDER_PROFILES_A,
  SLIDER_PROFILES_B,
  WAVEFORMS,
  WIRE_COLORS,
  formatIdDate,
  generatePuzzle,
} from '@shadyexperiments/shared';
import { constChart, faceSvg, mazeDangerGrid, waveSvg, wireDiagram } from '../../lib/whisper-draw';
import { playTones } from '../../lib/whisper-signal';

function Shape({ id }: { id: string }) {
  const s = SHAPES.find((x) => x.id === id);
  if (!s) return null;
  return <svg viewBox="0 0 24 24" fill="currentColor" dangerouslySetInnerHTML={{ __html: s.svg }} />;
}
function Svg({ html, className, style }: { html: string; className?: string; style?: React.CSSProperties }) {
  return <div className={className} style={style} dangerouslySetInnerHTML={{ __html: html }} />;
}

type SecProps = { index: number; title: string; slot: PuzzleSlot; sel: number | null; setSel: (n: number | null) => void };

export function OperatorManual({ puzzles }: { puzzles: PuzzleSlot[]; level: number }) {
  const [active, setActive] = useState(0);
  const [sel, setSel] = useState<number | null>(null);

  useEffect(() => {
    if (active >= puzzles.length) setActive(0);
  }, [puzzles, active]);
  useEffect(() => setSel(null), [active]);

  const slot = puzzles[active];
  const p: SecProps = { index: active, title: slot?.title ?? '', slot, sel, setSel };

  return (
    <div className="center">
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div className="fomhd">
          <span className="ft">FIELD OPERATIONS MANUAL</span>
          <span className="fc">OPERATOR EYES ONLY</span>
        </div>

        <div className="fomtabs">
          {puzzles.map((q, i) => (
            <button key={q.index} className={`fomtab${i === active ? ' on' : ''}`} onClick={() => { setActive(i); setSel(null); }}>
              SYS 0{i + 1} · {q.name}{q.solved ? ' ✓' : ''}
            </button>
          ))}
        </div>

        {slot?.type === 'handshake' ? <Handshake {...p} />
          : slot?.type === 'coord' ? <Coord {...p} />
          : slot?.type === 'wiring' ? <Wiring {...p} />
          : slot?.type === 'sliders' ? <SlidersOp {...p} />
          : slot?.type === 'constellation' ? <Constellation {...p} />
          : slot?.type === 'id' ? <IdCheck {...p} />
          : slot?.type === 'citymap' ? <CityMap {...p} />
          : slot?.type === 'maze' ? <Maze {...p} />
          : slot?.type === 'signal' ? <Signal {...p} />
          : null}
      </div>
    </div>
  );
}

function SecHead({ index, title, desc }: { index: number; title: string; desc: string }) {
  return (
    <div className="fomsec">
      <div className="fomsn">Module · SYS 0{index + 1}</div>
      <div className="fomtt">{title}</div>
      <p className="fomp">{desc}</p>
    </div>
  );
}

/** Two-column list | detail scaffold shared by most operator sections. */
function ListDetail({
  index, title, desc, step1, step2, empty, items, renderItem, sel, setSel, renderDetail,
}: {
  index: number; title: string; desc: string; step1: string; step2: string; empty: string;
  items: unknown[]; renderItem: (i: number) => React.ReactNode; sel: number | null;
  setSel: (n: number | null) => void; renderDetail: (i: number) => React.ReactNode;
}) {
  return (
    <>
      <SecHead index={index} title={title} desc={desc} />
      <div className="fomgrid">
        <div className="fomcol">
          <div className="fomstep">1 · {step1}</div>
          <div className="wflist">
            {items.map((_, i) => (
              <button key={i} className={`wfrow${sel === i ? ' on' : ''}`} onClick={() => setSel(sel === i ? null : i)}>
                {renderItem(i)}
                {sel === i && <span className="wfck">✓</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="fomcol">
          <div className="fomstep">2 · {step2}</div>
          <div className="wftbl">{sel == null || sel >= items.length ? <div className="wfempty">{empty}</div> : renderDetail(sel)}</div>
        </div>
      </div>
    </>
  );
}

function Handshake({ index, title, sel, setSel }: SecProps) {
  return (
    <ListDetail
      index={index} title={title}
      desc="P1 reads a callsign. Find it in the codebook and spell its four-character key back."
      step1="Find the callsign" step2="Spell the key" empty="Pick the callsign P1 reads →"
      items={HANDSHAKE_BOOK} sel={sel} setSel={setSel}
      renderItem={(i) => <span className="wfcn">{HANDSHAKE_BOOK[i].cs}</span>}
      renderDetail={(i) => (
        <>
          <div className="wftitle">{HANDSHAKE_BOOK[i].cs}</div>
          <div className="fomtiles">{HANDSHAKE_BOOK[i].key.split('').map((ch, k) => <span key={k}>{ch}</span>)}</div>
          <p className="fomp" style={{ marginTop: 14 }}>Spell each character back to P1.</p>
        </>
      )}
    />
  );
}

function Coord({ index, title, sel, setSel }: SecProps) {
  return (
    <ListDetail
      index={index} title={title}
      desc="P1 names a color and a shape. Open that color's grid and read out every matching cell."
      step1="Pick the color" step2="Read the grid" empty="Pick the color P1 calls out →"
      items={NODE_COLORS} sel={sel} setSel={setSel}
      renderItem={(i) => <><span className="sw-dot" style={{ background: NODE_COLORS[i].hex }} /><span className="wfcn">{NODE_COLORS[i].id.toUpperCase()}</span></>}
      renderDetail={(i) => (
        <>
          <div className="wftitle"><span className="sw-dot" style={{ background: NODE_COLORS[i].hex }} />{NODE_COLORS[i].id.toUpperCase()} GRID</div>
          <DarkGrid colorId={NODE_COLORS[i].id} />
          <p className="fomp" style={{ marginTop: 10 }}>Read every cell holding the shape P1 named.</p>
        </>
      )}
    />
  );
}

function DarkGrid({ colorId }: { colorId: string }) {
  const grid = NODE_GRIDS[colorId];
  return (
    <div className="dgrid">
      <div className="dgh" />
      {GRID_COLS.map((c) => <div key={c} className="dgh">{c}</div>)}
      {GRID_ROWS.map((r) => (
        <DarkRow key={r} r={r} grid={grid} />
      ))}
    </div>
  );
}
function DarkRow({ r, grid }: { r: number; grid: Record<string, string> }) {
  return (
    <>
      <div className="dgh">{r}</div>
      {GRID_COLS.map((c) => {
        const sid = grid[`${c}${r}`];
        return <div key={c} className="dgc">{sid ? <Shape id={sid} /> : null}</div>;
      })}
    </>
  );
}

function Wiring({ index, title, sel, setSel }: SecProps) {
  return (
    <ListDetail
      index={index} title={title}
      desc="P1 describes a waveform. Identify it, then route each colored wire to its port."
      step1="Identify the waveform" step2="Wiring table" empty="Pick the waveform P1 describes →"
      items={WAVEFORMS} sel={sel} setSel={setSel}
      renderItem={(i) => (<><span className="wfl">{'ABCDEF'[i]}</span><Svg className="wfsvg" html={waveSvg(WAVEFORMS[i].pts, 120, 26, 'currentColor')} /></>)}
      renderDetail={(i) => {
        const w = WAVEFORMS[i];
        return (
          <>
            <div className="wftitle">WAVEFORM {'ABCDEF'[i]}</div>
            {WIRE_COLORS.map((c) => (
              <div key={c.id} className="wfwire">
                <span className="sw-dot" style={{ background: c.hex }} />{c.name}
                <span className="wfar">→</span><span className="wfpt">PORT {w.map[c.id]}</span>
              </div>
            ))}
            <Svg className="wddark" html={wireDiagram(w.map)} />
          </>
        );
      }}
    />
  );
}

function Constellation({ index, title, sel, setSel }: SecProps) {
  return (
    <ListDetail
      index={index} title={title}
      desc="P1 describes a star field. Match it to a constellation, then talk them through linking the stars."
      step1="Match the constellation" step2="Star chart" empty="Pick the constellation P1 describes →"
      items={CONSTELLATIONS} sel={sel} setSel={setSel}
      renderItem={(i) => <><span className="wfcn">{CONSTELLATIONS[i].name}</span><span className="constcount">{CONSTELLATIONS[i].stars.length}★</span></>}
      renderDetail={(i) => (
        <>
          <div className="wftitle">{CONSTELLATIONS[i].name}</div>
          <Svg className="constchart" html={constChart(CONSTELLATIONS[i])} />
          <p className="fomp" style={{ marginTop: 11 }}>{CONSTELLATIONS[i].note}. Guide P1 star by star.</p>
        </>
      )}
    />
  );
}

function IdCheck({ index, title, slot, sel, setSel }: SecProps) {
  const inst = useMemo(() => generatePuzzle('id', slot.seed) as IdInstance, [slot.seed]);
  return (
    <>
      <SecHead index={index} title={title} desc="P1 reads the name on an ID. Find it in the registry, verify every field they describe, and check the expiry against the system date." />
      <div className="iddate"><span>SYSTEM DATE</span><b>{formatIdDate(inst.today)}</b></div>
      <div className="fomgrid">
        <div className="fomcol">
          <div className="fomstep">1 · Name registry</div>
          <div className="wflist">
            {PEOPLE.map((q, i) => (
              <button key={`${q.prenom}-${q.nom}`} className={`wfrow${sel === i ? ' on' : ''}`} onClick={() => setSel(sel === i ? null : i)}>
                <span className="wfcn">{q.prenom} {q.nom}</span>
                {sel === i && <span className="wfck">✓</span>}
              </button>
            ))}
          </div>
        </div>
        <div className="fomcol">
          <div className="fomstep">2 · Identity record</div>
          <div className="wftbl">
            {sel == null || sel >= PEOPLE.length ? <div className="wfempty">Pick the name P1 reads →</div> : (() => {
              const q = PEOPLE[sel];
              const F = (l: string, v: string | number) => <div className="idf"><span>{l}</span><b>{v}</b></div>;
              return (
                <>
                  <div className="idrec">
                    <Svg className="idrecphoto" html={faceSvg(q.face, 104)} />
                    <div className="idrecfields">{F('SEX', q.sexe)}{F('AGE', q.age)}{F('COUNTRY', q.pays)}{F('EYES', q.eyes)}</div>
                  </div>
                  <p className="fomp" style={{ marginTop: 12 }}>Have P1 describe the photo and read every field. Deny on any mismatch — or if EXPIRES is before the system date.</p>
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </>
  );
}

function CityMap({ index, title, sel, setSel }: SecProps) {
  return (
    <ListDetail
      index={index} title={title}
      desc="P1 describes their city map. Match it in the atlas, then talk them onto the treasure ✕."
      step1="Match the map" step2="Treasure map" empty="Pick the map P1 describes →"
      items={CITY_MAPS} sel={sel} setSel={setSel}
      renderItem={(i) => <span className="wfcn">{CITY_MAPS[i].name}</span>}
      renderDetail={(i) => {
        const m = CITY_MAPS[i];
        return (
          <>
            <div className="wftitle">{m.name}</div>
            <div className="mapref">
              <svg viewBox="0 0 300 300">
                <image href={m.img} x="0" y="0" width="300" height="300" preserveAspectRatio="xMidYMid slice" />
                <g transform={`translate(${m.treasure[0]},${m.treasure[1]})`}>
                  <circle r="11" fill="rgba(245,197,66,.18)" />
                  <circle r="11" fill="none" stroke="#f5c542" strokeWidth="2" />
                  <path d="M-4.5 -4.5 4.5 4.5 M4.5 -4.5 -4.5 4.5" stroke="#f5c542" strokeWidth="2.6" strokeLinecap="round" />
                </g>
              </svg>
            </div>
            <p className="fomp" style={{ marginTop: 10 }}>{m.desc}. The ✕ marks the treasure. Guide P1 to {m.landmark}.</p>
          </>
        );
      }}
    />
  );
}

function Maze({ index, title, sel, setSel }: SecProps) {
  return (
    <ListDetail
      index={index} title={title}
      desc="P1 is blind — they only see their current cell and its open exits, never the mines. You have the full map: walls, mines and exit. They call their cell; talk them along the one mine-free corridor."
      step1="Match the grid code" step2="Map · mines & exit" empty="Pick the grid P1 reads →"
      items={MAZES} sel={sel} setSel={setSel}
      renderItem={(i) => <><span className="wfcn">{MAZES[i].name}</span><span className="constcount">{MAZES[i].cols}×{MAZES[i].rows}</span></>}
      renderDetail={(i) => (
        <>
          <div className="wftitle">{MAZES[i].name}</div>
          <Svg html={mazeDangerGrid(MAZES[i].id)} />
          <p className="fomp" style={{ marginTop: 10 }}>
            <span style={{ color: '#4ec46a' }}>●</span> start · <span style={{ color: '#f5c542' }}>✕</span> exit · <span style={{ color: '#ef5b54' }}>☠</span> mine. The unmined cells form the only safe corridor — P1 calls their cell, you walk them along it.
          </p>
        </>
      )}
    />
  );
}

function Signal({ index, title, sel, setSel }: SecProps) {
  return (
    <ListDetail
      index={index} title={title}
      desc="P1 plays a signal only they can hear and describes it. Play the bank to find the match, then read its four shapes back to P1 in order."
      step1="Sound bank" step2="Shape order" empty="Pick the signal that matches P1 →"
      items={SIGNALS} sel={sel} setSel={setSel}
      renderItem={(i) => (
        <>
          <span className="sigplaydot" role="button" tabIndex={-1}
            onClick={(e) => { e.stopPropagation(); playTones(SIGNALS[i].tones); }}>▶</span>
          <span className="wfcn">{SIGNALS[i].name}</span>
        </>
      )}
      renderDetail={(i) => {
        const s = SIGNALS[i];
        return (
          <>
            <div className="wftitle">{s.name}</div>
            <p className="fomp" style={{ margin: '0 0 14px' }}>&ldquo;{s.desc}&rdquo;</p>
            <button className="btn ghost" onClick={() => playTones(s.tones)}>▶ play to compare</button>
            <div className="sigorder" style={{ marginTop: 16 }}>
              {s.order.map((id, j) => (
                <span key={j} className="sigordcell"><small>{j + 1}</small><Shape id={id} /></span>
              ))}
            </div>
            <p className="fomp" style={{ marginTop: 12 }}>Read these four shapes back to P1, in order.</p>
          </>
        );
      }}
    />
  );
}

// --- Sliders operator: drag both needles onto the symbols P1 names; read the gauges ---
function SlidersOp({ index, title }: SecProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [n1, setN1] = useState(0);
  const [n2, setN2] = useState(1);
  const [drag, setDrag] = useState<1 | 2 | null>(null);
  const cx = 85, cy = 85, R = 56;
  const angleToIdx = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 170 - cx;
    const y = ((e.clientY - r.top) / r.height) * 170 - cy;
    const ang = (Math.atan2(y, x) * 180) / Math.PI;
    return (((Math.round((ang + 90) / 60) % 6) + 6) % 6);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const idx = angleToIdx(e);
    if (drag === 1) setN1(idx); else setN2(idx);
  };
  const tip = (idx: number, len: number) => {
    const a = ((-90 + idx * 60) * Math.PI) / 180;
    return { x: cx + len * Math.cos(a), y: cy + len * Math.sin(a) };
  };
  const a = SLIDER_PROFILES_A[DIAL_SYMS[n1].id], b = SLIDER_PROFILES_B[DIAL_SYMS[n2].id];
  const gauges: [string, number, string][] = [['POWER', a[0], 'amber'], ['COOLING', a[1], 'amber'], ['SIGNAL', b[0], 'cyan'], ['PRESSURE', b[1], 'cyan']];
  const t1 = tip(n1, 46), t2 = tip(n2, 34);

  return (
    <>
      <SecHead index={index} title={title} desc="Turn both needles onto the symbols P1 names; the four gauges read the live calibration." />
      <div className="fomgrid calgrid">
        <div className="fomcol">
          <div className="fomstep">1 · Aim the needles</div>
          <svg ref={svgRef} className="caldial" viewBox="0 0 170 170" width={206} height={206}
            onPointerMove={onMove} onPointerUp={() => setDrag(null)} style={{ touchAction: 'none' }}>
            <circle cx={cx} cy={cy} r={70} fill="rgba(255,255,255,.012)" stroke="var(--line2)" strokeWidth={1.5} />
            {DIAL_SYMS.map((s, i) => {
              const ang = ((-90 + i * 60) * Math.PI) / 180, x = cx + R * Math.cos(ang), y = cy + R * Math.sin(ang);
              const col = i === n1 ? '#f8d066' : i === n2 ? '#6fd3ec' : 'var(--faint)';
              return <g key={s.id} transform={`translate(${(x - 11).toFixed(1)},${(y - 11).toFixed(1)})`} style={{ color: col }}>
                <svg width={22} height={22} viewBox="0 0 24 24" fill="currentColor" dangerouslySetInnerHTML={{ __html: s.svg }} />
              </g>;
            })}
            <line x1={cx} y1={cy} x2={t1.x} y2={t1.y} stroke="#f0b43e" strokeWidth={3.5} strokeLinecap="round" />
            <line x1={cx} y1={cy} x2={t2.x} y2={t2.y} stroke="#5cc8e6" strokeWidth={3.5} strokeLinecap="round" />
            <circle cx={cx} cy={cy} r={5.5} fill="var(--ink)" />
            <circle cx={t1.x} cy={t1.y} r={10} fill="#f0b43e" fillOpacity={0.2} stroke="#f0b43e" strokeWidth={2}
              style={{ cursor: 'grab' }} onPointerDown={(e) => { svgRef.current?.setPointerCapture(e.pointerId); setDrag(1); }} />
            <circle cx={t2.x} cy={t2.y} r={10} fill="#5cc8e6" fillOpacity={0.2} stroke="#5cc8e6" strokeWidth={2}
              style={{ cursor: 'grab' }} onPointerDown={(e) => { svgRef.current?.setPointerCapture(e.pointerId); setDrag(2); }} />
          </svg>
          <div className="calhint">Drag ① (amber) and ② (cyan) onto the symbols P1 calls out.</div>
        </div>
        <div className="fomcol">
          <div className="fomstep">2 · Gauge readout</div>
          <div className="g4panel">
            {gauges.map(([lbl, v, cls]) => (
              <div key={lbl} className="g4row">
                <span className="g4lbl">{lbl}</span>
                <div className="g4bar"><i className={`g4fill ${cls}`} style={{ width: `${v}%` }} /></div>
                <span className="g4val">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
