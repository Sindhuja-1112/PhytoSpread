import type { DiseaseClass, GradCamResponse, ImageQuality, LeafImage, PredictRequest, PredictResponse } from "@/types";
import { createUniqueId } from "@/lib/id";
import { DISEASE_API_URL } from "./config";

export const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
export const MAX_FILE_MB = 10;
export const MIN_RES = 224;

/** Contract every disease classifier (demo or PyTorch-backed) implements. */
export interface DiseaseModelService {
  readonly name: string;
  readonly source: "demo" | "live";
  predict(req: PredictRequest): Promise<PredictResponse>;
  gradcam(image: { id: string; dataUrl: string }): Promise<GradCamResponse>;
}

// Original files remain in memory, not in browser history/localStorage.
const uploads = new Map<string, File>();
const originalSources = new Map<string, string>();
const explanations = new Map<string, GradCamResponse>();
export function originalImageSource(image: LeafImage): string {
  return originalSources.get(image.id) ?? image.thumb;
}
export function originalUpload(image: LeafImage) {
  const file = uploads.get(image.id);
  if (!file) throw new Error(`${image.name}: please re-upload this image before analysis.`);
  return { id: image.id, dataUrl: image.thumb, file };
}

// ---------- browser image helpers ----------
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("Image could not be read"));
    img.src = src;
  });
}

function readFile(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(new Error("File could not be read"));
    r.readAsDataURL(file);
  });
}

function pixels(img: HTMLImageElement, size: number) {
  const scale = Math.min(1, size / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Image processing is unavailable in this browser.");
  ctx.drawImage(img, 0, 0, w, h);
  return { data: ctx.getImageData(0, 0, w, h).data, w, h, canvas: c };
}

/** Validates type/size/readability/resolution and computes a quality assessment. */
export async function prepareImage(file: File): Promise<LeafImage & { dataUrl: string }> {
  if (!ACCEPTED_TYPES.includes(file.type)) throw new Error(`${file.name}: unsupported format. Use JPG, PNG or WEBP.`);
  if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`${file.name}: file is larger than ${MAX_FILE_MB} MB.`);
  const raw = await readFile(file);
  let img: HTMLImageElement;
  try { img = await loadImage(raw); } catch { throw new Error(`${file.name}: image is corrupted or unreadable.`); }

  const { data, w, h } = pixels(img, 256);
  let lum = 0, edge = 0;
  const L = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    L[i] = (0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) / 255;
    lum += L[i];
  }
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    edge += Math.abs(4 * L[i] - L[i - 1] - L[i + 1] - L[i - w] - L[i + w]);
  }
  const brightness = lum / (w * h);
  const sharpness = (edge / ((w - 2) * (h - 2))) * 100;
  const issues: string[] = [];
  if (img.width < MIN_RES || img.height < MIN_RES) issues.push(`Resolution below ${MIN_RES}×${MIN_RES}px`);
  if (brightness < 0.15) issues.push("Image is too dark");
  if (brightness > 0.9) issues.push("Image is overexposed");
  if (sharpness < 1.2) issues.push("Image appears blurry");
  const status: ImageQuality["status"] = issues.length === 0 ? (sharpness > 2.5 ? "good" : "acceptable") : issues.length === 1 && !issues[0].startsWith("Resolution") ? "acceptable" : "poor";

  const thumb = pixels(img, 320).canvas.toDataURL("image/jpeg", 0.82);
  const id = createUniqueId();
  uploads.set(id, file);
  originalSources.set(id, raw);
  return {
    id,
    name: file.name,
    thumb,
    dataUrl: thumb,
    quality: { status, width: img.width, height: img.height, brightness, sharpness, issues },
  };
}

// Backend labels and response fields were verified against the deployed API.
const BACKEND_CLASSES = {
  Potato___Early_blight: "early_blight",
  Potato___Late_blight: "late_blight",
  Potato___healthy: "healthy",
} as const;

