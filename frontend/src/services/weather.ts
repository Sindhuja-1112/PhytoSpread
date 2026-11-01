import type { FieldLocation, LatLng, WeatherDay, WeatherResponse } from "@/types";

/**
 * GET /api/weather contract. Live data comes from Open-Meteo (no key required).
 * If the request fails, a clearly-labelled DEMO dataset is returned.
 */
export async function getWeather(loc: LatLng, mode: "live" | "demo" = "live"): Promise<WeatherResponse> {
  if (mode === "demo") return demoWeather(loc);
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lng}` +
    `&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m,weather_code` +
    `&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean,relative_humidity_2m_mean,precipitation_sum,wind_speed_10m_max,wind_direction_10m_dominant,weather_code` +
    `&forecast_days=7&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Weather service unavailable");
  const j = await res.json();
  const d = j.daily;
  const daily: WeatherDay[] = d.time.map((t: string, i: number) => ({
    date: t,
    tMax: d.temperature_2m_max[i],
    tMin: d.temperature_2m_min[i],
    tMean: d.temperature_2m_mean?.[i] ?? (d.temperature_2m_max[i] + d.temperature_2m_min[i]) / 2,
    humidity: d.relative_humidity_2m_mean?.[i] ?? j.current.relative_humidity_2m,
    rainfall: d.precipitation_sum[i] ?? 0,
    windSpeed: d.wind_speed_10m_max[i] ?? 0,
    windDir: d.wind_direction_10m_dominant[i] ?? 0,
    code: d.weather_code[i] ?? 0,
  }));
  return {
    location: loc,
    current: {
      temperature: j.current.temperature_2m,
      humidity: j.current.relative_humidity_2m,
      rainfall: j.current.precipitation,
      windSpeed: j.current.wind_speed_10m,
      windDir: j.current.wind_direction_10m,
      code: j.current.weather_code,
    },
    daily,
    source: "live",
    provider: "Open-Meteo",
    fetchedAt: new Date().toISOString(),
  };
}

export function demoWeather(loc: LatLng): WeatherResponse {
  const base = new Date();
  const pattern = [
    [21, 15, 86, 5, 12, 240], [22, 15, 90, 6, 10, 250], [24, 16, 82, 2, 14, 230],
    [22, 15, 88, 0, 9, 220], [21, 14, 92, 0, 8, 260], [20, 14, 91, 4, 11, 250], [22, 15, 85, 1, 13, 240],
  ];
  const daily = pattern.map(([mx, mn, h, r, w, dir], i) => {
    const d = new Date(base); d.setDate(d.getDate() + i);
    return { date: d.toISOString().slice(0, 10), tMax: mx, tMin: mn, tMean: (mx + mn) / 2, humidity: h, rainfall: r, windSpeed: w, windDir: dir, code: r > 0 ? 61 : 3 };
  });
  return {
    location: loc,
    current: { temperature: 22, humidity: 80, rainfall: 5, windSpeed: 12, windDir: 240, code: 61 },
    daily,
    source: "demo",
    provider: "Demo weather dataset",
    fetchedAt: new Date().toISOString(),
  };
}

export async function searchLocation(q: string): Promise<FieldLocation[]> {
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6`);
  if (!res.ok) throw new Error("Location search unavailable");
  const j = await res.json();
  return (j.results ?? []).map((r: { latitude: number; longitude: number; name: string; admin1?: string; country?: string }) => ({
    lat: r.latitude,
    lng: r.longitude,
    label: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
  }));
}

export function weatherLabel(code: number) {
  if (code === 0) return "Clear sky";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Fog";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Rain showers";
  return "Thunderstorm";
}

export function compass(deg: number) {
  return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(((deg % 360) / 45)) % 8];
}

/** Qualitative risk derived from the disease parameter thresholds (not a validated forecast). */
export function weatherRisk(days: WeatherDay[], hThresh = 90, tMin = 10): { level: "Low" | "Moderate" | "High"; favourableDays: number } {
  const fav = days.slice(0, 5).filter((d) => d.humidity >= hThresh - 5 && d.tMin >= tMin).length;
  return { level: fav >= 3 ? "High" : fav >= 1 ? "Moderate" : "Low", favourableDays: fav };
}
