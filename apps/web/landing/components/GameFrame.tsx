// STANDOFF is a separate full-stack app (Next web + NestJS API + WebRTC/socket.io),
// not a React component we can import. We embed its web app as an iframe.
//
//   • dev:  defaults to http://localhost:3003 (standoff's `next dev` port), so it
//           shows up automatically once you run standoff's own `npm run dev`.
//   • prod: set NEXT_PUBLIC_STANDOFF_URL to the deployed game; otherwise we show
//           the in-brand "en attente de connexion" panel instead of a dead frame.
//
// The game also needs its API running (socket.io on :3002) for an actual duel —
// standoff's `npm run dev` starts shared + api + web together.
const STANDOFF_URL =
  process.env.NEXT_PUBLIC_STANDOFF_URL ??
  (process.env.NODE_ENV !== "production" ? "http://localhost:3003" : undefined);

export function GameFrame() {
  return (
    <section id="experience" className="mx-auto w-full max-w-3xl px-6 py-12">
      {STANDOFF_URL ? (
        <iframe
          src={STANDOFF_URL}
          title="STANDOFF"
          allow="camera; microphone; fullscreen"
          className="h-[80vh] w-full border-[0.5px] border-rule bg-paper"
        />
      ) : (
        <LaunchPanel />
      )}
    </section>
  );
}

function LaunchPanel() {
  return (
    <div className="flex flex-col items-center gap-4 border-[0.5px] border-rule px-6 py-20 text-center">
      <p className="text-[11px] tracking-[0.15em] text-muted">DISPOSITIF STANDOFF</p>
      <p className="max-w-sm text-[13px] text-ink">
        Le protocole se d&eacute;roule en direct, entre deux sujets. L&apos;acc&egrave;s
        requiert une cam&eacute;ra.
      </p>
      <span className="mt-2 border-[0.5px] border-rule px-[14px] py-[6px] text-[11px] text-muted">
        en attente de connexion
      </span>
    </div>
  );
}
