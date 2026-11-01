import type { LeafImage } from "@/types";
import { diseaseModel, originalUpload } from "@/services/diseaseModel";

export async function analyse(images: LeafImage[], threshold: number) {
  const usable = images.filter((i) => i.quality.status !== "poor");
  if (!usable.length) throw new Error("Image quality is insufficient. Please upload a clearer image.");
  const res = await diseaseModel.predict({ crop: "potato", images: usable.map(originalUpload) });
  return { res, uncertain: res.backendUncertain === true || res.confidence < threshold };
}
