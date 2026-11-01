import type { CellState, InterventionSpec, ScenarioSummary, SimDay, SimulationRequest, SimulationResult, WeatherDay } from "@/types";
import { cellCenter, pointInPolygon, seededRandom } from "@/lib/geo";
import { createUniqueId } from "@/lib/id";
import { apiPost, isDemoMode } from "./config";

export const STATE_LABEL = ["Susceptible", "Exposed", "Infected", "Removed/Treated"] as const;

// ---------- Weather modulation (coefficients come from the Disease Parameter Engine) ----------
export function temperatureModifier(t: number, p: Record<string, number>) {
  const opt = p.tOpt ?? 20, w = p.tWidth ?? 6;
  return Math.exp(-((t - opt) ** 2) / (2 * w * w));
}
export function humidityModifier(h: number, p: Record<string, number>) {
  const th = p.hThresh ?? 85, k = p.hSlope ?? 0.2;
  return 1 / (1 + Math.exp(-k * (h - th)));
}
export function rainfallModifier(r: number, p: Record<string, number>) {
  return Math.min(p.rainCap ?? 1.5, 1 + (p.rainK ?? 0.05) * r);
}
export function weatherFactor(d: WeatherDay | undefined, p: Record<string, number>) {
  if (!d) return 1;
  // Normalise so that "ideal" conditions approach ~1.
  return temperatureModifier(d.tMean, p) * humidityModifier(d.humidity, p) * 2 * rainfallModifier(d.rainfall, p) / (p.rainCap ?? 1.5);
}

/**
 * Spatial stochastic SEIR on a regular grid laid over the field polygon.
 *   P(S→E) = 1 − exp(−β · W(t) · Σ_j K(d_ij, wind) · I_j · sev_j)
 *   E→I after latent period, I→R after infectious period (or by intervention).
 * Same seed ⇒ identical random draws across scenarios (paired comparison).
 */
export function runSpatialSEIR(req: SimulationRequest): SimulationResult {
  const n = req.gridSize, N = n * n, p = req.params;
  const feat = req.features ?? { spatial: true, weather: true, wind: true };
  const rand = seededRandom(req.seed);

  const mask: boolean[] = new Array(N);
  for (let i = 0; i < N; i++) mask[i] = req.field.length >= 3 ? pointInPolygon(cellCenter(req.field, n, i), req.field) : true;
  const fieldCells = mask.filter(Boolean).length || 1;

  const state = new Array<CellState>(N).fill(0);
  const timer = new Float32Array(N);
  const sev = new Float32Array(N);

  // Initial infection: cells inside marked infected polygon; fallback to percentage seed.
  let seeded = 0;
  if (req.infected.length >= 3 && req.field.length >= 3) {
    for (let i = 0; i < N; i++) if (mask[i] && pointInPolygon(cellCenter(req.field, n, i), req.infected)) { state[i] = 2; sev[i] = 0.2; seeded++; }
  }
  if (seeded === 0) {
    const pct = req.infectedPct ?? 5;
    const target = Math.max(1, Math.round((pct / 100) * fieldCells));
    const cells = [...Array(N).keys()].filter((i) => mask[i]);
    // cluster around a random focus for spatial realism
    const focus = cells[Math.floor(rand() * cells.length)] ?? 0;
    const fr = Math.floor(focus / n), fc = focus % n;
    cells.sort((a, b) => Math.hypot(Math.floor(a / n) - fr, (a % n) - fc) - Math.hypot(Math.floor(b / n) - fr, (b % n) - fc));
    for (const i of cells.slice(0, target)) { state[i] = 2; sev[i] = 0.2; }
  }

  const beta = p.beta ?? 0.4, lat = p.incubation ?? 4, inf = p.infectious ?? 6;
  const L = p.dispersal ?? 1.5, rad = Math.round(p.radius ?? 3), windK = feat.wind ? p.windK ?? 0.4 : 0;
  const sevG = p.sevGrowth ?? 0.3, treatEff = p.treatEff ?? 0.7;
  const iv = req.intervention;

  const days: SimDay[] = [];
  const snapshot = (day: number, wf: number): SimDay => {
    let S = 0, E = 0, I = 0, R = 0, sevSum = 0;
    for (let i = 0; i < N; i++) {
      if (!mask[i]) continue;
      const s = state[i];
      if (s === 0) S++; else if (s === 1) E++; else if (s === 2) I++; else R++;
      sevSum += sev[i];
    }
    return {
      day, states: Array.from(state), severity: Array.from(sev, (v) => Math.round(v * 1000) / 1000),
      S, E, I, R,
      infectionPct: ((I + R) / fieldCells) * 100,
      affectedPct: ((E + I + R) / fieldCells) * 100,
      meanSeverity: sevSum / fieldCells,
      weatherFactor: wf,
    };
  };
  days.push(snapshot(0, feat.weather ? weatherFactor(req.weather[0], p) : 1));

  let treated = false;
  for (let t = 1; t <= req.days; t++) {
    const w = req.weather.length ? req.weather[Math.min(t - 1, req.weather.length - 1)] : undefined;
    const wf = feat.weather ? weatherFactor(w, p) : 1;

    // Intervention applied at the start of its day
    if (iv.action !== "none" && iv.day !== null && t - 1 === iv.day) {
      if (iv.action === "removal") for (let i = 0; i < N; i++) { if (state[i] === 2 || state[i] === 1) { state[i] = 3; sev[i] = 0; } }
      if (iv.action === "treatment") treated = true;
    }
    const betaEff = beta * wf * (treated ? 1 - treatEff : 1);

    // wind vector (direction wind blows TOWARDS = from + 180)
    const wdir = w ? ((w.windDir + 180) * Math.PI) / 180 : 0;
    const wx = Math.sin(wdir), wy = -Math.cos(wdir); // grid y increases downward (south)
    const wStrength = w ? Math.min(1, w.windSpeed / 25) : 0;

    // force of infection
    const force = new Float32Array(N);
    let globalI = 0;
    for (let i = 0; i < N; i++) if (mask[i] && state[i] === 2) globalI += Math.max(0.2, sev[i]);
    for (let j = 0; j < N; j++) {
      if (!mask[j] || state[j] !== 2) continue;
      const jr = Math.floor(j / n), jc = j % n, src = Math.max(0.2, sev[j]);
      if (!feat.spatial) continue;
      for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) {
        if (!dr && !dc) continue;
        const r = jr + dr, c = jc + dc;
        if (r < 0 || c < 0 || r >= n || c >= n) continue;
        const d = Math.hypot(dr, dc);
        if (d > rad + 0.01) continue;
        const align = (dc * wx + dr * wy) / d;
        const k = Math.exp(-d / L) * (1 + windK * wStrength * align);
        force[r * n + c] += src * Math.max(0, k);
      }
    }
    const next = Array.from(state);
    for (let i = 0; i < N; i++) {
      if (!mask[i]) continue;
      if (state[i] === 0) {
        const f = feat.spatial ? force[i] : (globalI / fieldCells) * 4; // mean-field for non-spatial SEIR
        if (rand() < 1 - Math.exp(-betaEff * f)) { next[i] = 1; timer[i] = 0; }
      } else if (state[i] === 1) {
        timer[i] += 1;
        if (timer[i] >= lat) { next[i] = 2; timer[i] = 0; sev[i] = 0.1; }
      } else if (state[i] === 2) {
        timer[i] += 1;
        const g = treated ? sevG * (1 - treatEff) : sevG;
        sev[i] = Math.min(1, sev[i] + g * sev[i] * (1 - sev[i]) + 0.02);
        if (timer[i] >= inf) { next[i] = 3; }
      }
    }
    for (let i = 0; i < N; i++) state[i] = next[i];
    days.push(snapshot(t, wf));
  }

  return {
    id: createUniqueId(),
    gridSize: n,
    mask,
    fieldCells,
    days,
    intervention: iv,
    source: "demo",
    engine: "Prototype spatial SEIR (in-browser TypeScript)",
    createdAt: new Date().toISOString(),
  };
}

