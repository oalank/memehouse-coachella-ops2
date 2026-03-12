import { useState, useMemo, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useProject } from "../state/projectStore";
import { getActiveProjects, getArchiveProjects } from "../data/projectStorage";
import { seedDemo, resetDemo } from "../data/seedDemoData";
import { removeAllExpensesForProject } from "../data/expenseStorage";
import { GlassCard } from "../components/GlassCard";
import CardLightTrack from "../components/CardLightTrack";
import { GlassModal } from "../components/GlassModal";
import AddProjectModal from "../components/AddProjectModal";
import PastProjectsPanel from "../components/PastProjectsPanel";
import { Plus, FolderOpen, Archive, TrendingUp, Clock, ArrowRight, ArrowUpRight, Receipt, UserPlus, FileText } from "lucide-react";
import { StatusPill } from "../components/StatusPill";
import ProductionNotesModal from "../components/ProductionNotesModal";
import { getProjectById } from "../data/projectStorage";
import "./ProjectsLauncher.css";

export default function ProjectsLauncher() {
  const navigate = useNavigate();
  const { projects, setProjectId, addProject, refreshProjects, updateProjectStatus, removeProject } = useProject();

  const handleLoadDemoData = async () => {
    const apiBase = import.meta.env?.VITE_API_URL ?? '';
    try {
      const r = await fetch(`${apiBase}/api/demo/seed`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const data = r.ok ? await r.json().catch(() => ({})) : {};
      if (!r.ok) console.warn('[Demo] Server seed failed:', data?.error || r.status, data?.detail || '');
    } catch (e) {
      console.warn('[Demo] Server seed request failed:', e?.message);
    }
    seedDemo();
    refreshProjects();
    window.location.reload();
  };
  const handleResetDemoData = () => {
    resetDemo();
    refreshProjects();
    window.location.reload();
  };
  const [pill, setPill] = useState("menu");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [showCurrentList, setShowCurrentList] = useState(false);
  const [deleteProjectId, setDeleteProjectId] = useState(null);
  const [projectPickerFor, setProjectPickerFor] = useState(null);
  const [notesProject, setNotesProject] = useState(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const activeProjects = useMemo(() => getActiveProjects(), [projects]);
  const archiveProjects = useMemo(() => getArchiveProjects(), [projects]);

  const handleAddCreated = (data) => {
    const created = addProject(data);
    refreshProjects();
    setProjectId(created.id);
    navigate(`/p/${created.id}/executive`, { replace: true });
  };

  const handleOpenProject = (id) => {
    setProjectId(id);
    navigate(`/p/${id}/executive`);
  };

  const handleActiveProjects = () => {
    if (activeProjects.length === 0) setAddModalOpen(true);
    else if (activeProjects.length === 1) handleOpenProject(activeProjects[0].id);
    else setShowCurrentList(true);
  };

  const handleQuickActionSelectProject = (projectId, action) => {
    setProjectPickerFor(null);
    const p = getProjectById(projectId);
    if (action === "expense") {
      setProjectId(projectId);
      navigate(`/p/${projectId}/expenses`, { state: { openAddExpense: true } });
    } else if (action === "operator") {
      setProjectId(projectId);
      navigate(`/p/${projectId}/operators`, { state: { openAddOperator: true } });
    } else if (action === "notes") {
      setNotesProject({ id: projectId, name: (p && p.name) || "Project" });
    }
  };

  return (
    <div className="min-h-screen grid-bg content-glow">
      <div className="px-6 lg:px-10 pt-24 pb-10 animate-fade-in max-w-[1400px] mx-auto w-full">
        {pill === "menu" && !showCurrentList ? (
          <>
            {/* Hero — main page title + subtitle; title is home link */}
            <div className="max-w-2xl mb-14">
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-[1.1]">
                <Link to="/projects" className="text-heading-glow hover:opacity-90 transition-opacity" style={{ textDecoration: "none" }}>MemeHouse</Link>
              </h1>
              <p className="text-sm text-muted-foreground mt-2">Production Command Center</p>
            </div>

            {/* Section label + 3 Dashboard Panels */}
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-4">Overview</p>
            <div className="grid lg:grid-cols-3 gap-8 mb-10">
              <CardLightTrack className="glass-panel p-6 card-hover-subtle rounded-2xl">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-sm font-semibold text-foreground">Overview</h2>
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-primary" />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Active Projects</span>
                    <span className="text-sm font-bold text-foreground">{activeProjects.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Archived</span>
                    <span className="text-sm font-bold text-foreground">{archiveProjects.length}</span>
                  </div>
                </div>
              </CardLightTrack>

              <CardLightTrack className="glass-panel p-6 card-hover-subtle rounded-2xl">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-sm font-semibold text-foreground">Active Projects</h2>
                  <div className="w-8 h-8 rounded-lg bg-glow-cyan/10 flex items-center justify-center">
                    <FolderOpen className="w-4 h-4 text-glow-cyan" />
                  </div>
                </div>
                <div className="space-y-3">
                  {activeProjects.length > 0 ? (
                    activeProjects.slice(0, 3).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleOpenProject(p.id)}
                        className="group w-full flex items-center justify-between py-2 border-b border-[hsla(210,20%,93%,0.04)] last:border-0 cursor-pointer hover:bg-white/[0.03] transition-all duration-150 rounded-lg -mx-1 px-1 text-left"
                      >
                        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                          <span className="text-xs font-medium text-foreground truncate">{p.name}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {p.eventStartISO || p.startDate} – {p.eventEndISO || p.endDate || "—"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <StatusPill status={p.status || "active"} />
                          <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="py-1">
                      <p className="text-xs font-semibold text-foreground mb-1">No active projects</p>
                      <p className="text-[11px] text-muted-foreground mb-3">Create a project to begin managing production operations.</p>
                      <button
                        type="button"
                        onClick={() => setAddModalOpen(true)}
                        className="btn-primary-glow min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Create Project
                      </button>
                    </div>
                  )}
                </div>
              </CardLightTrack>

              <CardLightTrack className="glass-panel p-6 card-hover-subtle rounded-2xl">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-sm font-semibold text-foreground">Quick actions</h2>
                  <div className="w-8 h-8 rounded-lg bg-glow-violet/10 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-glow-violet" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => activeProjects.length === 0 ? setAddModalOpen(true) : setProjectPickerFor("expense")}
                    className="w-full flex items-center gap-3 py-2.5 px-3 rounded-xl text-left text-xs font-medium text-foreground hover:bg-white/[0.06] transition-colors border border-transparent hover:border-white/[0.06]"
                  >
                    <span className="w-8 h-8 rounded-lg bg-glow-green/10 flex items-center justify-center flex-shrink-0">
                      <Receipt className="w-4 h-4 text-glow-green" />
                    </span>
                    Add Expense
                  </button>
                  <button
                    type="button"
                    onClick={() => activeProjects.length === 0 ? setAddModalOpen(true) : setProjectPickerFor("operator")}
                    className="w-full flex items-center gap-3 py-2.5 px-3 rounded-xl text-left text-xs font-medium text-foreground hover:bg-white/[0.06] transition-colors border border-transparent hover:border-white/[0.06]"
                  >
                    <span className="w-8 h-8 rounded-lg bg-glow-cyan/10 flex items-center justify-center flex-shrink-0">
                      <UserPlus className="w-4 h-4 text-glow-cyan" />
                    </span>
                    Add Operator
                  </button>
                  <button
                    type="button"
                    onClick={() => activeProjects.length === 0 ? setAddModalOpen(true) : setProjectPickerFor("notes")}
                    className="w-full flex items-center gap-3 py-2.5 px-3 rounded-xl text-left text-xs font-medium text-foreground hover:bg-white/[0.06] transition-colors border border-transparent hover:border-white/[0.06]"
                  >
                    <span className="w-8 h-8 rounded-lg bg-glow-violet/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-glow-violet" />
                    </span>
                    Production Notes
                  </button>
                </div>
                {activeProjects.length === 0 && (
                  <p className="text-[10px] text-muted-foreground mt-3">Create a project to use quick actions.</p>
                )}
              </CardLightTrack>
            </div>

            {/* Quick action cards — Lovable grid + internal layout */}
            <div className="grid md:grid-cols-3 gap-6">
              <GlassCard
                glowColor="amber"
                hoverable
                onClick={() => setAddModalOpen(true)}
                className="flex flex-col gap-5 min-h-[220px]"
              >
                <div className="w-11 h-11 rounded-xl bg-glow-amber/[0.08] border border-glow-amber/15 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-glow-amber" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold mb-1.5">Add Project</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Launch a new production with budget, crew, and timeline setup.
                  </p>
                </div>
                <span className="text-xs font-semibold text-glow-amber flex items-center gap-1">
                  Get Started <ArrowRight className="w-3 h-3" />
                </span>
              </GlassCard>

              <GlassCard
                glowColor="cyan"
                hoverable
                onClick={handleActiveProjects}
                className="flex flex-col gap-5 min-h-[220px]"
              >
                <div className="w-11 h-11 rounded-xl bg-glow-cyan/[0.08] border border-glow-cyan/15 flex items-center justify-center">
                  <FolderOpen className="w-5 h-5 text-glow-cyan" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold mb-1.5">Current Projects</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    View and manage active productions, crews, and budgets.
                  </p>
                </div>
                <span className="text-xs font-semibold text-glow-cyan flex items-center gap-1">
                  {activeProjects.length === 0
                    ? "Create one"
                    : activeProjects.length === 1
                      ? "Open project"
                      : "View list"}{" "}
                  <ArrowRight className="w-3 h-3" />
                </span>
              </GlassCard>

              <GlassCard
                glowColor="gray"
                hoverable
                onClick={() => setPill("archive")}
                className="flex flex-col gap-5 min-h-[220px]"
              >
                <div className="w-11 h-11 rounded-xl bg-glow-gray/[0.08] border border-glow-gray/15 flex items-center justify-center">
                  <Archive className="w-5 h-5 text-glow-gray" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold mb-1.5">Archived Projects</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Access completed and archived productions for reference.
                  </p>
                </div>
                <span className="text-xs font-semibold text-glow-gray flex items-center gap-1">
                  Browse Archive <ArrowRight className="w-3 h-3" />
                </span>
              </GlassCard>
            </div>
          </>
        ) : pill === "archive" ? (
          <div className="w-full max-w-[1400px] mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold tracking-tight text-heading-glow">Archive</h1>
              <button
                type="button"
                onClick={() => setPill("menu")}
                className="text-xs font-semibold text-primary hover:underline"
              >
                ← Back to menu
              </button>
            </div>
            <GlassCard className="overflow-hidden !p-0">
              <PastProjectsPanel
                projects={archiveProjects}
                onOpenProject={handleOpenProject}
                onArchivePermanently={(id) => updateProjectStatus(id, "archived")}
                onDeletePermanently={(id) => setDeleteProjectId(id)}
              />
            </GlassCard>
          </div>
        ) : showCurrentList ? (
          <div className="w-full max-w-[1400px] mx-auto">
            <div className="glass-panel p-6 rounded-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold tracking-tight text-heading-glow">Active projects</h2>
                <button
                  type="button"
                  onClick={() => setShowCurrentList(false)}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  ← Back to menu
                </button>
              </div>
              <ul className="space-y-2">
                {activeProjects.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="w-full text-left flex items-center justify-between gap-4 py-3 px-4 rounded-xl glass-subtle hover:bg-[hsla(228,11%,14%,0.5)] transition-colors"
                      onClick={() => {
                        handleOpenProject(p.id);
                        setShowCurrentList(false);
                      }}
                    >
                      <span className="font-medium text-foreground">{p.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {p.eventStartISO || p.startDate} – {p.eventEndISO || p.endDate || "—"}
                      </span>
                      <StatusPill status={p.status || "active"} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </div>

      {addModalOpen && (
        <AddProjectModal
          onClose={() => setAddModalOpen(false)}
          onCreated={handleAddCreated}
        />
      )}

      {projectPickerFor && (
        <GlassModal
          open={true}
          onOpenChange={(open) => { if (!open) setProjectPickerFor(null); }}
          title="Which production is this for?"
          description="Select a project to continue."
          className="max-w-[400px]"
        >
          <ul className="space-y-1 max-h-[280px] overflow-y-auto">
            {activeProjects.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => handleQuickActionSelectProject(p.id, projectPickerFor)}
                  className="w-full text-left flex items-center justify-between gap-2 py-3 px-4 rounded-xl text-sm font-medium text-foreground hover:bg-white/[0.06] transition-colors border border-transparent hover:border-white/[0.06]"
                >
                  <span className="truncate">{p.name || p.id}</span>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">
                    {p.eventStartISO || p.startDate} – {p.eventEndISO || p.endDate || "—"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="pt-3 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={() => setProjectPickerFor(null)}
              className="w-full py-2.5 rounded-xl text-sm font-semibold border border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
          </div>
        </GlassModal>
      )}

      {notesProject && (
        <ProductionNotesModal
          projectId={notesProject.id}
          projectName={notesProject.name}
          onClose={() => setNotesProject(null)}
        />
      )}

      {deleteProjectId && (
        <GlassModal
          open={true}
          onOpenChange={(open) => { if (!open) setDeleteProjectId(null); }}
          title="Delete this project permanently?"
          description="This will permanently remove the project and its associated portal data. This action cannot be undone."
          className="max-w-[400px]"
        >
          <div className="flex gap-3 justify-end pt-4">
            <button
              type="button"
              onClick={() => setDeleteProjectId(null)}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                const id = deleteProjectId;
                setDeleteProjectId(null);
                removeAllExpensesForProject(id);
                removeProject(id);
                refreshProjects();
                navigate("/projects", { replace: true });
              }}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-destructive/50 text-destructive-foreground bg-destructive hover:bg-destructive/90 transition-colors"
            >
              Delete permanently
            </button>
          </div>
        </GlassModal>
      )}
    </div>
  );
}
