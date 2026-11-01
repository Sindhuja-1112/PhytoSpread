import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAnalysis } from "@/store/analysis";
import { PageHeader, Panel } from "@/components/phyto/ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AppSettings } from "@/types";

export const Route = createFileRoute("/_dash/settings")({
  head: () => ({ meta: [{ title: "Settings — PhytoSpread" }, { name: "description", content: "Profile, simulation defaults and preferences." }, { property: "og:title", content: "Settings — PhytoSpread" }, { property: "og:description", content: "App settings." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Settings,
});

function Settings() {
  const { settings, set, clearHistory, resetAnalysis } = useAnalysis();
  const up = (p: Partial<AppSettings>) => set({ settings: { ...settings, ...p } });
  return (
    <>
      <PageHeader title="Settings" subtitle="Saved automatically in this browser." crumbs={["Settings"]} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Profile">
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={settings.name} onChange={(e) => up({ name: e.target.value || "Field Researcher" })} /></div>
            <div><Label>Email</Label><Input type="email" value={settings.email} onChange={(e) => up({ email: e.target.value })} /></div>
          </div>
        </Panel>
        <Panel title="Simulation defaults">
          <div className="space-y-4">
            <div><Label>Default crop</Label><Select value={settings.defaultCrop} onValueChange={() => up({ defaultCrop: "potato" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="potato">Potato</SelectItem></SelectContent></Select></div>
            <div><Label>Simulation duration: {settings.simDays} days</Label><Slider className="mt-2" value={[settings.simDays]} min={3} max={30} onValueChange={([v]) => up({ simDays: v })} /></div>
            <div><Label>Grid resolution</Label><Select value={String(settings.gridSize)} onValueChange={(v) => { up({ gridSize: +v }); set({ gridSize: +v }); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[10, 15, 20, 30, 40].map((n) => <SelectItem key={n} value={String(n)}>{n} × {n}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Confidence threshold: {(settings.confidenceThreshold * 100).toFixed(0)}%</Label><Slider className="mt-2" value={[settings.confidenceThreshold * 100]} min={50} max={95} onValueChange={([v]) => up({ confidenceThreshold: v / 100 })} /><p className="mt-1 text-xs text-muted-foreground">Predictions below this request additional images.</p></div>
          </div>
        </Panel>
        <Panel title="Weather">
          <Label>Weather source</Label>
          <Select value={settings.weatherMode} onValueChange={(v) => up({ weatherMode: v as "live" | "demo" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="live">Live forecast (Open-Meteo)</SelectItem><SelectItem value="demo">Demo weather data</SelectItem></SelectContent></Select>
        </Panel>
        <Panel title="Notifications & theme">
          <div className="space-y-3">
            {([["notifyDisease", "Disease alerts"], ["notifyWeather", "Weather updates"], ["notifySimulation", "Simulation results"]] as const).map(([k, l]) => (
              <div key={k} className="flex items-center justify-between"><Label>{l}</Label><Switch checked={settings[k]} onCheckedChange={(v) => up({ [k]: v })} /></div>
            ))}
            <div className="flex items-center justify-between"><Label>Dark theme</Label><Switch checked={settings.theme === "dark"} onCheckedChange={(v) => up({ theme: v ? "dark" : "light" })} /></div>
          </div>
        </Panel>
        <Panel title="Data">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => { resetAnalysis(); toast.success("Current analysis cleared."); }}>Clear current analysis</Button>
            <Button variant="destructive" onClick={() => { clearHistory(); toast.success("History cleared."); }}>Clear history</Button>
          </div>
        </Panel>
      </div>
    </>
  );
}
