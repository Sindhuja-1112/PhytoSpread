import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, ShieldCheck, Award } from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useAnalysis } from "@/store/analysis";
import { PageHeader, Panel, DemoBadge, Disclaimer, NextStep, EmptyState } from "@/components/phyto/ui";
import { compareInterventions } from "@/services/simulation";
import { useSimBase } from "@/lib/simInput";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_dash/intervention")({
  head: () => ({ meta: [{ title: "Intervention Scenarios — PhytoSpread" }, { name: "description", content: "Compare intervention timings under identical model assumptions." }, { property: "og:title", content: "Intervention Scenarios — PhytoSpread" }, { property: "og:description", content: "Intervention timing comparison." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Intervention,
});

const COLORS = ["var(--chart-2)", "var(--chart-1)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--muted-foreground)"];

function Intervention() {
  const s = useAnalysis();
  const days = s.simulation ? s.simulation.days.length - 1 : s.settings.simDays;
  const { base } = useSimBase(days);
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!base) return;
    setBusy(true);
    try { const { summary } = await compareInterventions(base); s.set({ scenarios: summary }); }
    catch (e) { toast.error(`Comparison failed: ${(e as Error).message}`); }
    finally { setBusy(false); }
  }

  if (!base) return <EmptyState icon={ShieldCheck} title="Disease not set" description="Run detection (or choose a disease in Simulation) before comparing interventions." to="/simulation" cta="Go to simulation" />;
  const sc = s.scenarios;
  const lowest = sc.length ? sc.reduce((a, b) => (a.impactIndex <= b.impactIndex ? a : b)) : null;
  const curve = sc.length ? sc[0].curve.map((_, d) => Object.fromEntries([["day", d], ...sc.map((x) => [x.intervention.label, +x.curve[d].toFixed(2)])])) : [];
  const bars = sc.map((x) => ({ name: x.intervention.label.replace("Remove Infected Area", "Removal"), affected: +x.finalAffectedPct.toFixed(1), loss: +x.projectedLossPct.toFixed(1) }));

  return (
    <>
      <PageHeader title="Intervention Scenarios" subtitle={`Same disease, field, initial infection, weather, parameters and ${days}-day duration — only the intervention changes.`} crumbs={["Intervention"]} actions={<><DemoBadge label="Prototype simulation" /><Button onClick={run} disabled={busy}>{busy ? <><Loader2 className="h-4 w-4 animate-spin" />Comparing…</> : "Run all scenarios"}</Button><NextStep to="/analytics" label="Analytics" disabled={!sc.length} /></>} />
      {!sc.length ? (
        <Panel><p className="py-10 text-center text-sm text-muted-foreground">{busy ? "Running spatial disease simulation for each scenario…" : "Run all scenarios to compare projected outcomes."}</p></Panel>
      ) : (
        <>
          <Panel title="Scenario comparison" bodyClass="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Scenario</TableHead><TableHead>Timing</TableHead><TableHead className="text-right">Final Affected Area</TableHead><TableHead className="text-right">Projected Severity</TableHead><TableHead className="text-right">Projected Impact</TableHead><TableHead className="text-right">Projected Loss</TableHead><TableHead className="text-right">Potential Impact Avoided</TableHead></TableRow></TableHeader>
                <TableBody>
                  {sc.map((x) => (
                    <TableRow key={x.intervention.id} className={cn(x === lowest && "bg-primary-soft/60")}>
                      <TableCell className="font-medium">{x.intervention.label}{x === lowest && <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground"><Award className="h-3 w-3" />Lowest Projected Impact</span>}</TableCell>
                      <TableCell>{x.intervention.day === null ? "—" : `Day ${x.intervention.day}`}</TableCell>
                      <TableCell className="text-right">{x.finalAffectedPct.toFixed(1)}%</TableCell>
                      <TableCell className="text-right">{(x.finalSeverity * 100).toFixed(1)}%</TableCell>
                      <TableCell className="text-right">{x.impactIndex.toFixed(3)}</TableCell>
                      <TableCell className="text-right">{x.projectedLossPct.toFixed(1)}%</TableCell>
                      <TableCell className="text-right font-semibold text-primary">{x.intervention.action === "none" ? "—" : `${x.avoidedPct.toFixed(0)}%`}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Panel>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Panel title="Disease progression comparison (affected %)" className="lg:col-span-2">
              <ResponsiveContainer width="100%" height={280}><LineChart data={curve}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="day" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />{sc.map((x, i) => <Line key={x.intervention.id} dataKey={x.intervention.label} stroke={COLORS[i]} strokeWidth={2} dot={false} />)}</LineChart></ResponsiveContainer>
            </Panel>
            <Panel title="Affected area comparison (%)"><ResponsiveContainer width="100%" height={240}><BarChart data={bars}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="name" fontSize={10} /><YAxis fontSize={11} /><Tooltip /><Bar dataKey="affected" fill="var(--chart-2)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></Panel>
            <Panel title="Projected impact comparison (loss %)"><ResponsiveContainer width="100%" height={240}><BarChart data={bars}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="name" fontSize={10} /><YAxis fontSize={11} /><Tooltip /><Bar dataKey="loss" fill="var(--chart-1)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></Panel>
          </div>
        </>
      )}
      <div className="mt-6"><Disclaimer>Results are model-based projections under the selected assumptions and should not be interpreted as guaranteed field outcomes. Scenarios describe intervention timing only — no chemical prescriptions or dosages are given; follow local extension advice.</Disclaimer></div>
    </>
  );
}
