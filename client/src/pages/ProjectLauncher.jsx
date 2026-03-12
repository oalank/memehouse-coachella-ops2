import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useProject } from "../state/projectStore";
import { daysUntil, isLive, getSprintLabel, formatDate } from "../utils/dates";
import "../styles/launcher.css";

const RAIL_ITEMS = [
  { id: "projects", label: "Projects", path: "/projects", icon: "◉" },
  { id: "executive", label: "Executive", pathId: "executive", icon: "▣" },
  { id: "kanban", label: "Hiring Pipeline", pathId: "kanban", icon: "▤" },
  { id: "operators", label: "Operators", pathId: "operators", icon: "▥" },
  { id: "credentials", label: "Credentials", pathId: "creds", icon: "▦" },
  { id: "shifts", label: "Shifts", pathId: "shifts", icon: "▧" },
];

export default function ProjectLauncher() {
  const navigate = useNavigate();
  const { projects, setProjectId, projectId: activeId } = useProject();
  const [filter, setFilter] = useState("all"); // all | upcoming | live

  const filtered = useMemo(() => {
    if (filter === "live") return projects.filter((p) => isLive(p.eventStartISO));
    if (filter === "upcoming") return projects.filter((p) => !isLive(p.eventStartISO));
    return projects;
  }, [projects, filter]);

  const handleSelect = (id) => {
    setProjectId(id);
    navigate(`/p/${id}/executive`, { replace: true });
  };

  const handleRailClick = (item) => {
    if (item.path) {
      navigate(item.path);
      return;
    }
    if (item.pathId && activeId) navigate(`/p/${activeId}/${item.pathId}`);
  };

  return (
    <div className="launcher-wrap">
      <div className="launcher-rail" role="navigation" aria-label="Main">
        {RAIL_ITEMS.map((item) => {
          const isActive = item.id === "projects";
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleRailClick(item)}
              className={`launcher-rail-item ${isActive ? "launcher-rail-item--active" : ""}`}
              title={item.label}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="launcher-rail-icon">{item.icon}</span>
              <span className="launcher-rail-label">{item.label}</span>
            </button>
          );
        })}
      </div>

      <main className="launcher-main">
        <div className="launcher-vignette" aria-hidden="true" />
        <div className="launcher-content">
          <header className="launcher-header">
            <div>
              <h1 className="launcher-title">Select a production</h1>
              <p className="launcher-subtitle">Choose a project to open the ops dashboard.</p>
            </div>
            <div className="launcher-filter">
              {["all", "upcoming", "live"].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`launcher-filter-btn ${filter === f ? "launcher-filter-btn--active" : ""}`}
                >
                  {f === "all" ? "All" : f === "upcoming" ? "Upcoming" : "Live"}
                </button>
              ))}
            </div>
          </header>

          <div className="launcher-grid">
            {filtered.length === 0 ? (
              <p className="launcher-empty">No projects match this filter.</p>
            ) : (
              filtered.map((p) => {
                const live = isLive(p.eventStartISO);
                const accent = p.theme?.accentColor ?? "#6366f1";
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelect(p.id)}
                    className="launcher-card"
                    style={{ "--card-accent": accent }}
                  >
                    <div className="launcher-card-icon" style={{ background: `linear-gradient(135deg, ${accent}, #6366f1)` }}>
                      {p.theme?.logoLetter ?? p.name.charAt(0)}
                    </div>
                    <div className="launcher-card-body">
                      <div className="launcher-card-row">
                        <span className={`launcher-card-status launcher-card-status--${live ? "live" : "upcoming"}`} title={live ? "Live" : "Upcoming"} />
                        <span className="launcher-card-name">{p.name}</span>
                      </div>
                      <div className="launcher-card-meta">
                        {formatDate(p.eventStartISO)} • {getSprintLabel(p.eventStartISO)}
                      </div>
                    </div>
                    <span className="launcher-card-action">Open →</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </main>

      <nav className="launcher-bottom-nav" aria-label="Mobile navigation">
        {RAIL_ITEMS.map((item) => {
          const isActive = item.id === "projects";
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleRailClick(item)}
              className={`launcher-bottom-nav-item ${isActive ? "launcher-bottom-nav-item--active" : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              <span className="launcher-bottom-nav-icon">{item.icon}</span>
              <span className="launcher-bottom-nav-label">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
