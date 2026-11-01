// Shared request/response contracts. These mirror the REST API that external
// Python services (PyTorch classifier, NumPy/SciPy SEIR engine) are expected to expose.

export type DiseaseClass = "healthy" | "early_blight" | "late_blight";
export type CropId = "potato";

export type ServiceSource = "demo" | "live";

export interface LatLng {
  lat: number;
  lng: number;
}

// ---------- Images / prediction ----------
export type QualityStatus = "good" | "acceptable" | "poor";

export interface ImageQuality {
  status: QualityStatus;
  width: number;
  height: number;
  brightness: number; // 0..1
  sharpness: number; // relative edge energy
  issues: string[];
}

export interface LeafImage {
  id: string;
  name: string;
  thumb: string; // downscaled data URL
  quality: ImageQuality;
}

/** POST /predict: one original image per multipart request, field "file". */
export interface PredictRequest {
  crop: CropId;
  images: { id: string; dataUrl: string; file?: File }[];
}
export interface PredictResponse {
  disease: DiseaseClass;
  note?: string;
  backendUncertain?: boolean;
  predictionImageId?: string;
  probabilities: Record<DiseaseClass, number>;
  confidence: number;
  uncertainty: number; // normalized entropy 0..1
  quality_status: QualityStatus;
  per_image: { id: string; probabilities: Record<DiseaseClass, number> }[];
  source: ServiceSource;
  model: string;
  createdAt: string;
}

/** Explanation images returned by POST /predict; kept in transient memory. */
export interface GradCamResponse {
  imageId: string;
  heatmap: string | null; // data URL
  overlay?: string | null; // API overlay, never synthesized in the browser
  kind: "gradcam" | "demo-color-saliency" | "unavailable";
  source: ServiceSource;
}

// ---------- Disease parameters ----------
export type ParamStatus = "literature" | "prototype" | "not_configured";
export interface DiseaseParameter {
  key: string;
  label: string;
  group: string;
  value: number | string | null;
  unit?: string;
  status: ParamStatus;
  source?: string;
  reference?: string;
  notes?: string;
}

// ---------- Weather ----------
export interface WeatherDay {
  date: string;
  tMax: number;
  tMin: number;
  tMean: number;
  humidity: number; // mean %
  rainfall: number; // mm
  windSpeed: number; // km/h
  windDir: number; // degrees from
  code: number;
}
export interface WeatherResponse {
  location: LatLng;
  current: {
    temperature: number;
    humidity: number;
    rainfall: number;
    windSpeed: number;
    windDir: number;
    code: number;
  };
  daily: WeatherDay[];
  source: ServiceSource;
  provider: string;
  fetchedAt: string;
}

// ---------- Field ----------
export interface FieldLocation extends LatLng {
  label: string;
}

// ---------- Simulation ----------
export type CellState = 0 | 1 | 2 | 3; // S E I R

export interface InterventionSpec {
  id: string;
  label: string;
  action: "none" | "treatment" | "removal";
  day: number | null;
}

/** POST /api/simulation/run */
export interface SimulationRequest {
  disease: DiseaseClass;
  gridSize: number;
  days: number;
  field: LatLng[];
  infected: LatLng[];
  infectedPct?: number;
  weather: WeatherDay[];
  params: Record<string, number>;
  intervention: InterventionSpec;
  seed: number;
  features?: { spatial: boolean; weather: boolean; wind: boolean };
}

export interface SimDay {
  day: number;
  states: CellState[]; // length gridSize^2, -1 cells encoded as 3 with mask
  severity: number[]; // 0..1 per cell
  S: number;
  E: number;
  I: number;
  R: number;
  infectionPct: number; // (E? no) I+R over field cells
  affectedPct: number; // E+I+R
  meanSeverity: number;
  weatherFactor: number;
}

export interface SimulationResult {
  id: string;
  gridSize: number;
  mask: boolean[];
  fieldCells: number;
  days: SimDay[];
  intervention: InterventionSpec;
  source: ServiceSource;
  engine: string;
  createdAt: string;
}

export interface ScenarioSummary {
  intervention: InterventionSpec;
  finalAffectedPct: number;
  finalSeverity: number;
  impactIndex: number;
  projectedLossPct: number;
  avoidedPct: number;
  curve: number[];
}

// ---------- History / settings ----------
export interface AnalysisRecord {
  id: string;
  createdAt: string;
  fieldLabel: string;
  disease: DiseaseClass | null;
  confidence: number | null;
  days: number | null;
  projectedAffectedPct: number | null;
  scenario: string | null;
  snapshot: unknown;
}

export interface AppSettings {
  name: string;
  email: string;
  defaultCrop: CropId;
  simDays: number;
  gridSize: number;
  confidenceThreshold: number; // 0..1
  weatherMode: "live" | "demo";
  notifyDisease: boolean;
  notifyWeather: boolean;
  notifySimulation: boolean;
  theme: "light" | "dark";
}
