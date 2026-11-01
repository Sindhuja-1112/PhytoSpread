import { useEffect, useRef, useState } from "react";
import type { LatLng } from "@/types";
import "leaflet/dist/leaflet.css";

type Mode = "view" | "field" | "infected" | "pick";

interface Props {
  center: LatLng;
  zoom?: number;
  field?: LatLng[];
  infected?: LatLng[];
  marker?: LatLng | null;
  mode?: Mode;
  onFieldChange?: (p: LatLng[]) => void;
  onInfectedChange?: (p: LatLng[]) => void;
  onPick?: (p: LatLng) => void;
  className?: string;
}

/** Leaflet map, loaded only in the browser. Click to add vertices, drag vertices to edit. */
export function FieldMap({ center, zoom = 17, field = [], infected = [], marker, mode = "view", onFieldChange, onInfectedChange, onPick, className }: Props) {
  const el = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ref = useRef<{ L: any; map: any; layer: any } | null>(null);
  const [ready, setReady] = useState(false);
  const cb = useRef({ onFieldChange, onInfectedChange, onPick, mode, field, infected });
  cb.current = { onFieldChange, onInfectedChange, onPick, mode, field, infected };

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((mod) => {
      const L = mod.default ?? mod;
      if (cancelled || !el.current || ref.current) return;
      const map = L.map(el.current, { zoomControl: true, attributionControl: true }).setView([center.lat, center.lng], zoom);
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19,
        attribution: "Imagery © Esri",
      }).addTo(map);
      const layer = L.layerGroup().addTo(map);
      map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        const p = { lat: e.latlng.lat, lng: e.latlng.lng };
        const c = cb.current;
        if (c.mode === "field") c.onFieldChange?.([...c.field, p]);
        else if (c.mode === "infected") c.onInfectedChange?.([...c.infected, p]);
        else if (c.mode === "pick") c.onPick?.(p);
      });
      ref.current = { L, map, layer };
      setReady(true);
    });
    return () => {
      cancelled = true;
      ref.current?.map.remove();
      ref.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ref.current) ref.current.map.setView([center.lat, center.lng], ref.current.map.getZoom());
  }, [center.lat, center.lng]);

  useEffect(() => {
    if (!ready || !ref.current) return;
    const { L, layer } = ref.current;
    layer.clearLayers();
    const css = getComputedStyle(document.documentElement);
    const green = css.getPropertyValue("--state-s").trim() || "green";
    const red = css.getPropertyValue("--state-i").trim() || "red";
    const draw = (pts: LatLng[], color: string, editable: boolean, onChange?: (p: LatLng[]) => void) => {
      if (pts.length >= 2) L.polygon(pts.map((p) => [p.lat, p.lng]), { color, weight: 2.5, fillOpacity: 0.25 }).addTo(layer);
      if (editable)
        pts.forEach((p, i) => {
          const m = L.marker([p.lat, p.lng], {
            draggable: true,
            icon: L.divIcon({ className: "", html: `<div style="width:12px;height:12px;border-radius:9999px;background:white;border:2px solid ${color}"></div>`, iconSize: [12, 12], iconAnchor: [6, 6] }),
          }).addTo(layer);
          m.on("dragend", () => {
            const ll = m.getLatLng();
            const next = [...pts];
            next[i] = { lat: ll.lat, lng: ll.lng };
            onChange?.(next);
          });
        });
    };
    draw(field, green, mode === "field", onFieldChange);
    draw(infected, red, mode === "infected", onInfectedChange);
    if (marker) L.circleMarker([marker.lat, marker.lng], { radius: 8, color: "white", weight: 3, fillColor: red, fillOpacity: 1 }).addTo(layer);
    ref.current.map.getContainer().style.cursor = mode === "view" ? "" : "crosshair";
  }, [ready, field, infected, marker, mode, onFieldChange, onInfectedChange]);

  return (
    <div className={className}>
      <div ref={el} className="h-full w-full rounded-lg bg-muted" />
    </div>
  );
}