function score(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

/** Accept raster Base64 only; reject malformed payloads and non-image data URIs. */
export function explanationImageSource(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const input = value.trim();
  const uri = /^data:(image\/(?:png|jpeg|jpg|webp));base64,([\s\S]+)$/i.exec(input);
  if (input.startsWith("data:") && !uri) return null;
  const base64 = (uri?.[2] ?? input).replace(/\s/g, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 === 1) return null;
  try {
    const bytes = atob(base64);
    const mime = bytes.startsWith("\x89PNG\r\n\x1a\n") ? "image/png"
      : bytes.startsWith("\xff\xd8\xff") ? "image/jpeg"
      : bytes.startsWith("RIFF") && bytes.slice(8, 12) === "WEBP" ? "image/webp" : null;
    if (!mime || (uri && uri[1].toLowerCase().replace("image/jpg", "image/jpeg") !== mime)) return null;
    return `data:${mime};base64,${base64}`;
  } catch { return null; }
}

export function parsePrediction(body: unknown, imageId: string): PredictResponse {
  if (!body || typeof body !== "object") throw new Error("The API returned an invalid prediction response.");
  const data = body as Record<string, unknown>;
  const label = data["predicted_class"];
  if (typeof label !== "string" || !(label in BACKEND_CLASSES)) throw new Error("The API returned an unsupported potato disease class.");
  const disease = BACKEND_CLASSES[label as keyof typeof BACKEND_CLASSES];
  const confidence = data["confidence"];
  const raw = data["probabilities"];
  if (!score(confidence) || !raw || typeof raw !== "object") throw new Error("The API returned invalid confidence or class scores.");
  const values = raw as Record<string, unknown>;
  const early = values["Potato___Early_blight"], late = values["Potato___Late_blight"], healthy = values["Potato___healthy"];
  if (!score(early) || !score(late) || !score(healthy)) throw new Error("The API returned invalid class scores.");
  const probabilities: Record<DiseaseClass, number> = { early_blight: early, late_blight: late, healthy };
  const uncertainty = -Object.values(probabilities).reduce((sum, p) => sum + (p > 0 ? p * Math.log(p) : 0), 0) / Math.log(3);
  return {
    disease, confidence, probabilities, uncertainty, quality_status: "good",
    per_image: [{ id: imageId, probabilities }], source: "live",
    model: typeof data["model"] === "string" ? data["model"] : "EfficientNet-B0",
    ...(typeof data["note"] === "string" ? { note: data["note"] } : {}),
    ...(typeof data["uncertain"] === "boolean" ? { backendUncertain: data["uncertain"] } : {}),
    predictionImageId: imageId, createdAt: new Date().toISOString(),
  };
}

function apiError(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const data = body as Record<string, unknown>;
    const detail = data["detail"] ?? data["error"] ?? data["message"];
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map((item) => typeof item?.msg === "string" ? item.msg : "Invalid image upload").join("; ");
  }
  if (status === 502) return "The prediction service returned HTTP 502 (Bad Gateway). Render may still be starting the backend or the model request failed upstream. Please retry.";
  if (status === 503) return "The prediction service returned HTTP 503 (Service Unavailable). The backend is unavailable or still starting. Please retry.";
  if (status === 504) return "The prediction service returned HTTP 504 (Gateway Timeout). The model took too long to respond. Please retry.";
  return `Prediction API error (${status}). Please retry when the service is available.`;
}

export class HttpDiseaseModel implements DiseaseModelService {
  readonly name = "EfficientNet-B0";
  readonly source = "live" as const;

  async predict(req: PredictRequest): Promise<PredictResponse> {
    if (!req.images.length) throw new Error("No images provided");
    const per: PredictResponse["per_image"] = [];
    let latest: PredictResponse | undefined;
    for (const image of req.images) {
      explanations.delete(image.id);
      if (!image.file) throw new Error("Please re-upload the original image before analysis.");
      const form = new FormData();
      form.append("file", image.file, image.file.name);
      let response: Response;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120_000);
      try {
        response = await fetch(`${DISEASE_API_URL}/predict`, { method: "POST", body: form, signal: controller.signal });
      } catch (error) {
        if (controller.signal.aborted) throw new Error("The prediction API took too long to respond. Please retry when the service is available.");
        if (error instanceof TypeError) {
          throw new Error(`The browser could not reach ${DISEASE_API_URL}/predict. Check your network connection; if the request appears in the browser console as a CORS error, the backend must allow this dashboard origin for POST /predict.`);
        }
        throw new Error(`The prediction request failed before receiving a response${error instanceof Error && error.message ? `: ${error.message}` : "."}`);
      } finally {
        clearTimeout(timeout);
      }
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(apiError(body, response.status));
      latest = parsePrediction(body, image.id);
      const data = body as Record<string, unknown>;
      const heatmap = explanationImageSource(data["heatmap_base64"]);
      const overlay = explanationImageSource(data["overlay_base64"]);
      explanations.set(image.id, {
        imageId: image.id, heatmap, overlay,
        kind: heatmap || overlay ? "gradcam" : "unavailable", source: "live",
      });
      per.push(...latest.per_image);
    }
    if (!latest) throw new Error("No prediction returned by the API.");
    // Independent requests: never multiply scores or invent combined confidence.
    return { ...latest, per_image: per };
  }

  async gradcam(image: { id: string; dataUrl: string }): Promise<GradCamResponse> {
    // Reuse this image's actual /predict response; no second request or fake map.
    return explanations.get(image.id) ?? { imageId: image.id, heatmap: null, overlay: null, kind: "unavailable", source: "live" };
  }
}

export const diseaseModel: DiseaseModelService = new HttpDiseaseModel();
