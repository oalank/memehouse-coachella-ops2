import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

/**
 * Lovable-style sidebar (aligned with neon-hub-luxe AppSidebar).
 * navSections: [{ label: string, links: [{ to, label, icon: Component }] }]
 * Logo links to /projects; nav links and active state from props/pathname.
 */
export function LovableSidebar({ navSections = [], logoLabel = "MemeHouse", logoSub = "Ops Studio" }) {
  const { pathname } = useLocation();

  return (
    <aside className="fixed left-0 top-0 bottom-0 z-40 w-[260px] flex flex-col sidebar-glass border-r border-[hsla(210,20%,93%,0.06)]">
      {/* Logo — Lovable structure; link target kept project-scoped */}
      <div className="px-6 py-6 border-b border-[hsla(210,20%,93%,0.05)]">
        <Link to="/projects" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center group-hover:bg-primary/25 transition-colors duration-300 pill-glow-amber">
            <span className="text-primary text-sm font-bold">M</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-tight text-foreground leading-tight">{logoLabel}</span>
            <span className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase">{logoSub}</span>
          </div>
        </Link>
      </div>
      <nav className="flex-1 px-3 py-5 space-y-6 overflow-y-auto">
        {navSections.map((section) => (
          <div key={section.label}>
            <span className="px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/60 mb-2 block">
              {section.label}
            </span>
            <div className="space-y-0.5">
              {section.links.map(({ to, label, icon: Icon }) => {
                const isActive = pathname === to || (to !== "/projects" && pathname.startsWith(to + "/"));
                return (
                  <Link
                    key={to}
                    to={to}
                    className={cn(
                      "group sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-300",
                      isActive ? "sidebar-active-link" : "text-muted-foreground"
                    )}
                  >
                    {Icon && (
                      <Icon
                        className={cn("sidebar-icon w-4 h-4 flex-shrink-0 transition-all duration-300",
                          isActive
                            ? "text-[rgb(255,194,51)] drop-shadow-[0_0_6px_rgba(255,200,80,0.5)]"
                            : "text-muted-foreground"
                        )}
                      />
                    )}
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      {/* User/footer — Lovable structure */}
      <div className="px-4 py-4 border-t border-[hsla(210,20%,93%,0.05)]">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full glass flex items-center justify-center">
            <span className="text-[10px] font-semibold text-muted-foreground">Ops</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-foreground leading-tight">MemeHouse Ops</span>
            <span className="text-[10px] text-muted-foreground">Command Center</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
