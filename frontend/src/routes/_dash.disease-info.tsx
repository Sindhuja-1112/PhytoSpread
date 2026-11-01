import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Panel } from "@/components/phyto/ui";
import { DISEASES, DISEASE_PARAMETERS } from "@/data/diseases";
import { cn } from "@/lib/utils";
import type { DiseaseClass } from "@/types";

export const Route = createFileRoute("/_dash/disease-info")({
  head: () => ({ meta: [{ title: "Disease Information — PhytoSpread" }, { name: "description", content: "Educational information on potato late blight and early blight." }, { property: "og:title", content: "Disease Information — PhytoSpread" }, { property: "og:description", content: "Potato disease library." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Info,
});

function List({ items }: { items: string[] }) {
  return <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">{items.map((i) => <li key={i}>{i}</li>)}</ul>;
}

function Info() {
  const [id, setId] = useState<DiseaseClass>("late_blight");
  const d = DISEASES[id];
  return (
    <>
      <PageHeader title="Disease Information" subtitle="Educational overview — consult local agricultural extension services for management decisions." crumbs={["Disease Info"]} />
      <div className="mb-6 flex gap-2">
        {(["late_blight", "early_blight", "healthy"] as DiseaseClass[]).map((k) => (
          <button key={k} onClick={() => setId(k)} className={cn("rounded-full border px-4 py-1.5 text-sm font-medium", id === k ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary")}>{DISEASES[k].name}</button>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={d.name} subtitle={`${d.pathogen} · ${d.crop}`} className="lg:col-span-2"><p className="text-sm">{d.overview}</p></Panel>
        <Panel title="Symptoms"><List items={d.symptoms} /></Panel>
        <Panel title="Favourable conditions"><List items={d.favorable} /></Panel>
        <Panel title="Progression"><List items={d.progression} /></Panel>
        <Panel title="Control concepts"><List items={d.control} /></Panel>
        {DISEASE_PARAMETERS[id].length > 0 && (
          <Panel title="Simulation parameters"><p className="text-sm text-muted-foreground">{DISEASE_PARAMETERS[id].length} parameters configured ({DISEASE_PARAMETERS[id].filter((p) => p.status === "prototype").length} prototype). <Link to="/parameters" className="text-primary">View parameter engine →</Link></p></Panel>
        )}
        {d.references.length > 0 && (
          <Panel title="Scientific references"><ul className="space-y-2 text-sm">{d.references.map((r) => <li key={r.label}>{r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="text-primary underline">{r.label}</a> : r.label}</li>)}</ul></Panel>
        )}
      </div>
    </>
  );
}
