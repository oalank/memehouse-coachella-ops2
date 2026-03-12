import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Camera,
  Clapperboard,
  Users,
  FileCheck,
  Clock,
  Menu,
  X,
} from "lucide-react";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/dashboard", label: "Projects", icon: Clapperboard },
  { to: "/kanban", label: "Camera Ops", icon: Camera },
  { to: "/operators", label: "Production", icon: Users },
  { to: "/credentials", label: "Credentials", icon: FileCheck },
  { to: "/shifts", label: "Shifts", icon: Clock },
];

export const MobileNav = () => {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <header className="fixed top-0 left-0 right-0 z-50 glass-strong border-b border-[hsla(210,20%,93%,0.04)] h-14 flex items-center px-4 justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center pill-glow-amber">
            <span className="text-primary text-sm font-bold">M</span>
          </div>
          <span className="text-sm font-semibold text-foreground">MemeHouse</span>
        </Link>
        <button
          onClick={() => setOpen(!open)}
          className="p-2 rounded-xl text-muted-foreground hover:text-foreground transition-colors"
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-background/70 backdrop-blur-md" />
          <nav
            className="absolute top-14 left-0 right-0 glass-strong border-b border-[hsla(210,20%,93%,0.04)] p-3 flex flex-col gap-1 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            {links.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setOpen(false)}
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
    </div>
  );
};
