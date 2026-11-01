import { createFileRoute } from "@tanstack/react-router";
import { useAnalysis, useActiveDisease } from "@/store/analysis";
import { PageHeader, Panel, Disclaimer, NextStep } from "@/components/phyto/ui";
import { DISEASE_PARAMETERS, DISEASES, DISEASE_LABEL } from "@/data/diseases";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { DiseaseClass, ParamStatus } from "@/types";

export const Route = createFileRoute("/_dash/parameters")({
  head: () => ({ meta: [{ title: "Disease Parameters — PhytoSpread" }, { name: "description", content: "Disease-specific simulation parameters with sources and status." }, { property: "og:title", content: "Disease Parameters — PhytoSpread" }, { property: "og:description", content: "Disease parameter engine." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Params,
});

const STATUS: Record<ParamStatus, [string, string]> = {
  literature: ["Published threshold", "bg-primary-soft text-primary"],
  prototype: ["Prototype parameter", "bg-warning/20 text-warning-foreground"],
  not_configured: ["Parameter not yet configured", "bg-muted text-muted-foreground"],
};

function Params() {
  const set = useAnalysis((s) => s.set);
  const active = useActiveDisease();
  const disease: DiseaseClass = active && active !== "healthy" ? active : "late_blight";
  const params = DISEASE_PARAMETERS[disease];
  const groups = [...new Set(params.map((p) => p.group))];

  return (
    <>
      <PageHeader
        title={`${DISEASE_LABEL[disease]} parameters`}
        subtitle={`${DISEASES[disease].pathogen} · loaded automatically from the prediction`}
        crumbs={["Disease Detection", "Parameters"]}
        actions={
          <>
            <Select value={disease} onValueChange={(v) => set({ diseaseOverride: v as DiseaseClass })}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="late_blight">Late Blight</SelectItem><SelectItem value="early_blight">Early Blight</SelectItem></SelectContent>
            </Select>
            <NextStep to="/location" label="Field location" />
          </>
        }
      />
      <div className="mb-6"><Disclaimer>Simulation coefficients marked <b>Prototype parameter</b> are placeholders for demonstrating the pipeline — they are not calibrated or scientifically validated. Replace them with peer-reviewed values before interpreting results.</Disclaimer></div>
      <div className="grid gap-6 lg:grid-cols-2">
        {groups.map((g) => (
          <Panel key={g} title={g} bodyClass="p-0">
            <ul className="divide-y">
              {params.filter((p) => p.group === g).map((p) => (
                <li key={p.key} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{p.label}</p>
                      <p className="mt-0.5 font-display text-base">{p.value ?? "—"} {p.unit && <span className="text-xs text-muted-foreground">{p.unit}</span>}</p>
                    </div>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS[p.status][1])}>{STATUS[p.status][0]}</span>
                  </div>
                  {(p.reference || p.source) && <p className="mt-1 text-xs text-muted-foreground">Source: {[p.source, p.reference].filter(Boolean).join(" · ")}</p>}
                  {p.notes && <p className="mt-1 text-xs text-muted-foreground">{p.notes}</p>}
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>
    </>
  );
}
