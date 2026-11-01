import type { DiseaseClass, DiseaseParameter } from "@/types";

export interface DiseaseInfo {
  id: DiseaseClass;
  name: string;
  pathogen: string;
  crop: string;
  overview: string;
  symptoms: string[];
  favorable: string[];
  progression: string[];
  control: string[];
  references: { label: string; url?: string }[];
}

export const DISEASE_LABEL: Record<DiseaseClass, string> = {
  healthy: "Healthy",
  early_blight: "Early Blight",
  late_blight: "Late Blight",
};

export const DISEASE_CLASSES: DiseaseClass[] = ["late_blight", "early_blight", "healthy"];

export const DISEASES: Record<DiseaseClass, DiseaseInfo> = {
  late_blight: {
    id: "late_blight",
    name: "Late Blight",
    pathogen: "Phytophthora infestans (oomycete)",
    crop: "Potato",
    overview:
      "Late blight is a destructive disease of potato and tomato caused by the oomycete Phytophthora infestans. Under favourable cool, wet conditions it can spread rapidly across a field through airborne and splash-dispersed sporangia.",
    symptoms: [
      "Pale to dark green, water-soaked lesions, often starting at leaf tips and margins",
      "Lesions turn brown/black and may be surrounded by a pale halo",
      "White sporulation on the underside of leaves under humid conditions",
      "Dark lesions on stems; tuber infection with reddish-brown dry rot",
    ],
    favorable: [
      "Cool to moderate temperatures combined with high relative humidity",
      "Extended periods of leaf wetness (rain, dew, irrigation)",
      "Overcast weather that keeps the canopy wet",
    ],
    progression: [
      "Sporangia land on wet leaf surfaces and infect via zoospores or direct germination",
      "After a short latent period, new lesions produce sporangia",
      "Wind and rain splash disperse sporangia to neighbouring and distant plants",
    ],
    control: [
      "Use certified disease-free seed and resistant cultivars where available",
      "Remove volunteer plants and cull piles that act as inoculum sources",
      "Monitor regional forecasting systems (e.g. Smith/Hutton periods)",
      "Timely protective treatment and removal of infected foci, per local extension advice",
    ],
    references: [
      { label: "Fry, W. (2008). Phytophthora infestans: the plant (and R gene) destroyer. Molecular Plant Pathology 9(3)." },
      { label: "Dancey, S. et al. (2017). The Hutton Criteria: a classification tool for identifying high risk periods for potato late blight disease development in Great Britain." },
      { label: "EPPO Global Database – Phytophthora infestans", url: "https://gd.eppo.int/taxon/PHYTIN" },
    ],
  },
  early_blight: {
    id: "early_blight",
    name: "Early Blight",
    pathogen: "Alternaria solani (fungus)",
    crop: "Potato",
    overview:
      "Early blight is a common foliar disease of potato caused by Alternaria solani. It typically affects older, senescing leaves first and progresses more slowly than late blight.",
    symptoms: [
      "Dark brown circular lesions with concentric rings (target-board pattern)",
      "Yellowing (chlorosis) around lesions",
      "Lesions usually appear first on older, lower leaves",
      "Severe infections cause premature defoliation",
    ],
    favorable: [
      "Warm temperatures",
      "Alternating wet and dry periods",
      "Plant stress, nutrient deficiency and crop senescence",
    ],
    progression: [
      "Conidia germinate on wet leaf surfaces",
      "Lesions expand over several days and produce new conidia",
      "Spores are dispersed by wind, rain splash and machinery",
    ],
    control: [
      "Crop rotation and removal of infected debris",
      "Balanced fertilisation to reduce plant stress",
      "Monitoring of lower canopy and timely treatment per local extension advice",
    ],
    references: [
      { label: "Rotem, J. (1994). The Genus Alternaria: Biology, Epidemiology, and Pathogenicity. APS Press." },
      { label: "Leiminger, J. & Hausladen, H. (2012). Early blight control in potato using disease-orientated threshold values. Plant Disease 96(1)." },
    ],
  },
  healthy: {
    id: "healthy",
    name: "Healthy",
    pathogen: "—",
    crop: "Potato",
    overview: "No disease symptoms detected. Continue routine monitoring, especially during weather periods favourable to blight.",
    symptoms: ["Uniform green foliage", "No lesions, halos or sporulation"],
    favorable: ["—"],
    progression: ["—"],
    control: ["Routine scouting", "Maintain good field hygiene"],
    references: [],
  },
};

const PROTO_NOTE =
  "Prototype value used to demonstrate the simulation pipeline. Replace with calibrated, peer-reviewed parameters before drawing conclusions.";

/**
 * Disease Parameter Engine data. Values marked "prototype" are NOT scientifically validated.
 * Values marked "literature" reproduce published thresholds with citation.
 */