/** POST /api/simulation/run */
export async function runSimulation(req: SimulationRequest): Promise<SimulationResult> {
  if (!isDemoMode()) return apiPost<SimulationResult>("/api/simulation/run", req);
  await new Promise((r) => setTimeout(r, 400));
  return runSpatialSEIR(req);
}

export const DEFAULT_SCENARIOS: InterventionSpec[] = [
  { id: "none", label: "No Intervention", action: "none", day: null },
  { id: "t0", label: "Treatment Day 0", action: "treatment", day: 0 },
  { id: "t2", label: "Treatment Day 2", action: "treatment", day: 2 },
  { id: "t4", label: "Treatment Day 4", action: "treatment", day: 4 },
  { id: "r0", label: "Remove Infected Area Day 0", action: "removal", day: 0 },
  { id: "r2", label: "Remove Infected Area Day 2", action: "removal", day: 2 },
];

/** POST /api/intervention/compare — identical inputs, only the intervention differs. */
export async function compareInterventions(base: Omit<SimulationRequest, "intervention">, scenarios = DEFAULT_SCENARIOS): Promise<{ results: SimulationResult[]; summary: ScenarioSummary[] }> {
  const results: SimulationResult[] = [];
  for (const s of scenarios) results.push(await runSimulation({ ...base, intervention: s }));
  const lossK = base.params.lossK ?? 0.6;
  const summarize = (r: SimulationResult) => {
    const last = r.days[r.days.length - 1];
    // Impact index: affected fraction weighted by mean severity of affected cells (prototype).
    const impact = (last.affectedPct / 100) * (0.5 + 0.5 * Math.min(1, last.meanSeverity * (100 / Math.max(1, last.affectedPct))));
    return { last, impact };
  };
  const baseline = summarize(results[0]);
  const summary = results.map((r) => {
    const { last, impact } = summarize(r);
    const loss = impact * lossK * 100;
    const baseLoss = baseline.impact * lossK * 100;
    return {
      intervention: r.intervention,
      finalAffectedPct: last.affectedPct,
      finalSeverity: last.meanSeverity,
      impactIndex: impact,
      projectedLossPct: loss,
      avoidedPct: baseLoss > 0 ? ((baseLoss - loss) / baseLoss) * 100 : 0,
      curve: r.days.map((d) => d.affectedPct),
    };
  });
  return { results, summary };
}

export function fitMetrics(observed: { day: number; value: number }[], sim: number[]) {
  const pairs = observed.filter((o) => o.day < sim.length).map((o) => [o.value, sim[o.day]] as const);
  if (pairs.length < 2) return null;
  const n = pairs.length;
  const mae = pairs.reduce((s, [o, p]) => s + Math.abs(o - p), 0) / n;
  const rmse = Math.sqrt(pairs.reduce((s, [o, p]) => s + (o - p) ** 2, 0) / n);
  const mean = pairs.reduce((s, [o]) => s + o, 0) / n;
  const ssTot = pairs.reduce((s, [o]) => s + (o - mean) ** 2, 0);
  const ssRes = pairs.reduce((s, [o, p]) => s + (o - p) ** 2, 0);
  return { mae, rmse, r2: ssTot > 0 ? 1 - ssRes / ssTot : null, n };
}
