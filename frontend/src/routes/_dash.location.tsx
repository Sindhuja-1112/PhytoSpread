import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { LocateFixed, Search, MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAnalysis } from "@/store/analysis";
import { PageHeader, Panel, NextStep } from "@/components/phyto/ui";
import { ClientFieldMap } from "@/components/phyto/ClientFieldMap";
import { searchLocation, getWeather } from "@/services/weather";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { FieldLocation } from "@/types";

export const Route = createFileRoute("/_dash/location")({
  head: () => ({ meta: [{ title: "Field Location — PhytoSpread" }, { name: "description", content: "Select your field location to load weather automatically." }, { property: "og:title", content: "Field Location — PhytoSpread" }, { property: "og:description", content: "Choose field location." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Location,
});

function Location() {
  const { location, set, settings } = useAnalysis();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<FieldLocation[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const center = location ?? { lat: 11.0168, lng: 76.9558 };

  async function choose(l: FieldLocation) {
    if (Math.abs(l.lat) > 90 || Math.abs(l.lng) > 180) return toast.error("Invalid location.");
    set({ location: l, field: [], infected: [], simulation: null, scenarios: [] });
    setResults([]);
    try {
      const w = await getWeather(l, settings.weatherMode);
      set({ weather: w });
    } catch {
      const { demoWeather } = await import("@/services/weather");
      set({ weather: demoWeather(l) });
      toast.warning("Weather service unavailable — using labelled demo weather data.");
    }
  }

  function geolocate() {
    if (!navigator.geolocation) return toast.error("Geolocation is not supported by this browser.");
    setBusy("geo");
    navigator.geolocation.getCurrentPosition(
      (p) => { choose({ lat: p.coords.latitude, lng: p.coords.longitude, label: "Current location" }); setBusy(null); },
      () => { toast.error("Could not get your location. Search or click the map instead."); setBusy(null); },
      { timeout: 10000 },
    );
  }

  async function search() {
    if (!q.trim()) return;
    setBusy("search");
    try { const r = await searchLocation(q); setResults(r); if (!r.length) toast.info("No matching places found."); }
    catch { toast.error("Location search unavailable."); }
    finally { setBusy(null); }
  }

  return (
    <>
      <PageHeader title="Select Your Field Location" subtitle="Weather is fetched automatically for this location — no manual entry." crumbs={["Field Map", "Location"]} actions={<NextStep to="/weather" label="View weather" disabled={!location} />} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Choose location" className="lg:col-span-1">
          <Button variant="outline" className="w-full justify-start" onClick={geolocate} disabled={busy === "geo"}>
            {busy === "geo" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />} Use current location
          </Button>
          <div className="mt-3 flex gap-2">
            <Input placeholder="Search town or village" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} />
            <Button size="icon" onClick={search} aria-label="Search">{busy === "search" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}</Button>
          </div>
          {results.length > 0 && (
            <ul className="mt-2 divide-y rounded-lg border">
              {results.map((r) => <li key={`${r.lat}${r.lng}`}><button className="w-full px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => choose(r)}>{r.label}</button></li>)}
            </ul>
          )}
          <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" />Or click anywhere on the map.</p>
          {location && (
            <dl className="mt-6 space-y-2 rounded-lg bg-muted/60 p-4 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Latitude</dt><dd>{location.lat.toFixed(5)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Longitude</dt><dd>{location.lng.toFixed(5)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Location</dt><dd className="text-right">{location.label}</dd></div>
            </dl>
          )}
        </Panel>
        <Panel title="Map" className="lg:col-span-2" bodyClass="p-3">
          <ClientFieldMap center={center} zoom={location ? 16 : 6} marker={location} mode="pick" onPick={(p) => choose({ ...p, label: `Pinned ${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}` })} className="h-[480px]" />
        </Panel>
      </div>
    </>
  );
}
