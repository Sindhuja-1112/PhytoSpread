import { createFileRoute, Link } from "@tanstack/react-router";
import { Bug, Gauge, Ruler, Percent, CloudRain, TrendingUp, AlertTriangle, ScanSearch, Map, Activity, ShieldCheck, Thermometer, Droplets, Wind } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useAnalysis } from "@/store/analysis";
import { PageHeader, Panel, StatCard, DemoBadge, LiveBadge, EmptyState } from "@/components/phyto/ui";
import { ClientFieldMap } from "@/components/phyto/ClientFieldMap";
import { DISEASE_LABEL } from "@/data/diseases";
import { polygonArea, toHectares } from "@/lib/geo";
import { pct, prob, fmtDate } from "@/lib/format";
import { weatherRisk } from "@/services/weather";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_dash/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — PhytoSpread" }, { name: "description", content: "Overview of disease status, field, weather and projected spread." }, { property: "og:title", content: "Dashboard — PhytoSpread" }, { property: "og:description", content: "Field disease overview." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Dashboard,
});

function Dashboard() {
  const s = useAnalysis();
  const ha = toHectares(polygonArea(s.field));
  const infHa = toHectares(polygonArea(s.infected));
  const last = s.simulation?.days.at(-1);
  const risk = s.weather ? weatherRisk(s.weather.daily) : null;
  const lowest = s.scenarios.length ? [...s.scenarios].sort((a, b) => a.impactIndex - b.impactIndex)[0] : null;
  const center = s.location ?? { lat: 11.0168, lng: 76.9558 };

  return (
    <>
      <PageHeader
        title={`Welcome back, ${s.settings.name.split(" ")[0]}`}
        subtitle="Here's what is happening in your field analysis."
        actions={<Button asChild><Link to="/detect">New Analysis</Link></Button>}
      />
      {!s.prediction && (
        <div className="mb-6"><EmptyState icon={ScanSearch} title="No analysis yet" description="Start by uploading leaf images. Values below fill in as you progress through the workflow — nothing is invented." to="/detect" cta="Start Analysis" /></div>
      )}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Current Disease" value={s.prediction ? DISEASE_LABEL[s.prediction.disease] : "—"} icon={Bug} tone={s.prediction?.disease === "healthy" ? "success" : "danger"} hint={s.prediction?.source === "demo" ? "Demo prediction" : undefined} />
        <StatCard label="Prediction Confidence" value={prob(s.prediction?.confidence)} icon={Gauge} />
        <StatCard label="Field Size" value={ha ? `${ha.toFixed(2)} ha` : "—"} icon={Ruler} />
        <StatCard label="Infected Area" value={infHa ? `${infHa.toFixed(2)} ha` : "—"} icon={Map} />
        <StatCard label="Infection %" value={ha && infHa ? pct((infHa / ha) * 100) : "—"} icon={Percent} tone="danger" />
        <StatCard label="Weather Risk" value={risk?.level ?? "—"} icon={CloudRain} tone={risk?.level === "High" ? "danger" : "warning"} hint={risk ? `${risk.favourableDays} favourable days (next 5)` : undefined} />
        <StatCard label="Projected Spread" value={last ? pct(last.affectedPct) : "—"} icon={TrendingUp} hint={last ? `Day ${last.day} · prototype model` : undefined} />
        <StatCard label="Projected Impact" value={lowest ? pct(s.scenarios[0].projectedLossPct) : "—"} icon={AlertTriangle} hint={lowest ? "No-intervention, model-based" : undefined} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="Field Overview" subtitle={s.location?.label ?? "No field selected"} className="lg:col-span-2" actions={<Button asChild size="sm" variant="outline"><Link to="/field-map">Edit map</Link></Button>}>
          <ClientFieldMap center={center} field={s.field} infected={s.infected} className="h-80" />
          <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-state-s" />Field boundary / healthy</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-state-i" />Infected region</span>
          </div>
        </Panel>
        <div className="space-y-6">
          <Panel title="Disease Status" actions={s.prediction?.source === "demo" ? <DemoBadge label="Demo prediction" /> : null}>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <dt className="text-muted-foreground">Disease</dt><dd className="text-right font-semibold">{s.prediction ? DISEASE_LABEL[s.prediction.disease] : "—"}</dd>
              <dt className="text-muted-foreground">Confidence</dt><dd className="text-right">{prob(s.prediction?.confidence)}</dd>
              <dt className="text-muted-foreground">Current infection</dt><dd className="text-right">{ha && infHa ? pct((infHa / ha) * 100) : `${s.infectedPct}% (est.)`}</dd>
              <dt className="text-muted-foreground">Risk level</dt><dd className="text-right">{risk?.level ?? "—"}</dd>
            </dl>
          </Panel>
          <Panel title="Weather" actions={s.weather ? (s.weather.source === "live" ? <LiveBadge /> : <DemoBadge label="Demo weather" />) : null}>
            {s.weather ? (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <span className="flex items-center gap-2"><Thermometer className="h-4 w-4 text-primary" />{s.weather.current.temperature.toFixed(1)}°C</span>
                <span className="flex items-center gap-2"><Droplets className="h-4 w-4 text-info" />{s.weather.current.humidity}%</span>
                <span className="flex items-center gap-2"><CloudRain className="h-4 w-4 text-info" />{s.weather.current.rainfall} mm</span>
                <span className="flex items-center gap-2"><Wind className="h-4 w-4 text-muted-foreground" />{s.weather.current.windSpeed} km/h</span>
              </div>
            ) : <p className="text-sm text-muted-foreground">Set a field location to load weather.</p>}
          </Panel>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="Disease Progression" subtitle={s.simulation ? "Affected area % (prototype simulation)" : "Run a simulation to populate"} className="lg:col-span-2">
          {s.simulation ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={s.simulation.days.map((d) => ({ day: d.day, affected: +d.affectedPct.toFixed(1), infected: +d.infectionPct.toFixed(1) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" fontSize={11} /><YAxis fontSize={11} unit="%" />
                <Tooltip />
                <Line dataKey="affected" stroke="var(--chart-2)" strokeWidth={2} dot={false} name="Affected (E+I+R)" />
                <Line dataKey="infected" stroke="var(--chart-1)" strokeWidth={2} dot={false} name="Infected (I+R)" />
              </LineChart>
            </ResponsiveContainer>
          ) : <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">No simulation data yet.</div>}
        </Panel>
        <div className="space-y-6">
          <Panel title="Quick Actions">
            <div className="grid grid-cols-2 gap-2">
              {[["/detect", "New Analysis", ScanSearch], ["/field-map", "Map Field", Map], ["/simulation", "Run Simulation", Activity], ["/intervention", "Compare Intervention", ShieldCheck]].map(([to, l, I]) => {
                const Icon = I as typeof Map;
                return (
                  <Link key={to as string} to={to as string} className="flex flex-col items-center gap-2 rounded-lg border p-3 text-center text-xs font-medium hover:border-primary hover:bg-primary-soft">
                    <Icon className="h-5 w-5 text-primary" />{l as string}
                  </Link>
                );
              })}
            </div>
          </Panel>
          <Panel title="Recent Analyses" actions={<Link to="/history" className="text-xs text-primary">View all</Link>}>
            {s.history.length ? (
              <ul className="space-y-2.5 text-sm">
                {s.history.slice(0, 4).map((h) => (
                  <li key={h.id} className="flex justify-between gap-2">
                    <span className="truncate">{h.disease ? DISEASE_LABEL[h.disease] : "—"} · {h.fieldLabel}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{fmtDate(h.createdAt)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">No saved analyses yet.</p>}
          </Panel>
        </div>
      </div>
    </>
  );
}
