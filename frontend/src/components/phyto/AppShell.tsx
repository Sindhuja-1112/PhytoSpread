import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, ScanSearch, Map, CloudSun, Activity, ShieldCheck, BarChart3, ClipboardCheck,
  BookOpen, History, Settings, Bell, Menu, Leaf, ChevronDown, LogOut, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isDemoMode } from "@/services/config";
import { DemoBadge } from "./ui";
import { useAnalysis } from "@/store/analysis";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavItem = { to: string; label: string; icon: typeof Leaf; children?: { to: string; label: string }[] };

export const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    to: "/detect", label: "Disease Detection", icon: ScanSearch,
    children: [
      { to: "/detect", label: "Upload & Analyse" },
      { to: "/uncertainty", label: "Uncertainty Analysis" },
      { to: "/diagnosis", label: "Diagnosis Result" },
      { to: "/parameters", label: "Disease Parameters" },
    ],
  },
  {
    to: "/field-map", label: "Field Map", icon: Map,
    children: [
      { to: "/location", label: "Field Location" },
      { to: "/field-map", label: "Boundary & Infection" },
      { to: "/grid", label: "Spatial Grid" },
    ],
  },
  { to: "/weather", label: "Weather", icon: CloudSun },
  { to: "/simulation", label: "Simulation", icon: Activity },
  { to: "/intervention", label: "Intervention", icon: ShieldCheck },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/validation", label: "Validation", icon: ClipboardCheck },
  { to: "/disease-info", label: "Disease Info", icon: BookOpen },
  { to: "/history", label: "History", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
];

const ALL = NAV.flatMap((n) => [{ to: n.to, label: n.label }, ...(n.children ?? [])]);

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
      {NAV.map((item) => {
        const active = path === item.to || item.children?.some((c) => c.to === path);
        return (
          <div key={item.label}>
            <Link
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {item.children && <ChevronDown className={cn("h-3.5 w-3.5 opacity-60 transition-transform", active && "rotate-180")} />}
            </Link>
            {item.children && active && (
              <div className="ml-5 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-3">
                {item.children.map((c) => (
                  <Link
                    key={c.to + c.label}
                    to={c.to}
                    onClick={onNavigate}
                    className={cn(
                      "block rounded-md px-2.5 py-1.5 text-xs transition-colors",
                      path === c.to ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:text-sidebar-accent-foreground",
                    )}
                  >
                    {c.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5 px-5 py-5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
        <Leaf className="h-4.5 w-4.5" />
      </div>
      <div className="leading-tight">
        <div className="font-display text-[15px] font-bold tracking-wide text-sidebar-accent-foreground">PHYTO SPREAD</div>
        <div className="text-[10px] text-sidebar-foreground/60">Crop disease intelligence</div>
      </div>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const title = ALL.find((a) => a.to === path)?.label ?? "PhytoSpread";
  const settings = useAnalysis((s) => s.settings);
  const prediction = useAnalysis((s) => s.prediction);

  const sidebar = (
    <>
      <Brand />
      <SidebarNav onNavigate={() => setOpen(false)} />
      <div className="m-3 rounded-xl border border-sidebar-border bg-sidebar-accent/60 p-3 text-[11px] text-sidebar-foreground/75">
        {isDemoMode() ? (
          <>
            <div className="mb-1 font-semibold text-sidebar-accent-foreground">Demo services active</div>
            Predictions and simulation use in-browser prototype services. Connect the Python API to go live.
          </>
        ) : (
          <div className="font-semibold text-sidebar-accent-foreground">Connected to PhytoSpread API</div>
        )}
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-sidebar lg:flex">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
          <aside className="relative flex h-full w-64 flex-col bg-sidebar">
            <button className="absolute right-3 top-5 text-sidebar-foreground" onClick={() => setOpen(false)} aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur md:px-8">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold">{title}</span>
          <div className="ml-auto flex items-center gap-3">
            {isDemoMode() && <DemoBadge label="Demo mode" />}
            <DropdownMenu>
              <DropdownMenuTrigger className="relative rounded-full p-2 hover:bg-muted" aria-label="Notifications">
                <Bell className="h-4 w-4" />
                {prediction && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {prediction ? (
                  <DropdownMenuItem asChild>
                    <Link to="/diagnosis">Latest prediction ready – view diagnosis</Link>
                  </DropdownMenuItem>
                ) : (
                  <div className="px-2 py-3 text-xs text-muted-foreground">No notifications yet.</div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-muted">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {settings.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                </span>
                <span className="hidden text-xs font-medium md:inline">{settings.name}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild><Link to="/settings">Profile & settings</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/history">My analyses</Link></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link to="/"><LogOut className="h-4 w-4" /> Back to home</Link></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
