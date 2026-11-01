import { lazy, Suspense, useEffect, useState, type ComponentProps } from "react";
import { Loader2 } from "lucide-react";
import type { FieldMap as FM } from "./FieldMap";

const FieldMapLazy = lazy(() => import("./FieldMap").then((m) => ({ default: m.FieldMap })));

export function ClientFieldMap(props: ComponentProps<typeof FM>) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const fallback = (
    <div className={props.className}>
      <div className="flex h-full w-full items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading map…
      </div>
    </div>
  );
  if (!mounted) return fallback;
  return (
    <Suspense fallback={fallback}>
      <FieldMapLazy {...props} />
    </Suspense>
  );
}
