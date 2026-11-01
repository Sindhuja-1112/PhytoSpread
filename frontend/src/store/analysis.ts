import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createUniqueId } from "@/lib/id";
import type {
  AnalysisRecord, AppSettings, DiseaseClass, FieldLocation, GradCamResponse, LatLng, LeafImage,
  PredictResponse, ScenarioSummary, SimulationResult, WeatherResponse,
} from "@/types";

interface AnalysisState {
  images: LeafImage[];
  prediction: PredictResponse | null;
  gradcam: Record<string, GradCamResponse>;
  location: FieldLocation | null;
  weather: WeatherResponse | null;
  field: LatLng[];
  infected: LatLng[];
  infectedPct: number;
  gridSize: number;
  simulation: SimulationResult | null;
  scenarios: ScenarioSummary[];
  history: AnalysisRecord[];
  settings: AppSettings;
  diseaseOverride: DiseaseClass | null;

  set: (p: Partial<AnalysisState>) => void;
  resetAnalysis: () => void;
  saveToHistory: () => AnalysisRecord;
  deleteHistory: (id: string) => void;
  loadHistory: (id: string) => void;
  clearHistory: () => void;
}

export const DEFAULT_SETTINGS: AppSettings = {
  name: "Field Researcher",
  email: "",
  defaultCrop: "potato",
  simDays: 14,
  gridSize: 20,
  confidenceThreshold: 0.7,
  weatherMode: "live",
  notifyDisease: true,
  notifyWeather: true,
  notifySimulation: false,
  theme: "light",
};

const blank = {
  images: [], prediction: null, gradcam: {}, location: null, weather: null,
  field: [], infected: [], infectedPct: 5, simulation: null, scenarios: [], diseaseOverride: null,
};

export const useAnalysis = create<AnalysisState>()(
  persist(
    (set, get) => ({
      ...blank,
      gridSize: 20,
      history: [],
      settings: DEFAULT_SETTINGS,
      set: (p) => set(p),
      resetAnalysis: () => set({ ...blank, gridSize: get().settings.gridSize }),
      saveToHistory: () => {
        const s = get();
        const lastDay = s.simulation?.days[s.simulation.days.length - 1];
        const lowest = s.scenarios.length ? [...s.scenarios].sort((a, b) => a.impactIndex - b.impactIndex)[0] : null;
        const rec: AnalysisRecord = {
          id: createUniqueId(),
          createdAt: new Date().toISOString(),
          fieldLabel: s.location?.label ?? "Unnamed field",
          disease: s.prediction?.disease ?? null,
          confidence: s.prediction?.confidence ?? null,
          days: s.simulation ? s.simulation.days.length - 1 : null,
          projectedAffectedPct: lastDay?.affectedPct ?? null,
          scenario: lowest?.intervention.label ?? null,
          snapshot: {
            images: s.images, prediction: s.prediction, location: s.location, weather: s.weather,
            field: s.field, infected: s.infected, infectedPct: s.infectedPct, gridSize: s.gridSize,
            simulation: s.simulation, scenarios: s.scenarios,
          },
        };
        set({ history: [rec, ...s.history].slice(0, 30) });
        return rec;
      },
      deleteHistory: (id) => set({ history: get().history.filter((h) => h.id !== id) }),
      loadHistory: (id) => {
        const h = get().history.find((x) => x.id === id);
        if (h) set({ ...blank, ...(h.snapshot as object) });
      },
      clearHistory: () => set({ history: [] }),
    }),
    {
      name: "phytospread-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { gradcam, ...rest } = s;
        return rest;
      },
    },
  ),
);

export const useActiveDisease = () =>
  useAnalysis((s) => s.diseaseOverride ?? (s.prediction && s.prediction.disease !== "healthy" ? s.prediction.disease : s.prediction ? "healthy" : null));
