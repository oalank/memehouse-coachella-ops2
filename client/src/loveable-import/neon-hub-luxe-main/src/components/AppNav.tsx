import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Home, LayoutDashboard, Columns3, Users, FileCheck, Clock, Menu, X } from "lucide-react";

const links = [
  { to: "/", label: "Home", icon: Home },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/kanban", label: "Pipeline", icon: Columns3 },
  { to: "/operators", label: "Operators", icon: Users },
  { to: "/credentials", label: "Credentials", icon: FileCheck },
  { to: "/shifts", label: "Shifts", icon: Clock },
];

export const AppNav = () => {
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 glass-strong border-b border-[hsla(210,20%,93%,0.04)]">
        <div className="container flex h-14 items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center group-hover:bg-primary/20 transition-colors duration-300 pill-glow-amber">
              <span className="text-primary text-sm font-bold">M</span>
            </div>
            <span className="text-sm font-semibold tracking-tight text-foreground">MemeHouse <span className="text-muted-foreground font-normal">Ops</span></span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {links.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-all duration-300",
                  pathname === to
                    ? "glass text-primary pill-glow-amber"
                    : "text-muted-foreground hover:text-foreground hover:bg-[hsla(228,11%,14%,0.5)]"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full glass flex items-center justify-center">
              <span className="text-[10px] font-semibold text-muted-foreground">JD</span>
            </div>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-[hsla(228,11%,14%,0.5)] transition-colors"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-background/70 backdrop-blur-md" />
          <nav
            className="absolute top-14 left-0 right-0 glass-strong border-b border-[hsla(210,20%,93%,0.04)] p-3 flex flex-col gap-1 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            {links.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300",
                  pathname === to
                    ? "glass text-primary pill-glow-amber"
                    : "text-muted-foreground hover:text-foreground hover:bg-[hsla(228,11%,14%,0.5)]"
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </>
  );
};
