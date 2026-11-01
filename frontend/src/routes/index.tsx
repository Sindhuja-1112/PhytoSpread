import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Brain, CloudSun, Grid3x3, Timer, Eye, ClipboardCheck, Leaf, ScanSearch, ChevronDown } from "lucide-react";
import hero from "@/assets/hero-field.jpg";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PhytoSpread — Healthy Crops. Smarter Decisions." },
      { name: "description", content: "AI-powered disease detection, spatiotemporal spread simulation and intervention-timing analysis for potato crops." },
      { property: "og:title", content: "PhytoSpread — Healthy Crops. Smarter Decisions." },
      { property: "og:description", content: "Detect crop disease, simulate its spread across your field and compare intervention timings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const steps = [
  { icon: ScanSearch, title: "AI Disease Detection", text: "Classify leaf images with confidence and uncertainty." },
  { icon: CloudSun, title: "Weather Intelligence", text: "Location-based forecast drives transmission." },
  { icon: Grid3x3, title: "Spatial Disease Simulation", text: "Spatial SEIR model over your field grid." },
  { icon: Timer, title: "Intervention Analysis", text: "Compare timings under identical assumptions." },
];

const features = [
  { icon: Brain, title: "AI Disease Detection", text: "Multi-image evidence fusion for Healthy, Early Blight and Late Blight, with explicit uncertainty handling." },
  { icon: CloudSun, title: "Weather Intelligence", text: "Automatic forecast for your field — temperature, humidity, rainfall and wind modulate spread." },
  { icon: Grid3x3, title: "Spatial Disease Simulation", text: "Cell-level S→E→I→R dynamics with dispersal kernels and wind-directional bias." },
  { icon: Timer, title: "Intervention Timing", text: "Paired scenario runs reveal how the timing of action changes the projected outcome." },
  { icon: Eye, title: "Explainable AI", text: "Grad-CAM-ready interface showing which leaf regions drove the prediction." },
  { icon: ClipboardCheck, title: "Validation & Analytics", text: "Fit simulations to observed progression data with MAE, RMSE and R², plus ablation studies." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-2 text-primary-foreground">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary"><Leaf className="h-4 w-4" /></div>
            <span className="font-display text-base font-bold tracking-wide">PHYTO SPREAD</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-primary-foreground/85 md:flex">
            <a href="#how" className="hover:text-primary-foreground">How it works</a>
            <a href="#features" className="hover:text-primary-foreground">Features</a>
            <Link to="/disease-info" className="hover:text-primary-foreground">Diseases</Link>
          </nav>
          <Button asChild size="sm"><Link to="/dashboard">Open Dashboard</Link></Button>
        </div>
      </header>

      <section className="relative flex min-h-[640px] items-center overflow-hidden">
        <img src={hero} alt="Potato crop field at sunrise" width={1600} height={1008} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-hero-overlay" />
        <div className="relative mx-auto w-full max-w-7xl px-6 pb-16 pt-28">
          <div className="max-w-xl text-primary-foreground">
            <span className="mb-5 inline-block rounded-full border border-primary-foreground/25 bg-primary-foreground/10 px-3 py-1 text-xs font-medium backdrop-blur">
              Spatiotemporal crop disease decision support
            </span>
            <h1 className="text-4xl font-semibold leading-[1.08] md:text-6xl">Healthy Crops.<br />Smarter Decisions.</h1>
            <p className="mt-5 max-w-lg text-base text-primary-foreground/85 md:text-lg">
              AI-powered disease detection, spatiotemporal spread simulation, and intervention-timing analysis for smarter crop management.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg"><Link to="/detect">Start Analysis <ArrowRight className="h-4 w-4" /></Link></Button>
              <Button asChild size="lg" variant="outline" className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
                <a href="#how">Explore How It Works <ChevronDown className="h-4 w-4" /></a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-7xl px-6 py-20">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">The workflow</p>
        <h2 className="mt-2 max-w-2xl text-3xl font-semibold">From a leaf photo to a field-scale projection.</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-4">
          {steps.map((s, i) => (
            <div key={s.title} className="panel relative p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="rounded-xl bg-primary-soft p-2.5 text-primary"><s.icon className="h-5 w-5" /></div>
                <span className="font-display text-3xl font-semibold text-muted-foreground/30">0{i + 1}</span>
              </div>
              <h3 className="font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
              {i < 3 && <ArrowRight className="absolute -right-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-primary md:block" />}
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="border-t bg-card">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <h2 className="max-w-2xl text-3xl font-semibold">Built for credible, explainable decisions.</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            PhytoSpread combines AI-based crop disease recognition with environmental intelligence and spatial disease simulation to estimate potential disease progression and compare intervention timings.
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border p-6">
                <f.icon className="h-6 w-6 text-primary" />
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-col items-start justify-between gap-4 rounded-2xl bg-sidebar p-8 text-sidebar-accent-foreground md:flex-row md:items-center">
            <div>
              <h3 className="text-xl font-semibold">Ready to analyse a field?</h3>
              <p className="mt-1 text-sm text-sidebar-foreground/75">Upload 1–5 leaf images to begin. Results are model-based projections, not guarantees.</p>
            </div>
            <Button asChild size="lg"><Link to="/detect">Start Analysis <ArrowRight className="h-4 w-4" /></Link></Button>
          </div>
        </div>
      </section>
      <footer className="border-t py-8 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} PhytoSpread · Research prototype</footer>
    </div>
  );
}
