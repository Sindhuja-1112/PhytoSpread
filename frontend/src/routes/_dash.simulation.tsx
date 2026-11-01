import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Loader2, Activity } from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { useAnalysis } from "@/store/analysis";
import { PageHeader, Panel, StatCard, DemoBadge, Disclaimer, NextStep } from "@/components/phyto/ui";
import { SimGrid, GridLegend } from "@/components/phyto/SimGrid";
import { runSimulation, DEFAULT_SCENARIOS } from "@/services/simulation";
import { useSimBase } from "@/lib/simInput";
import { DISEASE_LABEL } from "@/data/diseases";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_dash/simulation")({
  head: () => ({ meta: [{ title: "Simulation — PhytoSpread" }, { name: "description", content: "Spatial SEIR disease spread simulation with weather modulation." }, { property: "og:title", content: "Simulation — PhytoSpread" }, { property: "og:description", content: "Spatial disease spread simulation." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Simulation,
});

function Simulation() {
  const s = useAnalysis();
  const [days, setDays] = useState(s.settings.simDays);
  const [ivId, setIvId] = useState("none");
  const { base, disease, missing } = useSimBase(days);
  const [day, setDay] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const sim = s.simulation;

  useEffect(() => {
    if (!playing || !sim) return;
    timer.current = setInterval(() => setDay((d) => { if (d >= sim.days.length - 1) { setPlaying(false); return d; } return d + 1; }), 600);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [playing, sim]);

  async function run() {
    if (!base) return;
    setBusy(true); setPlaying(false);
    try {
      const iv = DEFAULT_SCENARIOS.find((x) => x.id === ivId)!;
      const r = await runSimulation({ ...base, intervention: iv });
      s.set({ simulation: r, scenarios: [] });
      setDay(0); setPlaying(true);
    } catch (e) { toast.error(`Simulation error: ${(e as Error).message}`); }
    finally { setBusy(false); }
  }

  const cur = sim?.days[Math.min(day, (sim?.days.length ?? 1) - 1)];
  const chart = sim?.days.map((d) => ({ day: d.day, affected: +d.affectedPct.toFixed(2), infected: +d.infectionPct.toFixed(2), severity: +(d.meanSeverity * 100).toFixed(2), weather: +d.weatherFactor.toFixed(3) })) ?? [];
  const keyDays = sim ? [0, 1, 3, 5, 7, 10, 14, 21, 30].filter((d) => d < sim.days.length) : [];

  return (
    <>
      <PageHeader title="Disease Spread Simulation" subtitle="Spatial SEIR model with weather-modulated transmission" crumbs={["Simulation"]} actions={<><DemoBadge label="Prototype simulation" /><NextStep to="/intervention" label="Intervention scenarios" disabled={!sim} /></>} />
      {missing.length > 0 && (
        <div className="mb-6 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
          Missing inputs: {missing.join(", ")}. {missing.some((m) => m.includes("field")) && <Link to="/field-map" className="text-primary underline">Draw field</Link>} The simulation can still run using a whole-grid field and default weather if a disease is set.
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-4">
        <Panel title="Controls" className="lg:col-span-1">
          <div className="space-y-4 text-sm">
            <div><p className="mb-1 text-xs text-muted-foreground">Disease</p>
              <Select value={disease ?? ""} onValueChange={(v) => s.set({ diseaseOverride: v as "late_blight" })}>
                <SelectTrigger><SelectValue placeholder="Choose disease" /></SelectTrigger>
                <SelectContent><SelectItem value="late_blight">Late Blight</SelectItem><SelectItem value="early_blight">Early Blight</SelectItem></SelectContent>
              </Select>
            </div>
            <div><p className="mb-1 text-xs text-muted-foreground">Duration: {days} days</p><Slider value={[days]} min={3} max={30} onValueChange={([v]) => setDays(v)} /></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Grid</span><span>{s.gridSize} × {s.gridSize}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Initial infection</span><span>{s.infected.length >= 3 ? "Marked area" : `${s.infectedPct}%`}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Weather source</span><span>{s.weather ? (s.weather.source === "live" ? "Live forecast" : "Demo") : "None (neutral)"}</span></div>
            <div><p className="mb-1 text-xs text-muted-foreground">Intervention</p>
              <Select value={ivId} onValueChange={setIvId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DEFAULT_SCENARIOS.map((x) => <SelectItem key={x.id} value={x.id}>{x.label}</SelectItem>)}</SelectContent></Select>
            </div>
            <Button className="w-full" onClick={run} disabled={!base || busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}Run Simulation</Button>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" disabled={!sim} onClick={() => { if (sim && day >= sim.days.length - 1) setDay(0); setPlaying(!playing); }}>{playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}{playing ? "Pause" : "Play"}</Button>
              <Button variant="outline" className="flex-1" disabled={!sim} onClick={() => { setPlaying(false); setDay(0); }}><RotateCcw className="h-4 w-4" />Reset</Button>
            </div>
            {busy && <div><Progress value={60} className="animate-pulse" /><p className="mt-1 text-xs text-muted-foreground">Running spatial disease simulation…</p></div>}
          </div>
        </Panel>
        <Panel title={cur ? `Day ${cur.day} of ${sim!.days.length - 1}` : "Spatial heatmap"} subtitle={disease ? DISEASE_LABEL[disease] : undefined} className="lg:col-span-2">
          {sim && cur ? (
            <>
              <div className="mx-auto max-w-[460px]"><SimGrid n={sim.gridSize} states={cur.states} mask={sim.mask} severity={cur.severity} /></div>
              <Slider className="mt-5" value={[day]} min={0} max={sim.days.length - 1} onValueChange={([v]) => { setPlaying(false); setDay(v); }} />
              <div className="mt-3 flex flex-wrap gap-1.5">{keyDays.map((k) => <Button key={k} size="sm" variant={k === day ? "default" : "outline"} className="h-7 px-2.5 text-xs" onClick={() => { setPlaying(false); setDay(k); }}>Day {k}</Button>)}</div>
              <div className="mt-4"><GridLegend /></div>
            </>
          ) : <div className="flex aspect-square max-h-[460px] w-full items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">Run the simulation to see the spatial spread.</div>}
        </Panel>
        <div className="space-y-4">
          <StatCard label="Infection % (I+R)" value={cur ? `${cur.infectionPct.toFixed(1)}%` : "—"} tone="danger" />
          <StatCard label="Affected area (E+I+R)" value={cur ? `${cur.affectedPct.toFixed(1)}%` : "—"} />
          <StatCard label="Mean severity" value={cur ? `${(cur.meanSeverity * 100).toFixed(1)}%` : "—"} />
          <StatCard label="Weather influence" value={cur ? `× ${cur.weatherFactor.toFixed(2)}` : "—"} hint="T × RH × rain modifiers" />
          {cur && <Panel title="Daily statistics"><dl className="grid grid-cols-4 gap-1 text-center text-xs">{(["S", "E", "I", "R"] as const).map((k) => <div key={k}><dt className="text-muted-foreground">{k}</dt><dd className="font-semibold">{cur[k]}</dd></div>)}</dl></Panel>}
        </div>
      </div>
      {sim && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Panel title="Disease progression & affected area (%)">
            <ResponsiveContainer width="100%" height={240}><LineChart data={chart}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="day" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><ReferenceLine x={day} stroke="var(--primary)" /><Line dataKey="affected" stroke="var(--chart-2)" strokeWidth={2} dot={false} name="Affected" /><Line dataKey="infected" stroke="var(--chart-1)" strokeWidth={2} dot={false} name="Infected" /></LineChart></ResponsiveContainer>
          </Panel>
          <Panel title="Severity (%) & weather influence">
            <ResponsiveContainer width="100%" height={240}><LineChart data={chart}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="day" fontSize={11} /><YAxis yAxisId="l" fontSize={11} /><YAxis yAxisId="r" orientation="right" fontSize={11} /><Tooltip /><Line yAxisId="l" dataKey="severity" stroke="var(--chart-4)" strokeWidth={2} dot={false} name="Severity" /><Line yAxisId="r" dataKey="weather" stroke="var(--chart-3)" strokeWidth={2} dot={false} name="Weather factor" /></LineChart></ResponsiveContainer>
          </Panel>
          <div className="lg:col-span-2"><Disclaimer>Prototype simulation with prototype parameters ({sim.engine}). Results are model-based projections under the selected assumptions and should not be interpreted as guaranteed field outcomes.</Disclaimer></div>
        </div>
      )}
    </>
  );
}
