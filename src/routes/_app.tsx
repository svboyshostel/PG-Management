import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Users, BedDouble, Wallet, Settings, LogOut, MessageCircle } from "lucide-react";
import { getAppStatus, logout } from "@/lib/auth.functions";
import { Button } from "@/components/ui/button";
import { canSendMessages } from "@/lib/wa";
import { NO_BRANCHES } from "@/lib/access";
import { useQueryClient } from "@tanstack/react-query";
import { PwaInstallControl } from "@/components/app/pwa-install";

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const s = await getAppStatus();
    if (!s.db || !s.schema || !s.hasOwner) throw redirect({ to: "/setup" });
    if (!s.user) throw redirect({ to: "/login" });
    return { user: s.user };
  },
  component: AppLayout,
});

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/residents", label: "Residents", icon: Users },
  { to: "/rooms", label: "Rooms", icon: BedDouble },
  { to: "/payments", label: "Payments", icon: Wallet },
  { to: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function AppLayout() {
  const { user } = Route.useRouteContext();
  const go = useNavigate();
  const queries = useQueryClient();
  const signOut = async () => { await queries.cancelQueries(); queries.clear(); await logout(); await go({ to: "/login", replace: true }); };
  const visibleNav = nav.filter((n) => (n.to !== "/settings" || user.role === "owner") && (n.to !== "/whatsapp" || canSendMessages(user)));
  return (
    <div className="min-h-screen bg-background md:flex">
      <aside className="hidden w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="px-5 py-6 font-display text-xl font-semibold">PG <span className="text-sidebar-primary">Manager</span></div>
        <nav className="flex-1 space-y-1 px-3">
          {visibleNav.map((n) => (
            <Link key={n.to} to={n.to} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-sidebar-accent"
              activeProps={{ className: "bg-sidebar-accent font-semibold text-sidebar-primary" }}>
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-4 text-sm">
          <div className="font-medium">{user.full_name}</div>
          <div className="text-xs capitalize opacity-70">{user.role}</div>
          <div className="mt-3">
            <PwaInstallControl variant="secondary" fullWidth />
          </div>
          <Button variant="ghost" size="sm" className="mt-2 text-sidebar-foreground" onClick={signOut}>
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 pb-24 pt-6 md:px-8 md:pb-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 md:hidden"><span className="font-display font-semibold">PG Manager</span><div className="flex items-center gap-1"><PwaInstallControl variant="outline" /><Button variant="ghost" size="sm" onClick={signOut}><LogOut className="h-4 w-4" />Sign out</Button></div></div>
        {user.role === "staff" && !user.branch_ids.length ? <p role="status" className="text-sm text-muted-foreground">{NO_BRANCHES}</p> : <Outlet />}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t bg-card md:hidden">
        {visibleNav.map((n) => (
          <Link key={n.to} to={n.to} className="flex flex-col items-center gap-1 py-2 text-[11px] text-muted-foreground"
            activeProps={{ className: "text-primary font-semibold" }}>
            <n.icon className="h-5 w-5" /> {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
