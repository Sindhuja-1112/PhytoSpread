import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BarChart3, Save } from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { useAnalysis } from "@/store/analysis";
import { PageHeader, Panel, StatCard, EmptyState, Disclaimer } from "@/components/phyto/ui";
import { SimGrid } from "@/components/phyto/SimGrid";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { DISEASE_LABEL } from "@/data/diseases";

export const Route = createFileRoute("/_dash/analytics")({
  head: () => ({ meta: [{ title: "Analytics — PhytoSpread" }, { name: "description", content: "Key metrics, spread heatmaps, weather impact and scenario comparison." }, { property: "og:title", content: "Analytics — PhytoSpread" }, { property: "og:description", content: "Analysis analytics." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Analytics,
});

function Analytics() {
  const s = useAnalysis();
  const nav = useNavigate();
  const sim = s.simulation;
  if (!sim) return <EmptyState icon={BarChart3} title="No simulation yet" description="Run a simulation to see analytics." to="/simulation" cta="Run simulation" />;
  const first = sim.days[0], last = sim.days.at(-1)!;
  const lowest = s.scenarios.length ? s.scenarios.reduce((a, b) => (a.impactIndex <= b.impactIndex ? a : b)) : null;
  const weatherRows = sim.days.slice(1).map((d, i) => ({ day: d.day, wf: +d.weatherFactor.toFixed(3), newCases: Math.max(0, d.E + d.I + d.R - (sim.days[i].E + sim.days[i].I + sim.days[i].R)) }));

  return (
    <>
      <PageHeader title="Analytics" subtitle={`${s.prediction ? DISEASE_LABEL[s.prediction.disease] : "Simulation"} · ${s.location?.label ?? "Field"}`} crumbs={["Analytics"]}
        actions={<Button onClick={() => { s.saveToHistory(); toast.success("Analysis saved to history."); nav({ to: "/history" }); }}><Save className="h-4 w-4" />Save Analysis</Button>} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Current infection" value={`${first.infectionPct.toFixed(1)}%`} />
        <StatCard label={`Projected affected (day ${last.day})`} value={`${last.affectedPct.toFixed(1)}%`} tone="danger" />
        <StatCard label="Projected loss (no intervention)" value={s.scenarios[0] ? `${s.scenarios[0].projectedLossPct.toFixed(1)}%` : "Run scenarios"} />
        <StatCard label="Lowest Projected Impact" value={lowest?.intervention.label ?? "—"} tone="success" hint={lowest && lowest.intervention.action !== "none" ? `${lowest.avoidedPct.toFixed(0)}% impact avoided (model-based)` : undefined} />
      </div>
      <Tabs defaultValue="overview" className="mt-6">
        <TabsList><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="heatmap">Spread heatmap</TabsTrigger><TabsTrigger value="weather">Weather impact</TabsTrigger><TabsTrigger value="scenarios">Scenario comparison</TabsTrigger></TabsList>
        <TabsContent value="overview">
          <Panel title="Spread projection (%)">
            <ResponsiveContainer width="100%" height={280}><LineChart data={sim.days.map((d) => ({ day: d.day, affected: +d.affectedPct.toFixed(2), infected: +d.infectionPct.toFixed(2), severity: +(d.meanSeverity * 100).toFixed(2) }))}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="day" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Line dataKey="affected" stroke="var(--chart-2)" strokeWidth={2} dot={false} /><Line dataKey="infected" stroke="var(--chart-1)" strokeWidth={2} dot={false} /><Line dataKey="severity" stroke="var(--chart-4)" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>
          </Panel>
        </TabsContent>
        <TabsContent value="heatmap">
          <Panel title="Spatial state snapshots">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              {[0, 0.25, 0.5, 0.75, 1].map((f) => { const d = sim.days[Math.round(f * (sim.days.length - 1))]; return <div key={f}><SimGrid n={sim.gridSize} states={d.states} mask={sim.mask} severity={d.severity} /><p className="mt-1 text-center text-xs text-muted-foreground">Day {d.day} · {d.affectedPct.toFixed(0)}%</p></div>; })}
            </div>
          </Panel>
        </TabsContent>
        <TabsContent value="weather">
          <Panel title="Weather factor vs. new affected cells per day">
            <ResponsiveContainer width="100%" height={260}><BarChart data={weatherRows}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="day" fontSize={11} /><YAxis yAxisId="l" fontSize={11} /><YAxis yAxisId="r" orientation="right" fontSize={11} /><Tooltip /><Bar yAxisId="l" dataKey="newCases" fill="var(--chart-2)" name="New affected cells" /><Bar yAxisId="r" dataKey="wf" fill="var(--chart-3)" name="Weather factor" /></BarChart></ResponsiveContainer>
          </Panel>
        </TabsContent>
        <TabsContent value="scenarios">
          <Panel title="Scenario final affected area (%)">
            {s.scenarios.length ? <ResponsiveContainer width="100%" height={260}><BarChart data={s.scenarios.map((x) => ({ name: x.intervention.label, v: +x.finalAffectedPct.toFixed(1) }))}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="name" fontSize={10} /><YAxis fontSize={11} /><Tooltip /><Bar dataKey="v" fill="var(--chart-1)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : <p className="text-sm text-muted-foreground">Run intervention scenarios first.</p>}
          </Panel>
        </TabsContent>
      </Tabs>
      <div className="mt-6"><Disclaimer>Under current assumptions and prototype parameters. Projections are estimates, not guaranteed outcomes.</Disclaimer></div>
    </>
  );
}
