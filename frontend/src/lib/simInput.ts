import type { DiseaseClass, SimulationRequest } from "@/types";
import { numericParams } from "@/data/diseases";
import { useAnalysis, useActiveDisease } from "@/store/analysis";

/** Builds the shared simulation inputs from the current analysis state. */
export function useSimBase(days: number): { base: Omit<SimulationRequest, "intervention"> | null; disease: DiseaseClass | null; missing: string[] } {
  const s = useAnalysis();
  const d = useActiveDisease();
  const disease = d && d !== "healthy" ? d : null;
  const missing: string[] = [];
  if (!disease) missing.push("a diseased prediction (or choose a disease)");
  if (!s.weather) missing.push("weather data");
  if (s.field.length < 3) missing.push("a field boundary");
  if (!disease) return { base: null, disease, missing };
  return {
    disease,
    missing,
    base: {
      disease,
      gridSize: s.gridSize,
      days,
      field: s.field,
      infected: s.infected,
      infectedPct: s.infectedPct,
      weather: s.weather?.daily ?? [],
      params: numericParams(disease),
      seed: 42,
    },
  };
}
