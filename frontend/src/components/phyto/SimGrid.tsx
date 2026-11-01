import type { CellState } from "@/types";
import { cn } from "@/lib/utils";

const STATE_CLS = ["bg-state-s", "bg-state-e", "bg-state-i", "bg-state-r"];

export function SimGrid({ n, states, mask, severity, className, showSeverity = true }: { n: number; states: CellState[]; mask: boolean[]; severity?: number[]; className?: string; showSeverity?: boolean }) {
  return (
    <div className={cn("grid aspect-square w-full gap-px rounded-lg bg-border p-px", className)} style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
      {states.map((s, i) => (
        <div
          key={i}
          className={cn(mask[i] ? STATE_CLS[s] : "bg-muted/60")}
          style={mask[i] && s === 2 && showSeverity && severity ? { opacity: 0.55 + 0.45 * severity[i] } : undefined}
        />
      ))}
    </div>
  );
}

export function GridLegend() {
  const items = [["S", "Susceptible", "bg-state-s"], ["E", "Exposed", "bg-state-e"], ["I", "Infected", "bg-state-i"], ["R", "Removed/Treated", "bg-state-r"]];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
      {items.map(([k, l, c]) => (
        <span key={k} className="flex items-center gap-1.5">
          <span className={cn("h-3 w-3 rounded-sm", c)} />
          <b>{k}</b> – {l}
        </span>
      ))}
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <span className="h-3 w-3 rounded-sm bg-muted" /> Outside field
      </span>
    </div>
  );
}
