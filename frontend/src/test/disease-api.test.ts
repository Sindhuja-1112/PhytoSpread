import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpDiseaseModel, parsePrediction, explanationImageSource } from "@/services/diseaseModel";
import { DISEASE_API_URL } from "@/services/config";

const response = {
  predicted_class: "Potato___Early_blight", confidence: 0.9955,
  confidence_percent: 99.55, uncertain: false,
  probabilities: { Potato___Early_blight: 0.9955, Potato___Late_blight: 0.0043, Potato___healthy: 0.0002 },
  model: "EfficientNet-B0",
};
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("FastAPI disease contract", () => {
  const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
  it("converts raw Base64 heatmaps to PNG image sources", () => {
    expect(explanationImageSource(png)).toBe(`data:image/png;base64,${png}`);
  });
  it("supports API data-URI overlays without adding a second prefix", () => {
    expect(explanationImageSource(`data:image/png;base64,${png}`)).toBe(`data:image/png;base64,${png}`);
  });
  it("does not substitute missing or invalid explanation fields", () => {
    for (const value of [undefined, null, "", "not an image", "YWJjZA==", "data:text/html;base64,YWJjZA==", `data:image/jpeg;base64,${png}`]) {
      expect(explanationImageSource(value)).toBeNull();
    }
  });
  it("keeps heatmaps and API overlays paired with each independent image", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...response, heatmap_base64: png, overlay_base64: `data:image/png;base64,${png}` })))
      .mockResolvedValueOnce(new Response(JSON.stringify(response))));
    const model = new HttpDiseaseModel();
    const file = new File(["bytes"], "leaf.jpg", { type: "image/jpeg" });
    await model.predict({ crop: "potato", images: [{ id: "map-one", dataUrl: "preview", file }, { id: "map-two", dataUrl: "preview", file }] });
    expect(await model.gradcam({ id: "map-one", dataUrl: "preview" })).toEqual({ imageId: "map-one", heatmap: `data:image/png;base64,${png}`, overlay: `data:image/png;base64,${png}`, kind: "gradcam", source: "live" });
    expect(await model.gradcam({ id: "map-two", dataUrl: "preview" })).toEqual({ imageId: "map-two", heatmap: null, overlay: null, kind: "unavailable", source: "live" });
  });
  it("preserves a real overlay even when the heatmap is missing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...response, overlay_base64: png }))));
    const model = new HttpDiseaseModel();
    const file = new File(["bytes"], "leaf.jpg", { type: "image/jpeg" });
    await model.predict({ crop: "potato", images: [{ id: "overlay-only", dataUrl: "preview", file }] });
    const result = await model.gradcam({ id: "overlay-only", dataUrl: "preview" });
    expect(result.heatmap).toBeNull();
    expect(result.overlay).toBe(`data:image/png;base64,${png}`);
  });
  it("ends stalled API requests with an explicit retryable timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new Error("aborted")));
    })));
    const file = new File(["bytes"], "leaf.jpg", { type: "image/jpeg" });
    const request = new HttpDiseaseModel().predict({ crop: "potato", images: [{ id: "timeout", dataUrl: "preview", file }] });
    const assertion = expect(request).rejects.toThrow("took too long");
    await vi.advanceTimersByTimeAsync(120_000);
    await assertion;
  });
  it.each([
    ["Potato___Early_blight", "early_blight"],
    ["Potato___Late_blight", "late_blight"],
    ["Potato___healthy", "healthy"],
  ])("maps the supported class %s", (label, expected) => {
    expect(parsePrediction({ ...response, predicted_class: label }, "leaf").disease).toBe(expected);
  });
  it("preserves the exact API confidence and scores", () => {
    const result = parsePrediction(response, "leaf");
    expect(result.confidence).toBe(0.9955);
    expect(result.probabilities).toEqual({ early_blight: 0.9955, late_blight: 0.0043, healthy: 0.0002 });
    expect(result.source).toBe("live");
  });
  it("sends the original file to /predict as multipart field file, without a Content-Type header", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(response)));
    vi.stubGlobal("fetch", fetcher);
    const file = new File(["original bytes"], "leaf.jpg", { type: "image/jpeg" });
    await new HttpDiseaseModel().predict({ crop: "potato", images: [{ id: "leaf", dataUrl: "preview", file }] });
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe(`${DISEASE_API_URL}/predict`);
    expect(options.method).toBe("POST");
    expect(options.headers).toBeUndefined();
    expect([...options.body.keys()]).toEqual(["file"]);
    const submitted = options.body.get("file") as File;
    expect(submitted.name).toBe("leaf.jpg");
    expect(submitted.type).toBe("image/jpeg");
    const bytes = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsText(submitted);
    });
    expect(bytes).toBe("original bytes");
  });
  it("never fabricates pooled confidence across multiple images", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(response)))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...response, confidence: 0.51, uncertain: true }))));
    const file = new File(["bytes"], "leaf.jpg", { type: "image/jpeg" });
    const result = await new HttpDiseaseModel().predict({ crop: "potato", images: [
      { id: "one", dataUrl: "preview", file }, { id: "two", dataUrl: "preview", file },
    ] });
    expect(result.confidence).toBe(0.51);
    expect(result.predictionImageId).toBe("two");
    expect(result.per_image).toHaveLength(2);
    expect(result.backendUncertain).toBe(true);
  });
  it("rejects missing originals rather than sending a thumbnail", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(new HttpDiseaseModel().predict({ crop: "potato", images: [{ id: "leaf", dataUrl: "preview" }] })).rejects.toThrow("re-upload");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("surfaces invalid image errors without retry or fallback", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: "Invalid image file" }), { status: 400 }));
    vi.stubGlobal("fetch", fetcher);
    const file = new File(["bad"], "leaf.jpg", { type: "image/jpeg" });
    await expect(new HttpDiseaseModel().predict({ crop: "potato", images: [{ id: "leaf", dataUrl: "preview", file }] })).rejects.toThrow("Invalid image file");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([502, 503, 504])("identifies prediction service HTTP %s failures", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status })));
    const file = new File(["bytes"], "leaf.jpg", { type: "image/jpeg" });
    await expect(new HttpDiseaseModel().predict({ crop: "potato", images: [{ id: "leaf", dataUrl: "preview", file }] })).rejects.toThrow(`HTTP ${status}`);
  });
  it("distinguishes browser network or CORS failures from API errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const file = new File(["bytes"], "leaf.jpg", { type: "image/jpeg" });
    await expect(new HttpDiseaseModel().predict({ crop: "potato", images: [{ id: "leaf", dataUrl: "preview", file }] })).rejects.toThrow("network connection");
  });
  it("rejects invented or malformed scores", () => {
    expect(() => parsePrediction({ ...response, confidence: 99.55 }, "leaf")).toThrow();
    expect(() => parsePrediction({ ...response, probabilities: undefined }, "leaf")).toThrow();
    expect(() => parsePrediction({ ...response, predicted_class: "unknown" }, "leaf")).toThrow();
  });
});