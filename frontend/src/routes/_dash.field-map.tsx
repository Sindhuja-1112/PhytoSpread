import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { Map as MapIcon, Pencil, Undo2, Trash2 } from "lucide-react";
import { useAnalysis } from "@/store/analysis";
import { PageHeader, Panel, EmptyState, NextStep, StatCard } from "@/components/phyto/ui";
import { ClientFieldMap } from "@/components/phyto/ClientFieldMap";
import { polygonArea, toHectares, isSimplePolygon } from "@/lib/geo";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type { LatLng } from "@/types";

export const Route = createFileRoute("/_dash/field-map")({
  head: () => ({ meta: [{ title: "Field Map — PhytoSpread" }, { name: "description", content: "Draw your field boundary and mark infected areas." }, { property: "og:title", content: "Field Map — PhytoSpread" }, { property: "og:description", content: "Field boundary and infection mapping." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: FieldMapPage,
});

function FieldMapPage() {
  const { location, field, infected, infectedPct, set } = useAnalysis();
  const [mode, setMode] = useState<"view" | "field" | "infected">(field.length < 3 ? "field" : "view");
  const onField = useCallback((p: LatLng[]) => set({ field: p, simulation: null, scenarios: [] }), [set]);
  const onInf = useCallback((p: LatLng[]) => set({ infected: p, simulation: null, scenarios: [] }), [set]);
  if (!location) return <EmptyState icon={MapIcon} title="No field location" description="Select a location first to centre the map on your field." to="/location" cta="Select location" />;

  const fieldHa = toHectares(polygonArea(field));
  const infHa = toHectares(polygonArea(infected));
  const fieldValid = field.length >= 3 && isSimplePolygon(field);
  const infValid = infected.length === 0 || (infected.length >= 3 && isSimplePolygon(infected));

  const tool = (m: typeof mode, label: string, color: string) => (
    <Button variant={mode === m ? "default" : "outline"} size="sm" onClick={() => setMode(mode === m ? "view" : m)} className="justify-start">
      <span className={cn("h-2.5 w-2.5 rounded-sm", color)} /><Pencil className="h-3.5 w-3.5" />{label}
    </Button>
  );

  return (
    <>
      <PageHeader title="Field Map & Infection Marking" subtitle="Click on the map to add vertices; drag vertices to edit." crumbs={["Field Map", "Boundary & Infection"]} actions={<NextStep to="/grid" label="Create spatial grid" disabled={!fieldValid || !infValid} />} />
      <div className="grid gap-6 lg:grid-cols-4">
        <Panel className="lg:col-span-3" bodyClass="p-3">
          <ClientFieldMap center={location} field={field} infected={infected} mode={mode} onFieldChange={onField} onInfectedChange={onInf} className="h-[560px]" />
        </Panel>
        <div className="space-y-4">
          <Panel title="Tools">
            <div className="grid gap-2">
              {tool("field", "Draw field boundary", "bg-state-s")}
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => onField(field.slice(0, -1))} disabled={!field.length}><Undo2 className="h-3.5 w-3.5" />Undo</Button>
                <Button size="sm" variant="ghost" onClick={() => { onField([]); onInf([]); }} disabled={!field.length}><Trash2 className="h-3.5 w-3.5" />Reset</Button>
              </div>
              {tool("infected", "Mark infected area", "bg-state-i")}
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => onInf(infected.slice(0, -1))} disabled={!infected.length}><Undo2 className="h-3.5 w-3.5" />Undo</Button>
                <Button size="sm" variant="ghost" onClick={() => onInf([])} disabled={!infected.length}><Trash2 className="h-3.5 w-3.5" />Clear</Button>
              </div>
            </div>
            {!fieldValid && field.length >= 3 && <p className="mt-3 text-xs text-destructive">Field polygon is invalid (edges cross). Adjust vertices.</p>}
            {!infValid && <p className="mt-2 text-xs text-destructive">Infected polygon needs ≥3 non-crossing vertices.</p>}
          </Panel>
          <StatCard label="Field Size" value={fieldHa ? `${fieldHa.toFixed(2)} ha` : "—"} />
          <StatCard label="Infected Area" value={infHa ? `${infHa.toFixed(3)} ha (${((infHa / (fieldHa || 1)) * 100).toFixed(1)}%)` : "—"} tone="danger" />
          <Panel title="Alternative: infected %" subtitle="Used only when no infected area is drawn">
            <Slider value={[infectedPct]} min={1} max={50} step={1} onValueChange={([v]) => set({ infectedPct: v })} disabled={infected.length >= 3} />
            <p className="mt-2 text-sm">{infectedPct}% of field</p>
          </Panel>
        </div>
      </div>
    </>
  );
}
