import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  LogOut, LayoutDashboard, FileQuestion, Users, ClipboardList,
  ChevronLeft, BarChart3, MessageSquareWarning,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/brand/Logo";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) throw redirect({ to: "/auth" });

    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (rolesError) {
      console.warn("user_roles lookup failed, allowing through:", rolesError);
      return { user };
    }

    const isAdmin = roles?.some((r) => r.role === "admin");
    if (!isAdmin) throw redirect({ to: "/auth" });

    return { user };
  },

  component: AdminLayout,
});

function AdminLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("admin:sidebar:collapsed") === "1";
  });

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      try { window.localStorage.setItem("admin:sidebar:collapsed", next ? "1" : "0"); } catch { /* noop */ }
      return next;
    });
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen flex bg-transparent">
      <aside
        className={cn(
          "bg-sidebar text-sidebar-foreground flex flex-col transition-[width] duration-300 ease-in-out shadow-modal relative z-10",
          collapsed ? "w-16" : "w-64",
        )}
      >
        {/* decorative glow */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/10 to-transparent" />

        {/* Toggle button — half outside the sidebar's right edge */}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
          title={collapsed ? "Expandir" : "Colapsar"}
          className="absolute -right-3 top-20 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-border/70 bg-card text-foreground shadow-elevated transition-all duration-200 ease-in-out hover:scale-110 hover:shadow-glow hover:text-accent"
        >
          <ChevronLeft
            size={14}
            className={cn("transition-transform duration-300 ease-in-out", collapsed && "rotate-180")}
          />
        </button>

        <div className="p-4 border-b border-sidebar-border flex items-center gap-2 relative">
          {!collapsed ? (
            <div className="flex items-center gap-3 min-w-0 animate-soft-pop">
              <LogoMark className="h-10 w-10 shrink-0" />
              <div className="min-w-0">
                <h2 className="font-bold leading-tight truncate tracking-tight">Revisão</h2>
                <p className="text-xs opacity-70 truncate">Ensino Jurídico</p>
              </div>
            </div>
          ) : (
            <LogoMark className="h-9 w-9 shrink-0 mx-auto animate-soft-pop" />
          )}
        </div>
        <nav className="flex-1 p-3 space-y-1 relative overflow-y-auto">
          <NavItem to="/admin" icon={<LayoutDashboard size={18} />} label="Dashboard" collapsed={collapsed} exact />
          <NavItem to="/admin/simulados" icon={<ClipboardList size={18} />} label="Simulados" collapsed={collapsed} />
          <NavItem to="/admin/banco-questoes" icon={<FileQuestion size={18} />} label="Banco de Questões" collapsed={collapsed} />
          <NavItem to="/admin/estudantes" icon={<Users size={18} />} label="Estudantes" collapsed={collapsed} />
          <NavItem to="/admin/respostas" icon={<BarChart3 size={18} />} label="Respostas" collapsed={collapsed} />
          <NavItem to="/admin/feedbacks" icon={<MessageSquareWarning size={18} />} label="Feedbacks" collapsed={collapsed} />
          
        </nav>
        <div className="p-3 border-t border-sidebar-border space-y-2">
          {!collapsed && <p className="text-xs opacity-70 truncate">{user?.email}</p>}
          <div className={cn("flex items-center gap-2", collapsed && "flex-col")}>
            <Button
              variant="ghost"
              size={collapsed ? "icon" : "sm"}
              onClick={handleLogout}
              className={cn(
                "text-sidebar-foreground hover:bg-sidebar-accent",
                collapsed ? "h-8 w-8" : "flex-1 justify-start",
              )}
              title="Sair"
              aria-label="Sair"
            >
              <LogOut size={16} className={collapsed ? "" : "mr-2"} />
              {!collapsed && "Sair"}
            </Button>
            <ThemeToggle className="text-sidebar-foreground hover:bg-sidebar-accent" />
          </div>
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

function NavItem({
  to, icon, label, collapsed, exact,
}: { to: string; icon: React.ReactNode; label: string; collapsed: boolean; exact?: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");
  return (
    <Link
      to={to}
      title={collapsed ? label : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl text-sm transition-all duration-200 ease-in-out",
        collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5",
        active
          ? "bg-sidebar-accent/80 text-sidebar-accent-foreground shadow-glow"
          : "hover:bg-sidebar-accent/50 hover:translate-x-0.5 hover:shadow-glow",
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-accent shadow-glow"
        />
      )}
      <span className={cn("transition-transform duration-200 ease-in-out group-hover:scale-[1.12]", active && "text-accent")}>
        {icon}
      </span>
      {!collapsed && <span className="truncate font-medium">{label}</span>}
    </Link>
  );
}
