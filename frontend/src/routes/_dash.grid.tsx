import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Grid3x3 } from "lucide-react";
import { useAnalysis, useActiveDisease } from "@/store/analysis";
import { PageHeader, Panel, EmptyState, NextStep, StatCard } from "@/components/phyto/ui";
import { SimGrid, GridLegend } from "@/components/phyto/SimGrid";
import { runSpatialSEIR, STATE_LABEL, weatherFactor } from "@/services/simulation";
import { numericParams } from "@/data/diseases";
import { cellCenter } from "@/lib/geo";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_dash/grid")({
  head: () => ({ meta: [{ title: "Spatial Grid — PhytoSpread" }, { name: "description", content: "Field converted into a computational SEIR grid." }, { property: "og:title", content: "Spatial Grid — PhytoSpread" }, { property: "og:description", content: "Spatial grid initialisation." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: GridPage,
});

function GridPage() {
  const { field, infected, infectedPct, gridSize, weather, set } = useAnalysis();
  const d = useActiveDisease();
  const disease = d && d !== "healthy" ? d : "late_blight";
  const [cell, setCell] = useState<number | null>(null);
  const init = useMemo(() => field.length >= 3 ? runSpatialSEIR({
    disease, gridSize, days: 0, field, infected, infectedPct, weather: weather?.daily ?? [], params: numericParams(disease),
    intervention: { id: "none", label: "None", action: "none", day: null }, seed: 42,
  }) : null, [field, infected, infectedPct, gridSize, weather, disease]);

  if (!init) return <EmptyState icon={Grid3x3} title="No field boundary" description="Draw the field boundary to generate the simulation grid." to="/field-map" cta="Draw field" />;
  const d0 = init.days[0];
  const wf = weatherFactor(weather?.daily[0], numericParams(disease));

  return (
    <>
      <PageHeader title="Spatial Grid & SEIR Initialisation" subtitle="Each cell stores position, location, disease state, severity, weather influence and intervention state." crumbs={["Field Map", "Spatial Grid"]} actions={<NextStep to="/simulation" label="Run simulation" />} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Field converted to simulation grid" className="lg:col-span-2" actions={
          <Select value={String(gridSize)} onValueChange={(v) => { set({ gridSize: +v, simulation: null, scenarios: [] }); setCell(null); }}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>{[10, 15, 20, 30, 40].map((n) => <SelectItem key={n} value={String(n)}>{n} × {n}</SelectItem>)}</SelectContent>
          </Select>
        }>
          <div className="mx-auto max-w-[520px]" onClick={(e) => {
            const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
            const c = Math.floor(((e.clientX - r.left) / r.width) * gridSize), rr = Math.floor(((e.clientY - r.top) / r.height) * gridSize);
            setCell(rr * gridSize + c);
          }}>
            <SimGrid n={gridSize} states={d0.states} mask={init.mask} severity={d0.severity} className="cursor-pointer" />
          </div>
          <div className="mt-4"><GridLegend /></div>
        </Panel>
        <div className="space-y-4">
          <StatCard label="Grid size" value={`${gridSize} × ${gridSize}`} hint={`${gridSize * gridSize} cells, ${init.fieldCells} inside field`} />
          <StatCard label="Initial infected cells" value={`${d0.I} (${d0.infectionPct.toFixed(1)}%)`} tone="danger" hint={infected.length >= 3 ? "From marked infected area" : `From ${infectedPct}% estimate`} />
          <Panel title="Cell inspector" subtitle="Click a cell">
            {cell === null ? <p className="text-sm text-muted-foreground">No cell selected.</p> : (() => {
              const ll = cellCenter(field, gridSize, cell);
              return (
                <dl className="grid grid-cols-2 gap-y-1.5 text-sm">
                  <dt className="text-muted-foreground">Position</dt><dd>r{Math.floor(cell / gridSize)}, c{cell % gridSize}</dd>
                  <dt className="text-muted-foreground">Location</dt><dd>{ll.lat.toFixed(5)}, {ll.lng.toFixed(5)}</dd>
                  <dt className="text-muted-foreground">In field</dt><dd>{init.mask[cell] ? "Yes" : "No"}</dd>
                  <dt className="text-muted-foreground">State</dt><dd>{init.mask[cell] ? STATE_LABEL[d0.states[cell]] : "—"}</dd>
                  <dt className="text-muted-foreground">Severity</dt><dd>{d0.severity[cell].toFixed(2)}</dd>
                  <dt className="text-muted-foreground">Infection prob.</dt><dd>{d0.states[cell] >= 2 ? "1.00" : "computed per step"}</dd>
                  <dt className="text-muted-foreground">Weather factor</dt><dd>{wf.toFixed(2)}</dd>
                  <dt className="text-muted-foreground">Intervention</dt><dd>None</dd>
                </dl>
              );
            })()}
          </Panel>
        </div>
      </div>
    </>
  );
}
