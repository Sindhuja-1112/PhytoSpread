/**
 * Service configuration. When VITE_PHYTO_API_URL points at the external Python
 * service (FastAPI/Flask exposing /api/disease/predict, /api/simulation/run ...),
 * the HTTP adapters are used. Otherwise the in-browser demo/prototype services run.
 */
export const PHYTO_API_URL: string | undefined = import.meta.env.VITE_PHYTO_API_URL || undefined;

// Disease prediction is configured separately so simulation adapters stay unchanged.
export const DISEASE_API_URL = (import.meta.env.VITE_PHYTO_DISEASE_API_URL || "https://phytospread-api.onrender.com").replace(/\/+$/, "");

export const isDemoMode = () => !PHYTO_API_URL;

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${PHYTO_API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Service error ${res.status}`);
  return res.json() as Promise<T>;
}
