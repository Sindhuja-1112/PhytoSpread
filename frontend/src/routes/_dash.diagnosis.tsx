import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ScanSearch, ShieldCheck, ShieldAlert, Loader2 } from "lucide-react";
import { useAnalysis } from "@/store/analysis";
import { PageHeader, Panel, ProbBar, DemoBadge, LiveBadge, EmptyState, Disclaimer, NextStep } from "@/components/phyto/ui";
import { DISEASE_LABEL, DISEASE_CLASSES, DISEASES } from "@/data/diseases";
import { diseaseModel, originalImageSource } from "@/services/diseaseModel";
import { Button } from "@/components/ui/button";
import { prob } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_dash/diagnosis")({
  head: () => ({ meta: [{ title: "Diagnosis Result — PhytoSpread" }, { name: "description", content: "Potato leaf diagnosis with actual model probabilities and API Grad-CAM images." }, { property: "og:title", content: "Diagnosis Result — PhytoSpread" }, { property: "og:description", content: "Potato leaf diagnosis, actual model confidence and Grad-CAM explanations." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Diagnosis,
});

function Diagnosis() {
  const { prediction, images, gradcam, set, settings } = useAnalysis();
  const [sel, setSel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const active = images.find((i) => i.id === sel) ?? images.find((i) => i.id === prediction?.predictionImageId) ?? images[0];

  useEffect(() => {
    setMapError(null);
    if (!active || gradcam[active.id] || !prediction) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    diseaseModel.gradcam({ id: active.id, dataUrl: active.thumb })
      .then((g) => { if (!cancelled) set({ gradcam: { ...useAnalysis.getState().gradcam, [active.id]: g } }); })
      .catch(() => { if (!cancelled) setMapError("Explanation images could not be loaded. Please analyse the image again."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [active, gradcam, prediction, set]);

  if (!prediction) return <EmptyState icon={ScanSearch} title="No diagnosis yet" description="Upload leaf images to receive an AI prediction." to="/detect" cta="Upload images" />;
  const high = prediction.confidence >= settings.confidenceThreshold;
  const g = active ? gradcam[active.id] : undefined;

  return (
    <>
      <PageHeader title="Diagnosis Result" crumbs={["Disease Detection", "Diagnosis"]} actions={<>{prediction.source === "demo" ? <DemoBadge label="Demo prediction" /> : <LiveBadge label={prediction.model} />}<NextStep to={prediction.disease === "healthy" ? "/disease-info" : "/parameters"} label={prediction.disease === "healthy" ? "Disease information" : "Disease parameters"} /></>} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="AI Prediction" className="lg:col-span-1">
          <p className="text-xs text-muted-foreground">Predicted Disease</p>
          {prediction.predictionImageId && <p className="mb-2 text-xs text-muted-foreground">{images.find((i) => i.id === prediction.predictionImageId)?.name}</p>}
          <p className={cn("font-display text-3xl font-semibold", prediction.disease === "healthy" ? "text-primary" : "text-destructive")}>{prediction.source === "live" ? `Potato ${DISEASE_LABEL[prediction.disease]}` : DISEASE_LABEL[prediction.disease]}</p>
          <p className="text-xs italic text-muted-foreground">{DISEASES[prediction.disease].pathogen}</p>
          <div className="mt-4 flex items-center gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Prediction Confidence</p>
              <p className="font-display text-2xl font-semibold">{prob(prediction.confidence, 2)}</p>
            </div>
            <span className={cn("ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", high ? "bg-primary-soft text-primary" : "bg-warning/20 text-warning-foreground")}>
              {high ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}{high ? "High Confidence" : "Low Confidence"}
            </span>
          </div>
          {prediction.note && <p className="mt-3 text-xs text-muted-foreground">{prediction.note}</p>}
          <h4 className="mb-3 mt-6 text-sm font-semibold">Top predictions</h4>
          <div className="space-y-3">{DISEASE_CLASSES.slice().sort((a, b) => prediction.probabilities[b] - prediction.probabilities[a]).map((k) => <ProbBar key={k} label={DISEASE_LABEL[k]} value={prediction.probabilities[k]} highlight={k === prediction.disease} />)}</div>
          {!high && <Link to="/uncertainty" className="mt-4 block text-sm text-primary">Improve confidence with more images →</Link>}
        </Panel>
        <Panel title="Explanation map" subtitle="Original · Grad-CAM heatmap · Grad-CAM overlay" className="lg:col-span-2">
          {active && (
            <div className="grid gap-3 sm:grid-cols-3">
              <ExplanationImage key={`original-${active.id}`} src={originalImageSource(active)} label="Original" />
              <ExplanationImage key={`heatmap-${active.id}-${g?.heatmap}`} src={g?.kind === "gradcam" ? g.heatmap : null} label="Grad-CAM Heatmap" loading={loading} />
              <ExplanationImage key={`overlay-${active.id}-${g?.overlay}`} src={g?.kind === "gradcam" ? g.overlay ?? null : null} label="Grad-CAM Overlay" loading={loading} />
            </div>
          )}
          <div className="mt-4 flex gap-2 overflow-x-auto">
            {images.map((i) => <Button variant="ghost" key={i.id} onClick={() => setSel(i.id)} aria-label={`Show explanation for ${i.name}`} aria-pressed={active?.id === i.id} className={cn("h-auto shrink-0 overflow-hidden rounded-md border-2 p-0", active?.id === i.id ? "border-primary" : "border-transparent")}><img src={i.thumb} alt={i.name} className="h-14 w-14 object-cover" /></Button>)}
          </div>
          {mapError && <p role="alert" className="mt-3 text-sm text-destructive">{mapError}</p>}
          <div className="mt-4">
            <Disclaimer>
              {g?.kind === "gradcam"
                ? "Highlighted regions indicate areas that contributed strongly to the model prediction."
                : "No valid explanation images are available for this image. Analyse the original again to request Grad-CAM images; missing API images are never substituted."}
            </Disclaimer>
          </div>
        </Panel>
      </div>
    </>
  );
}

function ExplanationImage({ src, label, loading = false }: { src?: string | null; label: string; loading?: boolean }) {
  const [failed, setFailed] = useState(false);
  return <figure>
    {loading ? <div role="status" aria-label={`Loading ${label}`} className="flex aspect-square items-center justify-center rounded-lg bg-muted"><Loader2 className="h-5 w-5 animate-spin" /></div>
      : src && !failed ? <img src={src} alt={label} onError={() => setFailed(true)} className="aspect-square w-full rounded-lg object-contain" />
      : <div className="flex aspect-square items-center justify-center rounded-lg bg-muted px-3 text-center text-xs text-muted-foreground">{failed ? `${label} could not be displayed` : `${label} not returned or invalid`}</div>}
    <figcaption className="mt-1 text-xs text-muted-foreground">{label}</figcaption>
  </figure>;
}
