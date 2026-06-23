// EyeToEye (the "standoff" game) is a separate full-stack app, not a React
// component that can be imported here. We embed it as an iframe when a URL is
// configured, otherwise we show an in-brand launch panel.
//
// Set NEXT_PUBLIC_EYETOEYE_URL to the deployed game (or its dev server, e.g.
// http://localhost:3000) to embed it inline.
const GAME_URL = process.env.NEXT_PUBLIC_EYETOEYE_URL;

export function GameFrame() {
  return (
    <section id="experience" className="mx-auto w-full max-w-3xl px-6 py-12">
      {GAME_URL ? (
        <iframe
          src={GAME_URL}
          title="EYETOEYE"
          allow="camera; microphone; fullscreen"
          className="h-[70vh] w-full border-[0.5px] border-rule"
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
      <p className="text-[11px] tracking-[0.15em] text-muted">
        DISPOSITIF EYETOEYE
      </p>
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