export const DISEASE_PARAMETERS: Record<DiseaseClass, DiseaseParameter[]> = {
  late_blight: [
    { key: "host", label: "Host crop", group: "General", value: "Potato (Solanum tuberosum)", status: "literature", source: "EPPO" },
    { key: "transmission", label: "Transmission type", group: "Transmission", value: "Airborne / rain-splash sporangia", status: "literature", reference: "Fry (2008)" },
    { key: "beta", label: "Base transmission rate (β)", group: "Transmission", value: 0.55, unit: "day⁻¹", status: "prototype", notes: PROTO_NOTE },
    { key: "incubation", label: "Latent / incubation period", group: "Progression", value: 4, unit: "days", status: "prototype", notes: "Order of magnitude consistent with general literature (a few days); exact value depends on temperature and isolate. " + PROTO_NOTE },
    { key: "infectious", label: "Infectious period", group: "Progression", value: 6, unit: "days", status: "prototype", notes: PROTO_NOTE },
    { key: "tOpt", label: "Optimal temperature (centre)", group: "Temperature response", value: 18, unit: "°C", status: "prototype", notes: "Late blight is favoured by cool–moderate temperatures. " + PROTO_NOTE },
    { key: "tWidth", label: "Temperature response width (σ)", group: "Temperature response", value: 6, unit: "°C", status: "prototype", notes: PROTO_NOTE },
    { key: "smithTmin", label: "Smith period – min temperature", group: "Temperature response", value: 10, unit: "°C", status: "literature", reference: "Smith (1956); Dancey et al. (2017)", notes: "Used for risk indication only." },
    { key: "hThresh", label: "Humidity threshold", group: "Humidity response", value: 90, unit: "% RH", status: "literature", reference: "Smith (1956) criterion", notes: "Smith period: RH ≥ 90% for ≥ 11 h on two consecutive days." },
    { key: "hSlope", label: "Humidity response steepness", group: "Humidity response", value: 0.25, unit: "per %RH", status: "prototype", notes: PROTO_NOTE },
    { key: "rainK", label: "Rainfall modifier gain", group: "Rainfall response", value: 0.06, unit: "per mm", status: "prototype", notes: PROTO_NOTE },
    { key: "rainCap", label: "Rainfall modifier cap", group: "Rainfall response", value: 1.6, unit: "×", status: "prototype", notes: PROTO_NOTE },
    { key: "dispersal", label: "Dispersal kernel length", group: "Dispersal", value: 1.6, unit: "cells", status: "prototype", notes: PROTO_NOTE },
    { key: "radius", label: "Dispersal radius", group: "Dispersal", value: 3, unit: "cells", status: "prototype", notes: PROTO_NOTE },
    { key: "windK", label: "Wind directional bias", group: "Wind", value: 0.5, unit: "—", status: "prototype", notes: PROTO_NOTE },
    { key: "sevGrowth", label: "Severity growth rate", group: "Severity", value: 0.35, unit: "day⁻¹", status: "prototype", notes: PROTO_NOTE },
    { key: "treatEff", label: "Treatment effect on transmission", group: "Intervention assumptions", value: 0.7, unit: "fraction reduced", status: "prototype", notes: "Scenario assumption only – not a product efficacy claim." },
    { key: "lossK", label: "Severity → yield-loss coefficient", group: "Yield-loss relationship", value: 0.8, unit: "—", status: "prototype", notes: "Linear prototype relationship; real damage functions are crop-stage dependent." },
    { key: "tubers", label: "Tuber infection relationship", group: "Yield-loss relationship", value: null, status: "not_configured" },
  ],
  early_blight: [
    { key: "host", label: "Host crop", group: "General", value: "Potato (Solanum tuberosum)", status: "literature" },
    { key: "transmission", label: "Transmission type", group: "Transmission", value: "Airborne conidia / rain splash", status: "literature", reference: "Rotem (1994)" },
    { key: "beta", label: "Base transmission rate (β)", group: "Transmission", value: 0.3, unit: "day⁻¹", status: "prototype", notes: PROTO_NOTE },
    { key: "incubation", label: "Latent / incubation period", group: "Progression", value: 5, unit: "days", status: "prototype", notes: PROTO_NOTE },
    { key: "infectious", label: "Infectious period", group: "Progression", value: 8, unit: "days", status: "prototype", notes: PROTO_NOTE },
    { key: "tOpt", label: "Optimal temperature (centre)", group: "Temperature response", value: 25, unit: "°C", status: "prototype", notes: "Early blight is favoured by warmer conditions. " + PROTO_NOTE },
    { key: "tWidth", label: "Temperature response width (σ)", group: "Temperature response", value: 6, unit: "°C", status: "prototype", notes: PROTO_NOTE },
    { key: "hThresh", label: "Humidity threshold", group: "Humidity response", value: 80, unit: "% RH", status: "prototype", notes: PROTO_NOTE },
    { key: "hSlope", label: "Humidity response steepness", group: "Humidity response", value: 0.15, unit: "per %RH", status: "prototype", notes: PROTO_NOTE },
    { key: "rainK", label: "Rainfall modifier gain", group: "Rainfall response", value: 0.03, unit: "per mm", status: "prototype", notes: PROTO_NOTE },
    { key: "rainCap", label: "Rainfall modifier cap", group: "Rainfall response", value: 1.3, unit: "×", status: "prototype", notes: PROTO_NOTE },
    { key: "dispersal", label: "Dispersal kernel length", group: "Dispersal", value: 1.2, unit: "cells", status: "prototype", notes: PROTO_NOTE },
    { key: "radius", label: "Dispersal radius", group: "Dispersal", value: 2, unit: "cells", status: "prototype", notes: PROTO_NOTE },
    { key: "windK", label: "Wind directional bias", group: "Wind", value: 0.3, unit: "—", status: "prototype", notes: PROTO_NOTE },
    { key: "sevGrowth", label: "Severity growth rate", group: "Severity", value: 0.2, unit: "day⁻¹", status: "prototype", notes: PROTO_NOTE },
    { key: "treatEff", label: "Treatment effect on transmission", group: "Intervention assumptions", value: 0.6, unit: "fraction reduced", status: "prototype", notes: "Scenario assumption only – not a product efficacy claim." },
    { key: "lossK", label: "Severity → yield-loss coefficient", group: "Yield-loss relationship", value: 0.5, unit: "—", status: "prototype", notes: PROTO_NOTE },
  ],
  healthy: [],
};

export function numericParams(d: DiseaseClass): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of DISEASE_PARAMETERS[d]) if (typeof p.value === "number") out[p.key] = p.value;
  return out;
}
