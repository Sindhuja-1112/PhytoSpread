import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Thermometer, Droplets, CloudRain, Wind, Compass, RefreshCw, CloudSun, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useAnalysis, useActiveDisease } from "@/store/analysis";
import { PageHeader, Panel, StatCard, DemoBadge, LiveBadge, EmptyState, NextStep, Disclaimer } from "@/components/phyto/ui";
import { getWeather, demoWeather, weatherLabel, compass, weatherRisk } from "@/services/weather";
import { numericParams } from "@/data/diseases";
import { Button } from "@/components/ui/button";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_dash/weather")({
  head: () => ({ meta: [{ title: "Weather — PhytoSpread" }, { name: "description", content: "Field weather, 5-day forecast and disease-favourability risk." }, { property: "og:title", content: "Weather — PhytoSpread" }, { property: "og:description", content: "Field weather intelligence." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Weather,
});

function Weather() {
  const { weather, location, set, settings } = useAnalysis();
  const d = useActiveDisease();
  const [busy, setBusy] = useState(false);
  if (!location) return <EmptyState icon={CloudSun} title="No field location" description="Choose a field location first — weather loads automatically." to="/location" cta="Select location" />;

  async function refresh() {
    setBusy(true);
    try { set({ weather: await getWeather(location!, settings.weatherMode) }); }
    catch { set({ weather: demoWeather(location!) }); toast.warning("Weather service unavailable — showing demo weather data."); }
    finally { setBusy(false); }
  }
  if (!weather) return <EmptyState icon={CloudSun} title="Weather not loaded" description="Fetch weather for your field." />;

  const p = d && d !== "healthy" ? numericParams(d) : numericParams("late_blight");
  const risk = weatherRisk(weather.daily, p.hThresh, p.smithTmin ?? 10);
  const data = weather.daily.map((x) => ({ day: new Date(x.date).toLocaleDateString(undefined, { weekday: "short" }), tMax: x.tMax, tMin: x.tMin, humidity: x.humidity, rain: x.rainfall }));

  return (
    <>
      <PageHeader
        title="Weather Forecast"
        subtitle={`${location.label} · ${weather.provider} · updated ${fmtDateTime(weather.fetchedAt)}`}
        crumbs={["Weather"]}
        actions={<>{weather.source === "live" ? <LiveBadge label="Live data" /> : <DemoBadge label="Demo weather data" />}<Button variant="outline" onClick={refresh} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Refresh</Button><NextStep to="/field-map" label="Draw field" /></>}
      />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard label="Temperature" value={`${weather.current.temperature.toFixed(1)}°C`} hint={weatherLabel(weather.current.code)} icon={Thermometer} />
        <StatCard label="Humidity" value={`${weather.current.humidity}%`} icon={Droplets} />
        <StatCard label="Rainfall" value={`${weather.current.rainfall} mm`} icon={CloudRain} />
        <StatCard label="Wind Speed" value={`${weather.current.windSpeed} km/h`} icon={Wind} />
        <StatCard label="Wind Direction" value={`${compass(weather.current.windDir)} (${weather.current.windDir}°)`} icon={Compass} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="5-Day Forecast" className="lg:col-span-2">
          <div className="grid grid-cols-5 gap-2">
            {weather.daily.slice(0, 5).map((x, i) => (
              <div key={x.date} className="rounded-lg border p-3 text-center">
                <p className="text-xs font-medium text-muted-foreground">{i === 0 ? "Today" : new Date(x.date).toLocaleDateString(undefined, { weekday: "short" })}</p>
                <CloudSun className="mx-auto my-2 h-6 w-6 text-info" />
                <p className="font-semibold">{x.tMax.toFixed(0)}° <span className="text-muted-foreground">{x.tMin.toFixed(0)}°</span></p>
                <p className="text-[11px] text-muted-foreground">{x.rainfall.toFixed(1)} mm · {x.humidity.toFixed(0)}%</p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Weather risk" subtitle="Based on disease-parameter thresholds">
          <p className={cn("font-display text-3xl font-semibold", risk.level === "High" ? "text-destructive" : risk.level === "Moderate" ? "text-warning-foreground" : "text-primary")}>{risk.level}</p>
          <p className="mt-1 text-sm text-muted-foreground">{risk.favourableDays} of the next 5 days have humidity near/above {p.hThresh}% RH and minimum temperature ≥ {p.smithTmin ?? 10}°C.</p>
          <div className="mt-4"><Disclaimer>Qualitative indicator only — not a validated disease forecast.</Disclaimer></div>
        </Panel>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="Temperature (°C)"><ResponsiveContainer width="100%" height={200}><LineChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="day" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Line dataKey="tMax" stroke="var(--chart-2)" strokeWidth={2} name="Max" /><Line dataKey="tMin" stroke="var(--chart-3)" strokeWidth={2} name="Min" /></LineChart></ResponsiveContainer></Panel>
        <Panel title="Humidity (%)"><ResponsiveContainer width="100%" height={200}><LineChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="day" fontSize={11} /><YAxis fontSize={11} domain={[0, 100]} /><Tooltip /><Line dataKey="humidity" stroke="var(--chart-1)" strokeWidth={2} /></LineChart></ResponsiveContainer></Panel>
        <Panel title="Rainfall (mm)"><ResponsiveContainer width="100%" height={200}><BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="day" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Bar dataKey="rain" fill="var(--chart-3)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></Panel>
      </div>
    </>
  );
}
