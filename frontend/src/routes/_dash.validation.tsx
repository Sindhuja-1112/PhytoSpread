import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Database, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Scatter, ComposedChart } from "recharts";
import { useAnalysis } from "@/store/analysis";
import { PageHeader, Panel, Disclaimer, StatCard } from "@/components/phyto/ui";
import { fitMetrics, runSpatialSEIR } from "@/services/simulation";
import { useSimBase } from "@/lib/simInput";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_dash/validation")({
  head: () => ({ meta: [{ title: "Validation — PhytoSpread" }, { name: "description", content: "Classifier validation, simulation fit against observed data, and ablation study." }, { property: "og:title", content: "Validation — PhytoSpread" }, { property: "og:description", content: "Model validation." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Validation,
});

function Validation() {
  const sim = useAnalysis((s) => s.simulation);
  const { base } = useSimBase(sim ? sim.days.length - 1 : 14);
  const [csv, setCsv] = useState("");
  const [observed, setObserved] = useState<{ day: number; value: number }[]>([]);
  const [ablation, setAblation] = useState<Record<string, number | string>[] | null>(null);
  const [busy, setBusy] = useState(false);

  function parse() {
    const rows = csv.trim().split(/\n+/).map((l) => l.split(/[,;\t]/).map((x) => x.trim())).filter((r) => r.length >= 2 && !isNaN(+r[0]) && !isNaN(+r[1])).map((r) => ({ day: +r[0], value: +r[1] }));
    if (rows.length < 2) return toast.error("Provide at least two rows: day,observed_percent");
    setObserved(rows);
  }
  const simCurve = sim?.days.map((d) => d.affectedPct) ?? [];
  const m = sim && observed.length ? fitMetrics(observed, simCurve) : null;
  const fitData = simCurve.map((v, d) => ({ day: d, simulated: +v.toFixed(2), observed: observed.find((o) => o.day === d)?.value }));

  function runAblation() {
    if (!base) return toast.error("Set a disease first.");
    setBusy(true);
    setTimeout(() => {
      const iv = { id: "none", label: "None", action: "none" as const, day: null };
      const variants = [
        ["Basic SEIR", { spatial: false, weather: false, wind: false }],
        ["Spatial SEIR", { spatial: true, weather: false, wind: false }],
        ["Spatial SEIR + Weather", { spatial: true, weather: true, wind: false }],
        ["Full PhytoSpread", { spatial: true, weather: true, wind: true }],
      ] as const;
      const runs = variants.map(([name, f]) => [name, runSpatialSEIR({ ...base, intervention: iv, features: { ...f } })] as const);
      setAblation(runs[0][1].days.map((_, d) => Object.fromEntries([["day", d], ...runs.map(([n, r]) => [n, +r.days[d].affectedPct.toFixed(2)])])));
      setBusy(false);
    }, 50);
  }

  return (
    <>
      <PageHeader title="Validation" subtitle="Only real evaluation data is reported here — nothing is fabricated." crumbs={["Validation"]} />
      <Tabs defaultValue="classifier">
        <TabsList><TabsTrigger value="classifier">Disease Classifier</TabsTrigger><TabsTrigger value="simulation">Simulation Validation</TabsTrigger><TabsTrigger value="ablation">Ablation Study</TabsTrigger></TabsList>
        <TabsContent value="classifier">
          <Panel title="A. Disease classifier validation">
            <div className="flex flex-col items-center py-10 text-center">
              <Database className="h-10 w-10 text-muted-foreground" />
              <p className="mt-3 font-semibold">Validation data not connected</p>
              <p className="mt-1 max-w-lg text-sm text-muted-foreground">Accuracy, precision, recall, F1-score and the confusion matrix will appear when the PyTorch model service returns evaluation results from GET /api/validation on a held-out test set.</p>
              <div className="mt-6 grid w-full max-w-2xl grid-cols-2 gap-3 md:grid-cols-4">
                {["Accuracy", "Precision", "Recall", "F1-score"].map((k) => <StatCard key={k} label={k} value="—" hint="Not connected" />)}
              </div>
            </div>
          </Panel>
        </TabsContent>
        <TabsContent value="simulation">
          <div className="grid gap-6 lg:grid-cols-3">
            <Panel title="B. Observed / published progression" subtitle="Paste CSV: day,affected_percent">
              <Textarea rows={8} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={"0,2\n3,6\n7,15"} className="font-mono text-xs" />
              <Button className="mt-3 w-full" onClick={parse} disabled={!sim}>Compare with current simulation</Button>
              {!sim && <p className="mt-2 text-xs text-muted-foreground">Run a simulation first.</p>}
              <p className="mt-3 text-xs text-muted-foreground">Use your own field observations or values digitised from a published study (cite the source).</p>
            </Panel>
            <Panel title="Observed vs simulated" className="lg:col-span-2">
              {m ? (
                <>
                  <div className="mb-4 grid grid-cols-3 gap-3">
                    <StatCard label="MAE" value={`${m.mae.toFixed(2)} pp`} />
                    <StatCard label="RMSE" value={`${m.rmse.toFixed(2)} pp`} />
                    <StatCard label="R²" value={m.r2 === null ? "n/a" : m.r2.toFixed(3)} hint={`${m.n} paired points`} />
                  </div>
                  <ResponsiveContainer width="100%" height={260}><ComposedChart data={fitData}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="day" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Legend /><Line dataKey="simulated" stroke="var(--chart-2)" strokeWidth={2} dot={false} /><Scatter dataKey="observed" fill="var(--chart-3)" /></ComposedChart></ResponsiveContainer>
                </>
              ) : <p className="py-16 text-center text-sm text-muted-foreground">No observed data provided — no simulation metrics are shown.</p>}
            </Panel>
          </div>
        </TabsContent>
        <TabsContent value="ablation">
          <Panel title="C. Ablation study" subtitle="Same inputs and seed; model components toggled" actions={<Button size="sm" onClick={runAblation} disabled={busy || !base}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Run ablation</Button>}>
            {ablation ? (
              <ResponsiveContainer width="100%" height={300}><LineChart data={ablation}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="day" fontSize={11} /><YAxis fontSize={11} unit="%" /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} />
                {["Basic SEIR", "Spatial SEIR", "Spatial SEIR + Weather", "Full PhytoSpread"].map((k, i) => <Line key={k} dataKey={k} stroke={`var(--chart-${i + 1})`} strokeWidth={2} dot={false} />)}
              </LineChart></ResponsiveContainer>
            ) : <p className="py-12 text-center text-sm text-muted-foreground">Run the ablation to compare model variants.</p>}
            <div className="mt-4"><Disclaimer>The ablation shows how each component changes projections. It is not evidence of accuracy — compare each variant against observed data in Simulation Validation for that.</Disclaimer></div>
          </Panel>
        </TabsContent>
      </Tabs>
    </>
  );
}
