export const pct = (v: number | null | undefined, d = 1) => (v == null || Number.isNaN(v) ? "—" : `${v.toFixed(d)}%`);
export const prob = (v: number | null | undefined, d = 1) => (v == null ? "—" : `${(v * 100).toFixed(d)}%`);
export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
