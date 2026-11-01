import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { AlertTriangle, Loader2, ImagePlus, CheckCircle2, ScanSearch } from "lucide-react";
import { toast } from "sonner";
import { useAnalysis } from "@/store/analysis";
import { PageHeader, Panel, ProbBar, DemoBadge, LiveBadge, EmptyState } from "@/components/phyto/ui";
import { DISEASE_LABEL, DISEASE_CLASSES } from "@/data/diseases";
import { prepareImage, ACCEPTED_TYPES } from "@/services/diseaseModel";
import { analyse } from "@/lib/analyse";
import { Button } from "@/components/ui/button";
import { prob } from "@/lib/format";

export const Route = createFileRoute("/_dash/uncertainty")({
  head: () => ({ meta: [{ title: "Uncertainty Analysis — PhytoSpread" }, { name: "description", content: "Handles uncertain AI predictions by requesting more image evidence." }, { property: "og:title", content: "Uncertainty Analysis — PhytoSpread" }, { property: "og:description", content: "Review potato disease confidence and independent image predictions." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Uncertainty,
});

function Uncertainty() {
  const { prediction, images, settings, set } = useAnalysis();
  const nav = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const requestLock = useRef(false);
  const [error, setError] = useState<string | null>(null);

  if (!prediction) return <><>{busy && <p role="status">Analysing images…</p>}{error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}</><EmptyState icon={ScanSearch} title="No prediction yet" description="Upload leaf images to get a prediction." to="/detect" cta={error ? "Retry on upload page" : "Upload images"} /></>;
  const uncertain = prediction.backendUncertain === true || prediction.confidence < settings.confidenceThreshold;

  async function addAndRerun(files: FileList) {
    if (requestLock.current) return;
    requestLock.current = true;
    setBusy(true);
    setError(null);
    try {
      const room = 5 - images.length;
      if (room <= 0) throw new Error("Maximum of 5 images reached. Replace an image on the upload page.");
      const added = [];
      for (const f of Array.from(files).slice(0, room)) {
        try { const { dataUrl: _d, ...leaf } = await prepareImage(f); added.push(leaf); } catch (e) { toast.error((e as Error).message); }
      }
      const all = [...images, ...added];
      if (!added.length) throw new Error("No valid new images. Please upload a clearer potato leaf image.");
      set({ images: all, prediction: null, gradcam: {} });
      const { res, uncertain: still } = await analyse(added, settings.confidenceThreshold);
      set({ images: all, prediction: res, gradcam: {} });
      if (!still) { toast.success("Confidence is now sufficient — continuing to diagnosis."); nav({ to: "/diagnosis" }); }
      else toast.info("Prediction is still uncertain. Additional, clearer images may help.");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Prediction failed. Please retry.";
      setError(message);
      toast.error(message);
    } finally { requestLock.current = false; setBusy(false); }
  }

  return (
    <>
      <PageHeader title="Uncertainty Analysis" crumbs={["Disease Detection", "Uncertainty"]} actions={prediction.source === "demo" ? <DemoBadge label="Demo prediction" /> : <LiveBadge label={prediction.model} />} />
      {uncertain ? (
        <div className="mb-6 flex gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
          <div>
            <p className="font-semibold text-destructive">AI prediction is uncertain</p>
            <p className="text-sm text-muted-foreground">The available image evidence is not sufficient for a reliable classification (confidence {prob(prediction.confidence)} &lt; threshold {prob(settings.confidenceThreshold, 0)}).</p>
          </div>
        </div>
      ) : (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary-soft p-4">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          <p className="flex-1 text-sm">Confidence meets the threshold.</p>
          <Button asChild size="sm"><Link to="/diagnosis">View diagnosis</Link></Button>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={prediction.source === "live" ? "Latest image scores" : "Combined probabilities"} subtitle={prediction.source === "live" ? "Independent API scores; confidence is not pooled across images." : `Based on ${prediction.per_image.length} image(s) · normalised entropy ${(prediction.uncertainty * 100).toFixed(0)}%`}>
          <div className="space-y-4">
            {DISEASE_CLASSES.map((k) => <ProbBar key={k} label={DISEASE_LABEL[k]} value={prediction.probabilities[k]} highlight={k === prediction.disease} />)}
          </div>
          <input ref={input} type="file" multiple disabled={busy} accept={ACCEPTED_TYPES.join(",")} hidden onChange={(e) => { if (e.target.files) addAndRerun(e.target.files); e.target.value = ""; }} />
          <div className="mt-6 flex flex-wrap gap-2">
            <Button onClick={() => input.current?.click()} disabled={busy || images.length >= 5}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} Upload Additional Images
            </Button>
            <Button variant="outline" asChild><Link to="/detect">Manage images</Link></Button>
          </div>
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
          <p className="mt-3 text-xs text-muted-foreground">Tips: photograph a single leaf in daylight, fill the frame, avoid blur and shadows, include both sides of lesions.</p>
        </Panel>
        <Panel title="Per-image evidence">
          <div className="space-y-3">
            {prediction.per_image.map((p) => {
              const img = images.find((i) => i.id === p.id);
              const top = DISEASE_CLASSES.reduce((a, b) => (p.probabilities[a] > p.probabilities[b] ? a : b));
              return (
                <div key={p.id} className="flex items-center gap-3 rounded-lg border p-2">
                  {img && <img src={img.thumb} alt="" className="h-14 w-14 rounded-md object-cover" />}
                  <div className="flex-1 text-sm">
                    <div className="font-medium">{DISEASE_LABEL[top]} · {prob(p.probabilities[top])}</div>
                    <div className="text-xs text-muted-foreground">{DISEASE_CLASSES.map((k) => `${DISEASE_LABEL[k]} ${prob(p.probabilities[k], 0)}`).join(" · ")}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </>
  );
}
