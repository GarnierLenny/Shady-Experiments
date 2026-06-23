import { ExperimentHeader } from "@/components/ExperimentHeader";
import { ExperimentDossier } from "@/components/ExperimentDossier";
import { GameFrame } from "@/components/GameFrame";
import { SiteFooter } from "@/components/SiteFooter";

export default function EyeToEye() {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <ExperimentHeader />
      <main className="flex-1">
        <ExperimentDossier />
        <GameFrame />
      </main>
      <SiteFooter />
    </div>
  );
}
