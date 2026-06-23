import Link from "next/link";
import { SubjectTag } from "./SubjectTag";

export function ExperimentHeader() {
  return (
    <header className="flex flex-col gap-3 border-b-[0.5px] border-rule px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
      <Link
        href="/"
        className="font-display text-[13px] font-bold tracking-[0.1em] text-ink"
      >
        SHADY EXPERIMENTS
      </Link>

      <div className="flex items-center gap-4">
        <SubjectTag />
        <a
          href="#experience"
          className="border-[0.5px] border-ink px-[14px] py-[6px] text-[11px] text-ink transition-colors hover:bg-ink hover:text-paper"
        >
          [ Cr&eacute;er un dossier ]
        </a>
      </div>
    </header>
  );
}
