"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { useSubjectId } from "@/hooks/useSubjectId";
import { track } from "@/lib/track";

// ── Surveillance-lab palette. Paper + ink; yellow = building,
//    red = alert/REC. Greys are the dossier hierarchy.
const PAPER = "#f6f6f4";
const CARD = "#fdfdfc";
const INK = "#111111";
const YELLOW = "#e9cb12";
const RED = "#ff3b30";
const GREY = "#8a8a8a";

const F = {
  display: "var(--font-display)",
  mono: "var(--font-mono)",
  body: "var(--font-body)",
};

// The released dossiers, wired to their real experiment routes.
const RELEASED = [
  {
    n: "001",
    href: "/standoff",
    title: "Standoff",
    blurb: "A 1v1 staring duel.",
    note: "✓ Field tested",
    fig: "FIG·001",
  },
  {
    n: "002",
    href: "/whispering-hacker",
    title: "Whispering Hacker",
    blurb: "Communication is the real puzzle.",
    note: "✓ Observation complete",
    fig: "FIG·002",
  },
] as const;

const pad = (n: number) => String(n).padStart(2, "0");

const monoLabel: CSSProperties = {
  fontFamily: F.mono,
  fontSize: 10,
  fontWeight: 500,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: GREY,
};

// Dossier cover: a photocopied registration crosshair, the visual "withheld".
function Cover({ fig }: { fig: string }) {
  return (
    <div
      style={{
        position: "relative",
        aspectRatio: "16 / 10",
        backgroundColor: "#f0ede6",
        backgroundImage: "repeating-linear-gradient(0deg, rgba(17,17,17,0.06) 0 1px, transparent 1px 4px)",
        borderBottom: `1px solid ${INK}`,
        overflow: "hidden",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 10,
          left: 12,
          fontFamily: F.mono,
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: GREY,
        }}
      >
        {fig} · Visual withheld
      </span>
      <span style={{ position: "absolute", top: 8, right: 8, width: 10, height: 10, borderTop: "1px solid #b4b0a8", borderRight: "1px solid #b4b0a8" }} />
      <span style={{ position: "absolute", bottom: 8, left: 8, width: 10, height: 10, borderBottom: "1px solid #b4b0a8", borderLeft: "1px solid #b4b0a8" }} />
      <span style={{ position: "absolute", bottom: 8, right: 8, width: 10, height: 10, borderBottom: "1px solid #b4b0a8", borderRight: "1px solid #b4b0a8" }} />
      <span style={{ position: "absolute", top: "50%", left: "50%", width: 48, height: 48, margin: "-24px 0 0 -24px", border: "1px solid #b4b0a8", borderRadius: 999 }} />
      <span style={{ position: "absolute", top: "50%", left: "50%", width: 1, height: 66, margin: "-33px 0 0 0", background: "#b4b0a8" }} />
      <span style={{ position: "absolute", top: "50%", left: "50%", width: 66, height: 1, margin: "0 0 0 -33px", background: "#b4b0a8" }} />
    </div>
  );
}

// Fixed corner ticks framing the whole facility view.
function Corners() {
  const edge = "1px solid rgba(17,17,17,0.32)";
  const base: CSSProperties = { position: "fixed", width: 13, height: 13, pointerEvents: "none", zIndex: 31 };
  return (
    <>
      <span style={{ ...base, top: 15, left: 15, borderTop: edge, borderLeft: edge }} />
      <span style={{ ...base, top: 15, right: 15, borderTop: edge, borderRight: edge }} />
      <span style={{ ...base, bottom: 15, left: 15, borderBottom: edge, borderLeft: edge }} />
      <span style={{ ...base, bottom: 15, right: 15, borderBottom: edge, borderRight: edge }} />
    </>
  );
}

