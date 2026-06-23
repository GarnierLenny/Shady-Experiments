// Stats are fictional placeholders, hardcoded for now (no DB yet).
const STATS: ReadonlyArray<[label: string, value: string]> = [
  ["Participants actifs", "84,391"],
  ["Temps moyen de survie", "4.2s"],
  ["Taux de trahison", "67%"],
];

export function ExperimentDossier() {
  return (
    <section className="mx-auto w-full max-w-3xl px-6 pt-12">
      <p className="text-[11px] tracking-[0.15em] text-ink">EXP&Eacute;RIENCE #001</p>
      <div className="mt-3 border-t border-ink" />

      <div className="flex items-baseline justify-between gap-4 pt-6">
        <h1 className="font-display text-[28px] font-bold leading-none tracking-tight text-ink">
          STANDOFF
        </h1>
        <span className="flex shrink-0 items-center gap-2 text-[11px] tracking-[0.15em] text-ink">
          <span className="dot-live" aria-hidden="true" />
          EN COURS
        </span>
      </div>

      <p className="mt-4 text-[13px] text-ink">
        Deux humains. Un regard. Une humiliation.
      </p>

      <dl className="mt-6 space-y-1 text-[11px] text-muted">
        {STATS.map(([label, value]) => (
          <div key={label} className="flex gap-2">
            <dt>{label} :</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 border-t border-ink" />
    </section>
  );
}
