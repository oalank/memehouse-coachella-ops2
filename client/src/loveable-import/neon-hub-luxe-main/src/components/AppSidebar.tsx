import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Home,
  LayoutDashboard,
  Camera,
  Clapperboard,
  Settings,
  Columns3,
  Users,
  FileCheck,
  Clock,
} from "lucide-react";

const navSections = [
  {
    label: "Main",
    links: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/dashboard", label: "Projects", icon: Clapperboard },
      { to: "/kanban", label: "Camera Ops", icon: Camera },
      { to: "/operators", label: "Production", icon: Users },
    ],
  },
  {
    label: "Manage",
    links: [
      { to: "/credentials", label: "Credentials", icon: FileCheck },
      { to: "/shifts", label: "Shifts", icon: Clock },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export const AppSidebar = () => {
  const { pathname } = useLocation();

  return (
    <aside className="fixed left-0 top-0 bottom-0 z-40 w-[260px] flex flex-col sidebar-glass border-r border-[hsla(210,20%,93%,0.06)]">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-[hsla(210,20%,93%,0.05)]">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center group-hover:bg-primary/25 transition-colors duration-300 pill-glow-amber">
            <span className="text-primary text-sm font-bold">M</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight text-foreground leading-tight">
              MemeHouse
            </span>
            <span className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase">
              Ops Studio
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-6 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.label}>
            <span className="px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/60 mb-2 block">
              {section.label}
            </span>
            <div className="space-y-0.5">
              {section.links.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-300",
                    pathname === to
                      ? "sidebar-active-link text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-[hsla(228,11%,14%,0.5)]"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-4 h-4 flex-shrink-0",
                      pathname === to
                        ? "text-primary"
                        : "text-muted-foreground"
                    )}
                  />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="px-4 py-4 border-t border-[hsla(210,20%,93%,0.05)]">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full glass flex items-center justify-center">
            <span className="text-[10px] font-semibold text-muted-foreground">
              JD
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-foreground leading-tight">
              Jane Doe
            </span>
            <span className="text-[10px] text-muted-foreground">
              Producer
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};