export default function Home() {
  const subject = useSubjectId();
  const [clock, setClock] = useState("--:--:-- UTC");
  const [dots, setDots] = useState("…");

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setClock(`${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`);
    };
    tick();
    const clockTimer = setInterval(tick, 1000);

    let d = 1;
    const dotTimer = setInterval(() => {
      d = (d % 3) + 1;
      setDots(".".repeat(d));
    }, 520);

    return () => {
      clearInterval(clockTimer);
      clearInterval(dotTimer);
    };
  }, []);

  const subjectLabel = subject ?? "—————";

  return (
    <div
      className="lobby"
      style={{
        minHeight: "100vh",
        background: PAPER,
        color: INK,
        fontFamily: F.body,
        display: "flex",
        flexDirection: "column",
        cursor: "crosshair",
        backgroundImage:
          "linear-gradient(rgba(17,17,17,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(17,17,17,0.05) 1px, transparent 1px)",
        backgroundSize: "28px 28px",
      }}
    >
      <Corners />

      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 64,
          padding: "0 clamp(20px,5vw,40px)",
          borderBottom: `1px solid ${INK}`,
          position: "sticky",
          top: 0,
          background: "rgba(246,246,244,0.92)",
          zIndex: 10,
        }}
      >
        <span style={{ fontFamily: F.display, fontWeight: 700, fontSize: 18, letterSpacing: "-0.02em" }}>
          ShadyExperiments
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 14,
            fontFamily: F.mono,
            fontSize: 11,
            letterSpacing: "0.08em",
            color: GREY,
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: INK }}>
            <span className="lobby-rec-blink" style={{ width: 7, height: 7, borderRadius: 999, background: RED }} />
            REC
          </span>
          <span style={{ color: "#5c5c5c", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{clock}</span>
          <span style={{ whiteSpace: "nowrap" }}>SUBJECT #{subjectLabel}</span>
        </span>
      </header>

      <main
        style={{
          width: "100%",
          maxWidth: 1200,
          margin: "0 auto",
          padding: "clamp(40px,7vw,72px) clamp(20px,5vw,40px) 56px",
          flex: 1,
        }}
      >
        <div
          style={{
            fontFamily: F.mono,
            fontSize: 11,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: GREY,
            marginBottom: 22,
          }}
        >
          Confidential archive · Classification: Public
        </div>

        <h1
          style={{
            fontFamily: F.display,
            fontWeight: 700,
            fontSize: "clamp(52px,9vw,96px)",
            lineHeight: 0.94,
            letterSpacing: "-0.03em",
            margin: 0,
          }}
        >
          Experiments
        </h1>

        <p
          style={{
            fontFamily: F.body,
            fontSize: "clamp(17px,2.4vw,21px)",
            lineHeight: 1.4,
            color: "#2a2a2a",
            margin: "20px 0 0",
            maxWidth: "30ch",
            fontWeight: 500,
          }}
        >
          30 weeks. 30 experiments. One public laboratory.
        </p>

        {/* archive progress */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
            gap: 1,
            background: INK,
            border: `1px solid ${INK}`,
            margin: "34px 0 0",
          }}
        >
          <div style={{ background: CARD, padding: "15px 18px" }}>
            <div style={monoLabel}>Archive progress</div>
            <div style={{ fontFamily: F.mono, fontSize: 18, fontWeight: 600, color: INK, margin: "9px 0 8px", whiteSpace: "nowrap" }}>
              02 / 30
            </div>
            <div style={{ height: 6, background: "#f0ede6", border: `1px solid ${INK}`, borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: "6.6%", background: INK }} />
            </div>
            <div style={{ fontFamily: F.mono, fontSize: 11, color: GREY, marginTop: 6 }}>28 remaining</div>
          </div>
        </div>

        <div style={{ height: 2, background: INK, margin: "34px 0 32px" }} />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
            gap: 22,
            alignItems: "stretch",
          }}
        >
          {RELEASED.map((e) => (
            <Link
              key={e.n}
              href={e.href}
              className="lobby-card"
              onClick={() => track("landing", "experiment_open", { exp: e.n, title: e.title })}
              style={{
                display: "flex",
                flexDirection: "column",
                textDecoration: "none",
                color: "inherit",
                background: CARD,
                border: `1px solid ${INK}`,
                borderRadius: 2,
                boxShadow: "2px 2px 0 0 rgba(17,17,17,0.12)",
              }}
            >
              <Cover fig={e.fig} />
              <div style={{ display: "flex", flexDirection: "column", gap: 11, padding: 18, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ fontFamily: F.mono, fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", color: INK, whiteSpace: "nowrap" }}>
                    EXP #{e.n}
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                    <span style={{ width: 8, height: 8, background: INK, flex: "0 0 auto" }} />
                    <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: INK }}>
                      Released
                    </span>
                  </span>
                </div>
                <h3 style={{ fontFamily: F.display, fontWeight: 700, fontSize: 26, lineHeight: 1.05, letterSpacing: "-0.02em", margin: "2px 0 0", color: INK }}>
                  {e.title}
                </h3>
                <p style={{ fontFamily: F.body, fontSize: 14, lineHeight: 1.5, color: "#2a2a2a", margin: 0 }}>{e.blurb}</p>
                <div style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: "0.04em", color: "#5c5c5c" }}>{e.note}</div>
                <div style={{ flex: 1, minHeight: 10 }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", borderTop: "1px solid #e4dfd6", paddingTop: 13 }}>
                  <span
                    className="lobby-enter"
                    style={{
                      fontFamily: F.mono,
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: INK,
                    }}
                  >
                    Enter ›
                  </span>
                </div>
              </div>
            </Link>
          ))}

          {/* 003 — sealed / in development */}
          <div
            className="lobby-card"
            style={{
              display: "flex",
              flexDirection: "column",
              background: CARD,
              border: `1px solid ${INK}`,
              borderRadius: 2,
              boxShadow: "2px 2px 0 0 rgba(17,17,17,0.12)",
              cursor: "default",
            }}
          >
            <div
              style={{
                position: "relative",
                aspectRatio: "16 / 10",
                background: "repeating-linear-gradient(45deg, #1a1a1a 0 9px, #111111 9px 18px)",
                borderBottom: `1px solid ${INK}`,
                overflow: "hidden",
              }}
            >
              <span style={{ position: "absolute", top: 10, left: 12, fontFamily: F.mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: GREY }}>
                FIG·003 · Sealed
              </span>
              <span
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%,-50%) rotate(-7deg)",
                  border: `2px solid ${RED}`,
                  color: RED,
                  fontFamily: F.mono,
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: "0.22em",
                  padding: "6px 12px",
                  borderRadius: 2,
                }}
              >
                SEALED
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11, padding: 18, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <span style={{ fontFamily: F.mono, fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", color: INK, whiteSpace: "nowrap" }}>
                  EXP #003
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: YELLOW, flex: "0 0 auto" }} />
                  <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", color: INK }}>
                    In development
                  </span>
                </span>
              </div>
              <h3 style={{ fontFamily: F.display, fontWeight: 700, fontSize: 26, lineHeight: 1.05, letterSpacing: "-0.02em", margin: "2px 0 0", color: INK }}>
                ███████ ████
              </h3>
              <p style={{ fontFamily: F.body, fontSize: 14, lineHeight: 1.5, color: GREY, margin: 0 }}>Classified.</p>
              <div style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: "0.04em", color: GREY }}>Status: Building{dots}</div>
              <div style={{ flex: 1, minHeight: 10 }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #e4dfd6", paddingTop: 13 }}>
                <span style={{ fontFamily: F.mono, fontSize: 11, letterSpacing: "0.06em", color: "#b4b0a8" }}>Access pending</span>
                <span style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "#b4b0a8" }}>
                  Restricted
                </span>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            textAlign: "center",
            fontFamily: F.mono,
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#b4b0a8",
            marginTop: 40,
          }}
        >
          — A new experiment is logged every 7 days —
        </div>
      </main>

      <footer
        style={{
          borderTop: `1px solid ${INK}`,
          padding: "22px clamp(20px,5vw,40px)",
          fontFamily: F.mono,
          fontSize: 12,
          color: GREY,
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <span>All experiments are conducted with the implied consent of the participants.</span>
        <span>REC · 2026</span>
      </footer>
    </div>
  );
}
