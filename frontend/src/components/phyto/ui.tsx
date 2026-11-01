import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, FlaskConical, Info, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function PageHeader({ title, subtitle, crumbs, actions }: { title: string; subtitle?: string; crumbs?: string[]; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        {crumbs && (
          <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
            {crumbs.map((c, i) => (
              <span key={c} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3" />}
                {c}
              </span>
            ))}
          </div>
        )}
        <h1 className="text-2xl font-semibold text-foreground md:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, subtitle, actions, className, children, bodyClass }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; className?: string; children: ReactNode; bodyClass?: string }) {
  return (
    <section className={cn("panel", className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div>
            {title && <h3 className="text-[15px] font-semibold">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={cn("p-5", bodyClass)}>{children}</div>
    </section>
  );
}

export function StatCard({ label, value, hint, icon: Icon, tone = "default" }: { label: string; value: ReactNode; hint?: ReactNode; icon?: LucideIcon; tone?: "default" | "danger" | "warning" | "success" }) {
  const toneCls = { default: "text-foreground", danger: "text-destructive", warning: "text-warning-foreground", success: "text-primary" }[tone];
  return (
    <div className="panel flex items-start justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className={cn("mt-1 truncate font-display text-xl font-semibold", toneCls)}>{value}</p>
        {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      {Icon && (
        <div className="rounded-lg bg-primary-soft p-2 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}

export function DemoBadge({ label = "Demo", className }: { label?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning-foreground", className)}>
      <FlaskConical className="h-3 w-3" />
      {label}
    </span>
  );
}

export function LiveBadge({ label = "Live" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
      {label}
    </span>
  );
}

export function Disclaimer({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2 rounded-lg border border-info/25 bg-info/5 p-3 text-xs text-muted-foreground">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-info" />
      <div>{children}</div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, to, cta }: { icon: LucideIcon; title: string; description: string; to?: string; cta?: string }) {
  return (
    <div className="panel flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 rounded-2xl bg-primary-soft p-4 text-primary">
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      {to && cta && (
        <Button asChild className="mt-5">
          <Link to={to}>{cta}</Link>
        </Button>
      )}
    </div>
  );
}

export function ProbBar({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className={cn(highlight && "font-semibold")}>{label}</span>
        <span className="tabular-nums text-muted-foreground">{(value * 100).toFixed(1)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", highlight ? "bg-primary" : "bg-primary/40")} style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  );
}

export function NextStep({ to, label, disabled }: { to: string; label: string; disabled?: boolean }) {
  return (
    <Button asChild={!disabled} disabled={disabled}>
      {disabled ? <span>{label}</span> : <Link to={to}>{label} <ChevronRight className="h-4 w-4" /></Link>}
    </Button>
  );
}
