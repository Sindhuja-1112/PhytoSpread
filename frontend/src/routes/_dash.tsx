import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/phyto/AppShell";

export const Route = createFileRoute("/_dash")({
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
