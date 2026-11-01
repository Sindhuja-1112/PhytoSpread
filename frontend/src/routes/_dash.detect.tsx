import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Upload, X, RefreshCw, Loader2, CheckCircle2, AlertTriangle, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { useAnalysis } from "@/store/analysis";
import { PageHeader, Panel, LiveBadge, Disclaimer } from "@/components/phyto/ui";
import { analyse } from "@/lib/analyse";
import { prepareImage, ACCEPTED_TYPES, MAX_FILE_MB, MIN_RES } from "@/services/diseaseModel";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_dash/detect")({
  head: () => ({ meta: [{ title: "Disease Detection — PhytoSpread" }, { name: "description", content: "Upload potato leaf images for EfficientNet-B0 disease detection." }, { property: "og:title", content: "Disease Detection — PhytoSpread" }, { property: "og:description", content: "Potato leaf disease detection with EfficientNet-B0." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Detect,
});

function Detect() {
  const { images, set, settings } = useAnalysis();
  const nav = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const replaceId = useRef<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const requestLock = useRef(false);
  const [error, setError] = useState<string | null>(null);

  async function addFiles(files: FileList | File[]) {
    if (requestLock.current || progress !== null) return;
    setError(null);
    const list = Array.from(files);
    const room = replaceId.current ? 1 : 5 - images.length;
    if (room <= 0) return toast.error("Maximum of 5 images.");
    const next = [...images];
    setProgress(0);
    for (const [i, f] of list.slice(0, room).entries()) {
      try {
        const img = await prepareImage(f);
        const { dataUrl: _d, ...leaf } = img;
        if (replaceId.current) {
          const idx = next.findIndex((x) => x.id === replaceId.current);
          if (idx >= 0) next[idx] = leaf;
        } else next.push(leaf);
        if (leaf.quality.status === "poor") toast.warning(`${f.name}: image quality is insufficient. Please upload a clearer image.`);
      } catch (e) {
        setError((e as Error).message);
        toast.error((e as Error).message);
      }
      setProgress(((i + 1) / Math.min(list.length, room)) * 100);
    }
    replaceId.current = null;
    if (list.length > room) toast.info(`Only ${room} more image(s) allowed.`);
    set({ images: next, prediction: null, gradcam: {} });
    setTimeout(() => setProgress(null), 500);
  }

  async function run() {
    if (requestLock.current || progress !== null) return;
    requestLock.current = true;
    setBusy(true);
    setError(null);
    set({ prediction: null, diseaseOverride: null, gradcam: {} });
    try {
      const { res, uncertain } = await analyse(images, settings.confidenceThreshold);
      set({ prediction: res, diseaseOverride: null, gradcam: {} });
      nav({ to: uncertain ? "/uncertainty" : "/diagnosis" });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Prediction failed. Please retry.";
      setError(message);
      toast.error(message);
    } finally {
      requestLock.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Upload Leaf Images" subtitle="Upload 1–5 affected leaf images for AI analysis. Each image is analysed separately; the latest usable image supplies the diagnosis." crumbs={["Disease Detection", "Upload"]} actions={<LiveBadge label="EfficientNet-B0" />} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Images" subtitle={`${images.length}/5 uploaded · JPG, PNG, WEBP · max ${MAX_FILE_MB} MB · min ${MIN_RES}px`} className="lg:col-span-2">
          <input ref={input} type="file" accept={ACCEPTED_TYPES.join(",")} multiple disabled={busy || progress !== null} hidden onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {images.map((img) => (
              <div key={img.id} className="group relative overflow-hidden rounded-xl border">
                <img src={img.thumb} alt={img.name} className="aspect-square w-full object-cover" />
                <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-90">
                  <button disabled={busy || progress !== null} aria-label="Replace image" className="rounded-full bg-card p-1 shadow" onClick={() => { replaceId.current = img.id; input.current?.click(); }}><RefreshCw className="h-3.5 w-3.5" /></button>
                  <button disabled={busy || progress !== null} aria-label="Remove image" className="rounded-full bg-card p-1 shadow" onClick={() => set({ images: images.filter((x) => x.id !== img.id), prediction: null })}><X className="h-3.5 w-3.5" /></button>
                </div>
                <div className={cn("flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium", img.quality.status === "poor" ? "bg-destructive/10 text-destructive" : "bg-primary-soft text-primary")}>
                  {img.quality.status === "poor" ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                  Image quality: {img.quality.status === "good" ? "Good" : img.quality.status === "acceptable" ? "Acceptable" : "Insufficient"}
                </div>
                {img.quality.issues.length > 0 && <p className="px-2 pb-1.5 text-[10px] text-muted-foreground">{img.quality.issues.join(" · ")}</p>}
              </div>
            ))}
            {images.length < 5 && (
              <button
                disabled={busy || progress !== null}
                onClick={() => input.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
                className={cn("flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-sm text-muted-foreground transition-colors", drag ? "border-primary bg-primary-soft" : "hover:border-primary")}
              >
                {images.length ? <ImagePlus className="h-7 w-7 text-primary" /> : <Upload className="h-7 w-7 text-primary" />}
                <span className="font-medium">{images.length ? "Add more images" : "Drop images or click"}</span>
              </button>
            )}
          </div>
          {progress !== null && <div className="mt-4"><Progress value={progress} /><p className="mt-1 text-xs text-muted-foreground">Checking image quality…</p></div>}
        </Panel>
        <div className="space-y-6">
          <Panel title="Analyse">
            <p className="text-sm text-muted-foreground">EfficientNet-B0 analyses each usable original image. The diagnosis shows the latest image’s prediction and confidence returned by the API.</p>
            <Button className="mt-4 w-full" disabled={!images.length || busy || progress !== null} onClick={run}>
              {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Analysing images…</> : error ? "Retry Analysis" : "Analyse Disease"}
            </Button>
            {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
          </Panel>
          <Disclaimer>
            <b>Model scores:</b> confidence is returned by your trained model and is not a calibrated probability of correctness. Explanation images are shown only when returned by the API.
          </Disclaimer>
        </div>
      </div>
    </>
  );
}
