import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { History as HistoryIcon, Eye, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAnalysis } from "@/store/analysis";
import { PageHeader, Panel, EmptyState } from "@/components/phyto/ui";
import { DISEASE_LABEL } from "@/data/diseases";
import { fmtDateTime, prob, pct } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_dash/history")({
  head: () => ({ meta: [{ title: "History — PhytoSpread" }, { name: "description", content: "Saved disease analyses and simulations." }, { property: "og:title", content: "History — PhytoSpread" }, { property: "og:description", content: "Analysis history." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: History,
});

function History() {
  const { history, loadHistory, deleteHistory, set } = useAnalysis();
  const nav = useNavigate();
  if (!history.length) return <EmptyState icon={HistoryIcon} title="No saved analyses" description="Save an analysis from the Analytics page to see it here." to="/detect" cta="Start Analysis" />;
  return (
    <>
      <PageHeader title="Analysis History" crumbs={["History"]} />
      <Panel bodyClass="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Field</TableHead><TableHead>Disease</TableHead><TableHead>Confidence</TableHead><TableHead>Duration</TableHead><TableHead>Projected affected</TableHead><TableHead>Lowest-impact scenario</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {history.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="whitespace-nowrap">{fmtDateTime(h.createdAt)}</TableCell>
                  <TableCell className="max-w-48 truncate">{h.fieldLabel}</TableCell>
                  <TableCell>{h.disease ? DISEASE_LABEL[h.disease] : "—"}</TableCell>
                  <TableCell>{prob(h.confidence)}</TableCell>
                  <TableCell>{h.days ? `${h.days} days` : "—"}</TableCell>
                  <TableCell>{pct(h.projectedAffectedPct)}</TableCell>
                  <TableCell>{h.scenario ?? "—"}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => { loadHistory(h.id); nav({ to: "/analytics" }); }}><Eye className="h-3.5 w-3.5" />View</Button>
                    <Button size="sm" variant="ghost" onClick={() => { loadHistory(h.id); set({ simulation: null, scenarios: [] }); toast.success("Inputs loaded — re-run the simulation."); nav({ to: "/simulation" }); }}><RotateCcw className="h-3.5 w-3.5" />Reuse</Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { deleteHistory(h.id); toast.success("Analysis deleted."); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>
    </>
  );
}
