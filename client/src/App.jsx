import { useState, useEffect, useCallback, useMemo, memo, Component } from "react";
import { useParams, useNavigate, useLocation, Navigate, Routes, Route } from "react-router-dom";
import { LayoutDashboard, Columns3, Users, FileCheck, Clock, FolderOpen, LayoutGrid, FileText, Database, Plus, Search, LogIn, LogOut, Receipt } from "lucide-react";
import { useIsMobile } from "./hooks/useIsMobile";
import { getDaysUntil } from "./config/event";
import { getSprintLabel, formatDateShort } from "./utils/dates";
import { useProject, getStoredProjectId } from "./state/projectStore";
import { isCustomProject } from "./data/projectStorage";
import { getExpenses, addExpense, removeExpense, getExpensesTotal } from "./data/expenseStorage";
import { getKanbanColumns, getCommittedStages } from "./projects";
import ProjectStatusBadge from "./components/ProjectStatusBadge";
import Layout from "./components/Layout";
import ProjectsLauncher from "./pages/ProjectsLauncher";
import AppShell from "./components/AppShell";
import { LovableSidebar } from "./components/LovableSidebar";
import { LovableMobileNav } from "./components/LovableMobileNav";
import PageHeader from "./components/PageHeader";
import PageShell from "./components/PageShell";
import HudCard from "./components/HudCard";
import StatCard from "./components/StatCard";
import HudBadge from "./components/HudBadge";
import HudTable from "./components/HudTable";
import { GlassCard } from "./components/GlassCard";
import { StatusPill } from "./components/StatusPill";
import { GlassModal } from "./components/GlassModal";
import { GlassInput } from "./components/GlassInput";
import { GlassSelect } from "./components/GlassSelect";
import EditProjectModal from "./components/EditProjectModal";

// ─── ERROR BOUNDARY ────────────────────────────────────────────────────────────
class ErrorBoundary extends Component {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(err) { return { hasError: true, error: err }; }
  componentDidCatch(err, info) {
    console.error('[OpsTable] Render error:', err?.message || err, info?.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{padding:24,background:"#1a0000",border:"1px solid #ef4444",borderRadius:8}}>
          <div style={{fontSize:12,fontWeight:800,color:"#ef4444",marginBottom:8}}>Something went wrong</div>
          <div style={{fontSize:10,color:"#fca5a5",marginBottom:12}}>{this.state.error?.message || 'Unknown error'}</div>
          <button onClick={()=>this.setState({hasError:false,error:null})} style={{padding:"8px 16px",background:"#ef4444",border:"none",borderRadius:4,color:"#fff",fontSize:10,cursor:"pointer",fontWeight:700}}>Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── API LAYER ────────────────────────────────────────────────────────────────
const API = import.meta.env?.VITE_API_URL ?? '';

async function apiFetch(path, opts = {}) {
  try {
    const url = `${API}${path}`;
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const txt = await res.text();
    if (!res.ok) {
      let msg = `API ${path} failed: ${res.status}`;
      try { const j = JSON.parse(txt); if (j?.error) msg = j.error; } catch { if (txt) msg += ' ' + txt.slice(0,100); }
      console.error(`[API] ${path} failed:`, msg);
      const e = new Error(msg);
      e.status = res.status;
      e.body = txt;
      throw e;
    }
    return txt ? JSON.parse(txt) : {};
  } catch (err) {
    if (err?.status) throw err;
    console.error(`[API] ${path} fetch error:`, err?.message || err);
    throw err;
  }
}

const api = {
  getOperators:  (projectId, opts = {}) => {
    const params = new URLSearchParams();
    if (projectId != null && projectId !== '') params.set('project_id', projectId);
    if (opts.includeArchived === true) params.set('includeArchived', 'true');
    return apiFetch('/api/operators' + (params.toString() ? '?' + params.toString() : ''));
  },
  addOperator:   (data)  => apiFetch('/api/operators', { method: 'POST', body: data }),
  assignOperatorToProject: (projectId, data) => apiFetch(`/api/projects/${encodeURIComponent(projectId)}/operators`, { method: 'POST', body: data }),
  updateOperator:(id, d) => apiFetch(`/api/operators/${id}`, { method: 'PATCH', body: d }),
  addOperatorRatingHistory: (id, body) => apiFetch(`/api/operators/${id}/rating-history`, { method: 'POST', body }),
  updateProjectOperator: (projectId, projectOperatorId, d) => apiFetch(`/api/projects/${encodeURIComponent(projectId)}/operators/${projectOperatorId}`, { method: 'PATCH', body: d }),
  deleteOperator:(id)    => apiFetch(`/api/operators/${id}`, { method: 'DELETE' }),
  removeOperatorFromProject: (projectId, projectOperatorId) => apiFetch(`/api/projects/${encodeURIComponent(projectId)}/operators/${projectOperatorId}`, { method: 'DELETE' }),
  getLibraryOperators:   () => apiFetch('/api/operators'),
  getShifts:     (params) => apiFetch('/api/shifts' + (params && Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : '')),
  addShift:      (data)  => apiFetch('/api/shifts', { method: 'POST', body: data }),
  updateShift:   (id, d) => apiFetch(`/api/shifts/${id}`, { method: 'PATCH', body: d }),
  deleteShift:   (id)    => apiFetch(`/api/shifts/${id}`, { method: 'DELETE' }),
  getStats:      (projectId) => apiFetch('/api/stats' + (projectId != null && projectId !== '' ? '?project_id=' + encodeURIComponent(projectId) : '')),
  getEvent:      ()      => apiFetch('/api/events'),
  updateEvent:   (data)  => apiFetch('/api/events', { method: 'PATCH', body: data }),
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const ZONES = ["House 1","House 2","House 3","House 4","House 5","House 6","House 7","House 8","Festival","Floater"];
const RESTRICTED_ZONES = ["Festival"];
const FESTIVAL_CRED_TYPES = ["Artist","Vendor","Festival Grounds"];

const TIERS = {
  "T1": { label:"Tier 1 — Lead",    rate:"$550–$600", color:"#22c55e" },
  "T2": { label:"Tier 2 — Mid",     rate:"$450–$549", color:"#3b82f6" },
  "T3": { label:"Tier 3 — Support", rate:"$400–$449", color:"#f59e0b" },
  "T4": { label:"Tier 4 — Floater", rate:"$400 flat",  color:"#a855f7" },
};
const STAR_RATING_LABELS = { 5: "Elite", 4: "Reliable", 3: "Observe", 2: "Risk", 1: "Critical" };
function isRiskByStars(op) { return (op?.reliability ?? 5) <= 3; }
const HIRE_STAGES = ["Outreach","Responded","Screened","Interviewing","Offered","LOA Signed","Confirmed"];

/**
 * Single source of truth: committed labor = SUM(rate × days) for operators in committedStages.
 * @param {Array} operators
 * @param {Object} [event]
 * @param {string[]} [committedStages] - stage ids that count (default ["Confirmed"])
 * @returns {number}
 */
function calculateCommittedLabor(operators, event, committedStages = ["Confirmed"]) {
  if (!Array.isArray(operators)) return 0;
  const set = new Set(committedStages);
  return operators
    .filter(o => set.has(o.stage || o.hire_stage))
    .reduce((sum, o) => {
      const rate = Number(o.rate ?? o.day_rate) || 0;
      const rawDays = o.planned_days ?? o.plannedDays ?? 0;
      const days = (typeof rawDays === "number" && rawDays > 0) ? rawDays : 1;
      return sum + rate * days;
    }, 0);
}
const CRED_STATES  = ["Not Started","Info Collected","Submitted","Approved","Denied","Backup Assigned"];
const CRED_TYPES   = ["None","House-Only","Guest","Vendor","Artist","Festival Grounds"];
const AVAILABILITY_STATUSES = ["Available", "Partial", "Unavailable"];
const AVAILABILITY_BADGE = { Available: { label: "Available", color: "#22c55e" }, Partial: { label: "Partial", color: "#f59e0b" }, Unavailable: { label: "Unavailable", color: "#ef4444" } };
const EXPENSE_CATEGORIES = ["Meals", "Transportation", "Rentals", "Reimbursements", "Gear Purchases", "Misc Production"];
const GEAR_TAGS = ["TVU","LiveU","IRL Backpack","Sony FX6/FX3","PTZ","Comms/Party Line","Multi-cam Switching"];

const CRED_COLORS = {
  "Not Started":"#475569","Info Collected":"#0ea5e9","Submitted":"#f59e0b",
  "Approved":"#22c55e","Denied":"#ef4444","Backup Assigned":"#a855f7"
};
const STAGE_COLORS = {
  "Outreach":"#334155","Responded":"#0ea5e9","Screened":"#6366f1",
  "Interviewing":"#f59e0b","Offered":"#fb923c","LOA Signed":"#22d3ee",
  "Confirmed":"#22c55e","Passed":"#64748b"
};
const RISK_COLORS = { HIGH:"#ef4444", MED:"#f59e0b", LOW:"#22c55e" };
const CRED_TYPE_COLORS = {
  "None":"#475569","House-Only":"#6366f1","Guest":"#0ea5e9",
  "Vendor":"#f59e0b","Artist":"#f43f5e","Festival Grounds":"#22c55e"
};

// ─── LAYOUT (app shell, responsive) ───────────────────────────────────────────
const NAV_HEIGHT = 52;
const ROLE_BAR_HEIGHT = 34;
const APP_HEADER_TOTAL = NAV_HEIGHT + ROLE_BAR_HEIGHT;
const BREAKPOINT_TABLET = 1024;
const GUTTER_DESKTOP = 24;
const GUTTER_TABLET = 18;
const GUTTER_MOBILE = 12;

// ─── AUTO-RISK LOGIC ──────────────────────────────────────────────────────────

function computeAutoRisk(op) {
  if (op.cred === "Denied") return "HIGH";
  if (!op.workedWithMemeHouse && !op.refs && op.reliability <= 2) return "HIGH";
  if (op.rateInstability) return "HIGH";
  if (op.lateToScreen) return "HIGH";
  if (op.reliability <= 2) return "MED";
  if (!op.workedWithMemeHouse && !op.reel) return "MED";
  if (op.cred === "Submitted" && RESTRICTED_ZONES.includes(op.zone)) return "MED";
  return "LOW";
}

function canAssignToZone(op, zone) {
  if (!RESTRICTED_ZONES.includes(zone)) return { ok: true };
  if (op.cred !== "Approved") return { ok: false, reason: "Credential not approved" };
  if (!FESTIVAL_CRED_TYPES.includes(op.credType)) return { ok: false, reason: `${op.credType} badge doesn't allow festival access` };
  return { ok: true };
}

function isBroadcastQualified(op) {
  const broadcastGear = ["TVU","LiveU","Sony FX6/FX3","Multi-cam Switching"];
  const gear = Array.isArray(op?.gear) ? op.gear : [];
  return broadcastGear.some(g => gear.includes(g));
}

// ─── SEED DATA ────────────────────────────────────────────────────────────────

function genOps() {
  const firstNames = ["Jordan","Alex","Casey","Morgan","Taylor","Riley","Avery","Quinn","Sam","Drew","Blake","Cameron","Jamie","Reese","Skyler","Devon","Peyton","Sage","Emery","Hayden","Parker","Finley","Kendall","Logan","Rowan","Shay","River","Ari","Elliot","Harlow"];
  const lastNames  = ["Chen","Reyes","Kim","Patel","Okafor","Silva","Nakamura","Torres","Williams","Johnson","Martinez","Brown","Davis","Garcia","Wilson","Lee","Harris","Thompson","White","Jackson","Martin","Anderson","Taylor","Thomas","Moore","Lewis","Hill","Walker","Young","Scott"];
  const sources    = ["IATSE Local 600","ProductionHub","Facebook Group","Referral","LinkedIn","Instagram","StaffMeUp","Film School"];
  const credTypePool = ["None","House-Only","Guest","Vendor","Festival Grounds","Artist"];
  const ops = [];

  for (let i = 0; i < 62; i++) {
    const tier     = i < 14 ? "T1" : i < 32 ? "T2" : i < 50 ? "T3" : "T4";
    const stageIdx = Math.min(Math.floor(Math.random() * 8), 7);
    const credIdx  = Math.floor(Math.random() * 6);
    const zone     = ZONES[i % ZONES.length];
    const rate     = tier==="T1" ? 550+Math.floor(Math.random()*51)
                   : tier==="T2" ? 450+Math.floor(Math.random()*100)
                   : tier==="T3" ? 400+Math.floor(Math.random()*50) : 400;
    const reliability        = 1 + Math.floor(Math.random() * 5);
    const workedWithMemeHouse = Math.random() > 0.55;
    const lateToScreen       = Math.random() > 0.85;
    const rateInstability    = Math.random() > 0.88;
    const gearCount          = 1 + Math.floor(Math.random() * 5);
    const gear               = [...GEAR_TAGS].sort(()=>Math.random()-0.5).slice(0, gearCount);
    const credType           = stageIdx >= 5 ? credTypePool[Math.floor(Math.random()*credTypePool.length)] : "None";

    const base = {
      id: `OP-${String(i+1).padStart(3,"0")}`,
      name: `${firstNames[i%firstNames.length]} ${lastNames[i%lastNames.length]}`,
      tier, zone,
      stage: HIRE_STAGES[stageIdx],
      cred: CRED_STATES[credIdx],
      credType,
      rate, source: sources[i%sources.length],
      isBuffer: i >= 50,
      phone: `(${600+Math.floor(Math.random()*400)}) ${String(Math.floor(Math.random()*900)+100)}-${String(Math.floor(Math.random()*9000)+1000)}`,
      reel: stageIdx > 0, refs: stageIdx > 3,
      loa: stageIdx >= 6, w9: stageIdx >= 6,
      notes: "",
      reliability,
      workedWithMemeHouse,
      lateToScreen,
      rateInstability,
      gear,
      perfScore: stageIdx === 7 ? 1+Math.floor(Math.random()*5) : null,
      rehireEligible: stageIdx === 7 ? Math.random()>0.3 : null,
      postNotes: "",
    };
    base.risk = computeAutoRisk(base);
    ops.push(base);
  }
  return ops;
}

const INITIAL_OPS = genOps();

// ─── UI PRIMITIVES ────────────────────────────────────────────────────────────

const Tag = ({ label, color, small }) => <HudBadge label={label} color={color} small={small} />;

const Stars = ({value, onChange, disabled}) => (
  <div style={{display:"flex", gap:2}}>
    {[1,2,3,4,5].map(n => (
      <span key={n} onClick={()=>!disabled && onChange && onChange(n)}
        style={{fontSize:13, cursor:disabled?"default":"pointer", color: n<=(value||0) ? "#f59e0b":"#334155", transition:"color 0.1s"}}>★</span>
    ))}
  </div>
);

const GearChip = ({ label, active, onClick }) => (
  <span
    onClick={onClick}
    className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-semibold cursor-pointer whitespace-nowrap transition-all duration-200 ${active ? "glass text-primary border border-primary/20" : "glass-subtle text-muted-foreground border border-transparent hover:text-foreground"}`}
  >
    {label}
  </span>
);

// Executive-only: map metrics to health state (healthy / warning / critical). Card surface unchanged; bar + value + optional label only.
const EXEC_HEALTH_COLORS = { healthy: "#22c55e", warning: "#f59e0b", critical: "#ef4444" };
const EXEC_HEALTH_LABELS = { healthy: "Healthy", warning: "Watch", critical: "Critical" };
function getExecutiveHealth(metric, ctx) {
  const { budgetCap, actual, committed, remaining, otSpend, remainingDays } = ctx;
  const cap = Number(budgetCap) || 1;
  const pctUsed = cap > 0 ? (Math.max(actual, committed) / cap) * 100 : 0;
  const pctRemaining = cap > 0 ? (remaining / cap) * 100 : 100;
  const otPct = actual > 0 ? ((otSpend / actual) * 100) : 0;
  const runwayDays = remainingDays != null ? remainingDays : Infinity;

  switch (metric) {
    case "actual":
      if (pctUsed < 70) return { state: "healthy", color: EXEC_HEALTH_COLORS.healthy, label: EXEC_HEALTH_LABELS.healthy };
      if (pctUsed < 90) return { state: "warning", color: EXEC_HEALTH_COLORS.warning, label: EXEC_HEALTH_LABELS.warning };
      return { state: "critical", color: EXEC_HEALTH_COLORS.critical, label: EXEC_HEALTH_LABELS.critical };
    case "committed":
      if (pctUsed < 70) return { state: "healthy", color: EXEC_HEALTH_COLORS.healthy, label: EXEC_HEALTH_LABELS.healthy };
      if (pctUsed < 90) return { state: "warning", color: EXEC_HEALTH_COLORS.warning, label: EXEC_HEALTH_LABELS.warning };
      return { state: "critical", color: EXEC_HEALTH_COLORS.critical, label: EXEC_HEALTH_LABELS.critical };
    case "remaining":
      if (pctRemaining > 30) return { state: "healthy", color: EXEC_HEALTH_COLORS.healthy, label: EXEC_HEALTH_LABELS.healthy };
      if (pctRemaining > 10) return { state: "warning", color: EXEC_HEALTH_COLORS.warning, label: EXEC_HEALTH_LABELS.warning };
      return { state: "critical", color: EXEC_HEALTH_COLORS.critical, label: EXEC_HEALTH_LABELS.critical };
    case "otSpend":
      if (otPct < 5) return { state: "healthy", color: EXEC_HEALTH_COLORS.healthy, label: EXEC_HEALTH_LABELS.healthy };
      if (otPct < 15) return { state: "warning", color: EXEC_HEALTH_COLORS.warning, label: EXEC_HEALTH_LABELS.warning };
      return { state: "critical", color: EXEC_HEALTH_COLORS.critical, label: EXEC_HEALTH_LABELS.critical };
    case "dailyBurn":
      if (runwayDays > 14) return { state: "healthy", color: EXEC_HEALTH_COLORS.healthy, label: EXEC_HEALTH_LABELS.healthy };
      if (runwayDays > 7) return { state: "warning", color: EXEC_HEALTH_COLORS.warning, label: EXEC_HEALTH_LABELS.warning };
      if (runwayDays < Infinity && runwayDays <= 7) return { state: "critical", color: EXEC_HEALTH_COLORS.critical, label: EXEC_HEALTH_LABELS.critical };
      return null;
    case "runway":
      if (runwayDays > 14) return { state: "healthy", color: EXEC_HEALTH_COLORS.healthy, label: EXEC_HEALTH_LABELS.healthy };
      if (runwayDays > 7) return { state: "warning", color: EXEC_HEALTH_COLORS.warning, label: EXEC_HEALTH_LABELS.warning };
      if (runwayDays < Infinity && runwayDays <= 7) return { state: "critical", color: EXEC_HEALTH_COLORS.critical, label: EXEC_HEALTH_LABELS.critical };
      return null;
    default:
      return null;
  }
}

// ─── EXECUTIVE (budget cap from active project; stats for actual/committed/remaining; expenses reduce remaining) ─
function ExecutiveView({ stats, event, statsError, onRetry, isMobile, ops, committedStages, budgetCapFromProject, eventStartISO, eventEndISO, expenses = [], laborWithinProjectWindow = 0, credentialsRequired = true }) {
  if (stats === null && !statsError) {
    return (
      <div className="min-h-full grid-bg content-glow">
        <div className="px-6 lg:px-10 py-10 max-w-[1400px] mx-auto animate-fade-in">
          <div className="glass-panel rounded-2xl p-10 text-center">
            <p className="text-sm text-muted-foreground font-medium animate-pulse">Loading executive data…</p>
          </div>
        </div>
      </div>
    );
  }
  if (statsError && stats === null) {
    return (
      <div className="min-h-full grid-bg content-glow flex flex-col">
        <div className="px-6 lg:px-10 py-10 max-w-[1400px] mx-auto w-full flex flex-col items-center justify-center gap-4 text-center animate-fade-in">
          <div className="glass-panel rounded-2xl p-8 border border-destructive/30 bg-destructive/5">
            <p className="text-sm text-destructive font-medium mb-4">Failed to load: {statsError}</p>
            <button type="button" onClick={onRetry} className="min-h-[44px] px-4 py-2 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background">
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }
  const fmt$ = n => (n == null || Number.isNaN(n)) ? '$0' : '$' + Math.round(n).toLocaleString();
  // Use selected project's budget cap when available; otherwise stats from API; never hardcode 80000
  const budgetCap = (budgetCapFromProject != null && budgetCapFromProject !== '')
    ? Number(budgetCapFromProject)
    : (stats?.budget_cap ?? stats?.budgetCap ?? stats?.budget ?? 0);
  const actualLabor = stats?.actual_labor ?? stats?.actualLabor ?? 0;
  const actualExpensesTotal = (Array.isArray(expenses) ? expenses : []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const actual = actualLabor; // Actual Labor = all labor tied to project (unchanged)
  const committed = ops != null ? calculateCommittedLabor(ops, event, committedStages) : (stats?.committed_labor ?? 0);
  const forecast = stats?.forecast_labor ?? 0;
  // Remaining = budgetCap − (max(actualLabor, committed) + actualExpensesTotal)
  const totalSpend = Math.max(actualLabor, committed) + actualExpensesTotal;
  const remaining = Math.max(0, budgetCap - totalSpend);
  const otSpend = stats?.otSpend ?? 0;
  const c = stats?.counts ?? {};
  const totalOps = c.total_operators ?? stats?.total ?? 0;
  const confirmedCount = c.confirmed ?? stats?.confirmed ?? 0;
  const credentialedCount = c.credentialed ?? stats?.credApproved ?? 0;
  const credDeniedCount = c.cred_denied ?? stats?.credDenied ?? 0;
  const highRiskCount = c.high_risk ?? stats?.highRisk ?? 0;

  // Project window: [eventStart, min(today, eventEnd)] for burn and runway only
  const eventStart = eventStartISO ?? event?.start_date ?? event?.eventStart ?? null;
  const eventEnd = eventEndISO ?? event?.end_date ?? event?.eventEnd ?? null;
  const todayStr = new Date().toISOString().slice(0, 10);
  const windowEndStr = !eventEnd || eventEnd > todayStr ? todayStr : eventEnd.slice(0, 10);
  const startStr = eventStart ? eventStart.slice(0, 10) : null;

  // Expenses within project window (for Daily Burn only)
  const expensesWithinProjectWindow = useMemo(() => {
    if (!startStr) return 0;
    return (Array.isArray(expenses) ? expenses : []).reduce((sum, e) => {
      const d = (e.date || "").slice(0, 10);
      if (!d || d < startStr || d > windowEndStr) return sum;
      return sum + (Number(e.amount) || 0);
    }, 0);
  }, [expenses, startStr, windowEndStr]);

  // Elapsed production days (inclusive): day 1 = start date, day 2 = next day, etc. Before start = 0.
  const elapsedProductionDays = startStr && windowEndStr && windowEndStr >= startStr
    ? Math.floor((new Date(windowEndStr) - new Date(startStr)) / 86400000) + 1
    : 0;

  // Daily Burn = (laborWithinProjectWindow + expensesWithinProjectWindow) / elapsedProductionDays; Runway = remaining / dailyBurn (formulas unchanged)
  const spendInWindow = laborWithinProjectWindow + expensesWithinProjectWindow;
  const burnRate = elapsedProductionDays > 0 && spendInWindow > 0 ? spendInWindow / elapsedProductionDays : 0;
  const remainingDays = burnRate > 0 ? remaining / burnRate : null;

  // Display states for Daily Burn and Runway (no formula changes)
  const isPreProduction = !startStr || todayStr < startStr;
  const hasNoSpendYet = elapsedProductionDays > 0 && spendInWindow <= 0;
  const dailyBurnLabel = isPreProduction ? "Pre-production" : hasNoSpendYet ? "No spend yet" : (burnRate <= 0 ? "—" : `${fmt$(burnRate)} / day`);
  const dailyBurnHelper = isPreProduction ? (startStr ? `Starts ${formatDateShort(startStr)}` : "Before project start") : "Spend in project window ÷ elapsed production days";
  const runwayLabel = isPreProduction ? "Pre-production" : hasNoSpendYet ? "—" : (burnRate <= 0 ? "—" : (remainingDays != null ? `${Math.round(remainingDays)} days remaining` : "—"));

  const healthCtx = { budgetCap, actual, committed, remaining, otSpend, remainingDays };
  const healthActual = getExecutiveHealth("actual", healthCtx);
  const healthCommitted = getExecutiveHealth("committed", healthCtx);
  const healthRemaining = getExecutiveHealth("remaining", healthCtx);
  const healthOt = getExecutiveHealth("otSpend", healthCtx);
  const healthBurn = getExecutiveHealth("dailyBurn", healthCtx);
  const healthRunway = getExecutiveHealth("runway", healthCtx);

  return (
    <div className="min-h-full grid-bg content-glow">
      <div className="px-6 lg:px-10 py-10 max-w-[1400px] mx-auto flex flex-col gap-6 w-full animate-fade-in">
        {statsError && (
          <HudCard className="border-destructive/30 bg-destructive/5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-destructive font-medium">Could not refresh. Showing last values.</span>
              <button type="button" onClick={onRetry} className="px-3 py-1.5 rounded-lg bg-destructive/20 text-destructive text-xs font-semibold border border-destructive/40 hover:bg-destructive/30 transition-colors">
                Retry
              </button>
            </div>
          </HudCard>
        )}
        <HudCard header="// EXECUTIVE OVERVIEW">
          <p className="text-xs text-muted-foreground leading-relaxed">Budget updates based on committed ops + logged shifts</p>
        </HudCard>
        {/* Metrics grid — Lovable layout; order optimized for finance scanning */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Budget Cap" value={fmt$(budgetCap)} helper="Total labor budget" accentColor="#6366f1" bars={4} />
          <StatCard label="Remaining Balance" value={fmt$(remaining)} helper="Budget − (labor + expenses)" accentColor={healthRemaining?.color ?? "#22c55e"} statusLabel={healthRemaining?.label} bars={3} />
          <StatCard label="Actual Expenses" value={fmt$(actualExpensesTotal)} helper="Non-labor production expenses" accentColor="#0ea5e9" bars={2} />
          <StatCard label="Daily Burn" value={dailyBurnLabel} helper={dailyBurnHelper} accentColor={healthBurn?.color ?? "#0ea5e9"} statusLabel={healthBurn?.label} bars={3} />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Runway" value={runwayLabel} helper="Remaining ÷ burn rate" accentColor={healthRunway?.color ?? "#06b6d4"} statusLabel={healthRunway?.label} bars={3} />
          <StatCard label="Actual Labor" value={fmt$(actual)} helper="From logged shifts" accentColor={healthActual?.color ?? "#22c55e"} statusLabel={healthActual?.label} bars={3} />
          <StatCard
            label="Committed Labor"
            value={fmt$(committed)}
            helper={typeof forecast === "number" ? `Confirmed ops only. Forecast: ${fmt$(forecast)}` : "Confirmed ops only (sum of day_rate)"}
            accentColor={healthCommitted?.color ?? "#f59e0b"}
            statusLabel={healthCommitted?.label}
            bars={5}
          />
          <StatCard label="OT Spend" value={fmt$(otSpend)} helper="Overtime" accentColor={healthOt?.color ?? "#a855f7"} statusLabel={healthOt?.label} bars={2} />
        </div>
        <HudCard header="// PIPELINE SUMMARY" noPadding>
          <div className={isMobile ? "p-4" : "p-6"}>
            <div className="flex flex-wrap gap-3 items-center">
              <HudBadge label={`${totalOps} total`} color="#22c55e" small />
              <HudBadge label={`${confirmedCount} confirmed`} color="#22c55e" small />
              <HudBadge label={`${credentialedCount} credentialed`} color="#0ea5e9" small />
              {credentialsRequired ? (
                <HudBadge label={`${credDeniedCount} cred denied`} color="#ef4444" small />
              ) : (
                <HudBadge label={`${credDeniedCount} cred denied (optional)`} color="#64748b" small />
              )}
              <HudBadge label={`${highRiskCount} high-risk`} color="#ef4444" small />
            </div>
            {(event?.event_name || event?.start_date) && (
              <p className="mt-4 text-[11px] text-muted-foreground">
                Event: {event.event_name || "—"} · {event.start_date || "—"} – {event.end_date || "—"}
              </p>
            )}
          </div>
        </HudCard>
      </div>
    </div>
  );
}

// ─── LOG SHIFT MODAL ─────────────────────────────────────────────────────────
function LogShiftModal({ zones = [], ops = [], onClose, onSaved, projectId }) {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
  const [form, setForm] = useState({
    operator_id: '', zone: '', date: today,
    clock_in: `${today}T08:00`, clock_out: `${today}T17:00`, break_minutes: 0,
  });
  const [err, setErr] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (form.operator_id && ops.length) {
      const op = ops.find(o => String(o.id) === String(form.operator_id));
      if (op?.zone) setForm(f => ({ ...f, zone: op.zone }));
    }
  }, [form.operator_id, ops]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.operator_id) { setErr('Select an operator'); return; }
    if (!form.clock_in || !form.clock_out) { setErr('Clock in and clock out required'); return; }
    const ci = new Date(form.clock_in).getTime();
    const co = new Date(form.clock_out).getTime();
    if (co <= ci) { setErr('Clock out must be after clock in'); return; }
    setErr(null); setSaving(true);
    try {
      await api.addShift({
        operator_id: Number(form.operator_id),
        zone: form.zone || undefined,
        date: form.date,
        clock_in: new Date(form.clock_in).toISOString(),
        clock_out: new Date(form.clock_out).toISOString(),
        break_minutes: Number(form.break_minutes) || 0,
        project_id: projectId ?? undefined,
        projectId: projectId ?? undefined,
      });
      await onSaved();
    } catch (e) {
      setErr(e?.message || 'Failed to log shift');
    } finally {
      setSaving(false);
    }
  };

  return (
    <GlassModal open={true} onOpenChange={(open) => { if (!open) onClose(); }} title="Log Shift" description="Record a completed shift for an operator.">
      {err && <div className="text-sm text-destructive mb-3">{err}</div>}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
        <GlassSelect label="Operator *" value={form.operator_id} onChange={e=>setForm(f=>({...f,operator_id:e.target.value,zone:''}))} required>
          <option value="">— Select —</option>
          {(ops||[]).map(o=><option key={o.id} value={o.id}>{o.name || o.full_name} ({o.opId||o.id})</option>)}
        </GlassSelect>
        <GlassSelect label="Zone" value={form.zone} onChange={e=>setForm(f=>({...f,zone:e.target.value}))} disabled={!zones.length}>
          <option value="">{zones.length ? "—" : "No zones yet — add in Settings"}</option>
          {zones.map(z=><option key={z} value={z}>{z}</option>)}
        </GlassSelect>
        <GlassInput label="Date" type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} />
        <div className="grid grid-cols-2 gap-4">
          <GlassInput label="Clock In" type="datetime-local" value={form.clock_in} onChange={e=>setForm(f=>({...f,clock_in:e.target.value}))} required />
          <GlassInput label="Clock Out" type="datetime-local" value={form.clock_out} onChange={e=>setForm(f=>({...f,clock_out:e.target.value}))} required />
        </div>
        <div className="flex flex-col gap-2">
          <GlassInput label="Break (minutes)" type="number" value={form.break_minutes} onChange={e=>setForm(f=>({...f,break_minutes:e.target.value}))} min={0} max={120} />
          <div className="flex gap-2 text-[11px]">
            <span className="text-muted-foreground/70 mr-1">Quick presets:</span>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, break_minutes: 30 }))}
              className="px-2 py-1 rounded-lg border border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground transition-colors"
            >
              30 min
            </button>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, break_minutes: 60 }))}
              className="px-2 py-1 rounded-lg border border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground transition-colors"
            >
              60 min
            </button>
          </div>
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 transition-colors">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary-glow flex-1 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">{saving ? "Saving…" : "Log Shift"}</button>
        </div>
      </form>
    </GlassModal>
  );
}

// ─── SHIFTS (Clock In/Out V1) ─────────────────────────────────────────────────
function Elapsed({ start }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  if (!start) return '—';
  const s = Math.floor((now - new Date(start).getTime()) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}

function OTBadge({ start, breakM }) {
  const s = Math.max(0, (Date.now() - new Date(start).getTime()) / 1000 - (breakM || 0) * 60);
  const hrs = s / 3600;
  if (hrs >= 8) return <span style={{fontSize:9,color:"#ef4444",fontWeight:700,background:"#ef444422",padding:"2px 6px",borderRadius:4}}>In OT</span>;
  if (hrs >= 7.5) return <span style={{fontSize:9,color:"#f59e0b",fontWeight:700,background:"#f59e0b22",padding:"2px 6px",borderRadius:4}}>Approaching OT</span>;
  return null;
}

/** Safe label for shift operator (handles deleted operator → null operator_id / operator_name). */
function getShiftOperatorLabel(s) {
  if (s.operator_name && String(s.operator_name).trim()) return s.operator_name;
  if (s.operator_id != null && s.operator_id !== "") return `Op #${s.operator_id}`;
  return "Deleted Operator";
}

function ShiftsView({ zones = [], ops = [], onShiftMutated, isMobile, projectId }) {
  const [activeShifts, setActiveShifts] = useState([]);
  const [todayShifts, setTodayShifts] = useState([]);
  const [allShifts, setAllShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [showClockIn, setShowClockIn] = useState(false);
  const [showLogShift, setShowLogShift] = useState(false);
  const [todayFilter, setTodayFilter] = useState('All');
  const [clockInForm, setClockInForm] = useState({ operator_id: '', zone: '' });
  const [clockInErr, setClockInErr] = useState(null);
  const [clockingOut, setClockingOut] = useState(null);
  const [lunchLoadingId, setLunchLoadingId] = useState(null);

  const load = useCallback(async () => {
    setErr(null);
    const baseParams = projectId != null && projectId !== '' ? { project_id: projectId } : {};
    try {
      const [active, today, all] = await Promise.all([
        api.getShifts({ ...baseParams, status: 'active' }),
        api.getShifts({ ...baseParams, date: 'today' }),
        api.getShifts(baseParams),
      ]);
      setActiveShifts(Array.isArray(active) ? active : []);
      setTodayShifts(Array.isArray(today) ? today : []);
      setAllShifts(Array.isArray(all) ? all.filter(s => s.end_time) : []); // closed shifts only for pay table
    } catch (e) {
      setErr(e?.message || 'Failed to load shifts');
      setActiveShifts([]);
      setTodayShifts([]);
      setAllShifts([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(load, 45000); return () => clearInterval(t); }, [load]);

  const handleClockIn = async (e) => {
    e.preventDefault();
    if (!clockInForm.operator_id) { setClockInErr('Select an operator'); return; }
    setClockInErr(null);
    try {
      await api.addShift({
        operator_id: Number(clockInForm.operator_id),
        zone: clockInForm.zone || undefined,
        project_id: projectId ?? undefined,
        projectId: projectId ?? undefined,
      });
      setShowClockIn(false);
      setClockInForm({ operator_id: '', zone: '' });
      await load();
      onShiftMutated?.();
    } catch (e) {
      setClockInErr(e?.message || 'Failed to clock in');
    }
  };

  const handleClockOut = async (id) => {
    setClockingOut(id);
    try {
      await api.updateShift(id, { end_time: new Date().toISOString() });
      await load();
      onShiftMutated?.();
    } catch (e) { setErr(e?.message || 'Failed to clock out'); }
    finally { setClockingOut(null); }
  };

  const handleStartLunch = async (shift) => {
    if (!shift || shift.end_time) return;
    setLunchLoadingId(shift.id);
    try {
      await api.updateShift(shift.id, { on_break: true, break_started_at: new Date().toISOString() });
      await load();
      onShiftMutated?.();
    } catch (e) {
      setErr(e?.message || 'Failed to start lunch break');
    } finally {
      setLunchLoadingId(null);
    }
  };

  const handleEndLunch = async (shift) => {
    if (!shift || !shift.on_break || !shift.break_started_at) return;
    setLunchLoadingId(shift.id);
    try {
      const now = new Date();
      const started = new Date(shift.break_started_at);
      const deltaMinutes = Math.max(0, Math.round((now - started) / 60000));
      const existing = Number(shift.break_minutes) || 0;
      await api.updateShift(shift.id, {
        on_break: false,
        break_started_at: null,
        break_ended_at: now.toISOString(),
        break_minutes: existing + deltaMinutes,
      });
      await load();
      onShiftMutated?.();
    } catch (e) {
      setErr(e?.message || 'Failed to end lunch break');
    } finally {
      setLunchLoadingId(null);
    }
  };

  const filteredToday = todayFilter === 'Active' ? todayShifts.filter(s => !s.end_time)
    : todayFilter === 'Closed' ? todayShifts.filter(s => s.end_time)
    : todayShifts;

  const fmtTime = t => t ? new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '—';

  const pageWrapper = "min-h-full grid-bg content-glow";
  const pageInner = "px-6 lg:px-10 py-10 max-w-[1400px] mx-auto flex flex-col gap-6 animate-fade-in w-full";

  if (loading) return (
    <div className={pageWrapper}>
      <div className={pageInner}>
        <div className="glass-panel rounded-2xl p-10 text-center text-sm text-muted-foreground">Loading shifts...</div>
      </div>
    </div>
  );
  if (err) return (
    <div className={pageWrapper}>
      <div className={pageInner}>
        <div className="glass-panel rounded-2xl p-8 border border-destructive/30 bg-destructive/5 text-center">
          <p className="text-sm text-destructive font-medium mb-4">{err}</p>
          <button type="button" onClick={load} className="px-4 py-2 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold hover:opacity-90 transition-opacity">Retry</button>
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div className={pageWrapper}>
        <div className={pageInner}>
          <PageHeader label="SHIFTS" title="Time & Attendance" subtitle="Clock in/out and log completed shifts" actions={
          <div style={{display:'flex',gap:8,width:'100%'}}>
            <button type="button" onClick={()=>setShowLogShift(true)} className="hud-btn hud-btn-primary" style={{flex:1}}>LOG SHIFT</button>
            <button type="button" onClick={()=>{setShowClockIn(true);setClockInErr(null);}} className="hud-btn" style={{flex:1,background:'rgba(34,197,94,0.2)',borderColor:'rgba(34,197,94,0.5)',color:'#86efac'}}>Clock In</button>
          </div>
        } />
        <HudCard header="// ACTIVE — ON THE CLOCK">
          {activeShifts.length === 0 ? <div style={{padding:20,textAlign:'center',color:'var(--hud-muted)',fontSize:11}}>No one clocked in.</div> : activeShifts.map(s=>{
            const status = s.end_time ? "Completed" : s.on_break ? "On Lunch Break" : "On Shift";
            const isOnLunch = !!s.on_break;
            return (
              <div key={s.id} className="hud-card" style={{padding:12,marginBottom:8}}>
                <div style={{fontSize:12,fontWeight:700,color:'var(--hud-text)'}}>{getShiftOperatorLabel(s)}</div>
                <div style={{fontSize:10,color:'#94a3b8',marginTop:4}}>
                  {s.zone || '—'} · In at {fmtTime(s.start_time)} · <span style={{fontWeight:700,color:isOnLunch?'#fbbf24':'#22c55e'}}>{status}</span>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:8,gap:8}}>
                  <span style={{fontSize:10,color:'#22c55e',fontWeight:700}}><Elapsed start={s.start_time}/></span>
                  <div style={{display:'flex',gap:6}}>
                    {isOnLunch ? (
                      <button
                        onClick={()=>handleEndLunch(s)}
                        disabled={lunchLoadingId===s.id}
                        style={{padding:'6px 10px',background:'#fbbf24',border:'none',borderRadius:4,color:'#111827',fontSize:10,cursor:'pointer',fontWeight:700}}
                      >
                        {lunchLoadingId===s.id?'...':'End Lunch'}
                      </button>
                    ) : (
                      <button
                        onClick={()=>handleStartLunch(s)}
                        disabled={lunchLoadingId===s.id || !!s.end_time}
                        style={{padding:'6px 10px',background:'rgba(251,191,36,0.15)',border:'1px solid rgba(251,191,36,0.6)',borderRadius:4,color:'#fbbf24',fontSize:10,cursor:'pointer',fontWeight:700}}
                      >
                        {lunchLoadingId===s.id?'...':'Start Lunch'}
                      </button>
                    )}
                    <button onClick={()=>handleClockOut(s.id)} disabled={clockingOut===s.id} style={{padding:'6px 12px',background:'#ef4444',border:'none',borderRadius:4,color:'#fff',fontSize:10,cursor:'pointer',fontWeight:700}}>
                      {clockingOut===s.id?'...':'Clock Out'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </HudCard>
        <HudCard header="// LOGGED SHIFTS">
          {allShifts.length === 0 ? <div style={{padding:20,textAlign:'center',color:'#64748b',fontSize:10}}>No logged shifts yet.</div> : allShifts.slice(0, 20).map(s=>(
            <div key={s.id} style={{borderBottom:'1px solid #1e293b',padding:'10px 0'}}>
              <div style={{fontSize:11,fontWeight:700,color:'var(--hud-text)'}}>{getShiftOperatorLabel(s)}</div>
              <div style={{fontSize:10,color:'#94a3b8'}}>{s.date ? new Date(s.date).toLocaleDateString() : '—'} · {s.zone || '—'}</div>
              <div style={{fontSize:10,color:'#22c55e',fontWeight:700,marginTop:2}}>{s.total_pay != null ? '$'+Number(s.total_pay).toFixed(0) : '—'}</div>
            </div>
          ))}
          {allShifts.length > 20 && <div style={{fontSize:10,color:'var(--hud-muted)',marginTop:8}}>+{allShifts.length - 20} more</div>}
        </HudCard>
        <HudCard header="// TODAY">
          <div className="flex justify-between items-center mb-3">
            <GlassSelect label="" value={todayFilter} onChange={e=>setTodayFilter(e.target.value)} className="!gap-0 min-w-[100px] py-2">
              <option value="All">All</option><option value="Active">Active</option><option value="Closed">Closed</option>
            </GlassSelect>
          </div>
          {filteredToday.length === 0 ? <div style={{padding:20,textAlign:'center',color:'#64748b',fontSize:10}}>No shifts today</div> : filteredToday.map(s=>{
            const status = s.end_time ? "Completed" : s.on_break ? "On Lunch Break" : "On Shift";
            return (
              <div key={s.id} style={{borderBottom:'1px solid #1e293b',padding:'8px 0'}}>
                <div style={{fontSize:11,color:'var(--hud-text)'}}>{getShiftOperatorLabel(s)}</div>
                <div style={{fontSize:10,color:'#94a3b8'}}>
                  {fmtTime(s.start_time)} – {fmtTime(s.end_time) || 'Active'} · <span style={{fontWeight:700,color:s.on_break?'#fbbf24':s.end_time?'#64748b':'#22c55e'}}>{status}</span>
                </div>
              </div>
            );
          })}
        </HudCard>
        {showLogShift && <LogShiftModal zones={zones} ops={ops||[]} projectId={projectId} onClose={()=>setShowLogShift(false)} onSaved={async ()=>{await load();onShiftMutated?.();setShowLogShift(false);}}/>}
        <GlassModal open={showClockIn} onOpenChange={(open) => { if (!open) setShowClockIn(false); }} title="Clock In" description="Start a shift for an operator.">
          {clockInErr && <div className="text-sm text-destructive mb-3">{clockInErr}</div>}
          <form onSubmit={handleClockIn} className="flex flex-col gap-4 pt-1">
            <GlassSelect label="Operator *" value={clockInForm.operator_id} onChange={e=>setClockInForm(f=>({...f,operator_id:e.target.value}))} required>
              <option value="">— Select —</option>
              {(ops||[]).map(o=><option key={o.id} value={o.id}>{o.name || o.full_name} ({o.opId||o.id})</option>)}
            </GlassSelect>
            <GlassSelect label="Zone (optional)" value={clockInForm.zone} onChange={e=>setClockInForm(f=>({...f,zone:e.target.value}))} disabled={!zones.length}>
              <option value="">{zones.length ? "—" : "No zones yet"}</option>
              {zones.map(z=><option key={z} value={z}>{z}</option>)}
            </GlassSelect>
            <div className="flex gap-3 justify-end pt-2">
              <button type="button" onClick={()=>setShowClockIn(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 transition-colors">Cancel</button>
              <button type="submit" className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-glow-green text-primary-foreground hover:opacity-90 transition-opacity">Clock In</button>
            </div>
          </form>
        </GlassModal>
        </div>
      </div>
    );
  }

  const shiftsActions = (
    <div className="flex gap-2 flex-wrap">
      <button type="button" onClick={() => setShowLogShift(true)} className="text-xs rounded-xl px-3 py-2 font-semibold border border-[hsla(210,20%,93%,0.06)] glass-subtle text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5">
        <FileText className="w-3.5 h-3.5" /> Log Shift
      </button>
      <button type="button" onClick={() => { setShowClockIn(true); setClockInErr(null); }} className="text-xs rounded-xl px-3 py-2 font-semibold border border-glow-green/20 glass-subtle text-glow-green hover:bg-glow-green/10 transition-colors inline-flex items-center gap-1.5">
        <LogIn className="w-3.5 h-3.5" /> Clock In
      </button>
      <button type="button" className="text-xs rounded-xl px-3 py-2 font-semibold border border-glow-red/20 glass-subtle text-glow-red hover:bg-glow-red/10 transition-colors inline-flex items-center gap-1.5">
        <LogOut className="w-3.5 h-3.5" /> Clock Out
      </button>
    </div>
  );

  return (
    <div className={pageWrapper}>
      <div className={pageInner}>
        <PageHeader label="SHIFTS" title="Shifts & Attendance" subtitle="Clock in/out and log completed shifts" actions={shiftsActions} />

        {/* Active on-clock */}
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-glow-green" /> Currently On-Clock
            {activeShifts.filter((s) => s.on_break).length > 0 && (
              <span className="text-amber-400 font-normal normal-case">({activeShifts.filter((s) => s.on_break).length} on lunch)</span>
            )}
          </h2>
          {activeShifts.length === 0 ? (
            <div className="glass-panel rounded-2xl p-8 text-center text-sm text-muted-foreground">No one is currently clocked in.</div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeShifts.map(s => {
                const status = s.end_time ? "Completed" : s.on_break ? "On Lunch Break" : "On Shift";
                const isOnLunch = !!s.on_break;
                return (
                  <GlassCard key={s.id} glowColor="green" className="flex flex-col gap-2.5">
                    <span className="font-semibold text-sm">{getShiftOperatorLabel(s)}</span>
                    <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span>In: {fmtTime(s.start_time)}</span>
                        <span className="opacity-25">·</span>
                        <span>{s.zone || "—"}</span>
                      </div>
                      <span className={isOnLunch ? "text-amber-400 font-semibold" : "text-glow-green font-semibold"}>{status}</span>
                    </div>
                    {(isOnLunch && s.break_started_at) || (Number(s.break_minutes) || 0) > 0 ? (
                      <div className="text-[10px] text-amber-400/90">
                        {isOnLunch && s.break_started_at ? `Lunch started: ${fmtTime(s.break_started_at)}` : `Lunch: ${Number(s.break_minutes)} min total`}
                      </div>
                    ) : null}
                    <span className="text-xl font-bold text-glow-green"><Elapsed start={s.start_time} /></span>
                    <div className="mt-1 flex gap-2">
                      {!s.end_time && (
                        isOnLunch ? (
                          <button
                            type="button"
                            onClick={() => handleEndLunch(s)}
                            disabled={lunchLoadingId === s.id}
                            className="flex-1 py-2 rounded-xl text-xs font-semibold bg-amber-400 text-slate-900 hover:bg-amber-300 disabled:opacity-50 transition-colors"
                          >
                            {lunchLoadingId === s.id ? "..." : "End Lunch"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStartLunch(s)}
                            disabled={lunchLoadingId === s.id}
                            className="flex-1 py-2 rounded-xl text-xs font-semibold border border-amber-400/60 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20 disabled:opacity-50 transition-colors"
                          >
                            {lunchLoadingId === s.id ? "..." : "Start Lunch"}
                          </button>
                        )
                      )}
                      <button
                        type="button"
                        onClick={() => handleClockOut(s.id)}
                        disabled={clockingOut === s.id}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold bg-destructive/20 text-destructive border border-destructive/30 hover:bg-destructive/30 transition-colors disabled:opacity-50"
                      >
                        {clockingOut === s.id ? "..." : "Clock Out"}
                      </button>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          )}
        </div>

        {/* Today's shifts table */}
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">Today&apos;s Shifts</h2>
          <GlassCard className="overflow-hidden !p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[hsla(210,20%,93%,0.05)]">
                    {["Operator","Zone","Clock-in","Elapsed",""].map(h => (
                      <th key={h} className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-widest px-5 py-3.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeShifts.length === 0 ? (
                    <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-muted-foreground">No one on clock</td></tr>
                  ) : activeShifts.map(s => {
                    const status = s.end_time ? "Completed" : s.on_break ? "On Lunch Break" : "On Shift";
                    const isOnLunch = !!s.on_break;
                    return (
                      <tr key={s.id} className="border-b border-[hsla(210,20%,93%,0.03)] row-hover-glow">
                        <td className="px-5 py-4 font-medium">
                          <div className="flex items-center justify-between gap-2">
                            <span>{getShiftOperatorLabel(s)}</span>
                            <span className={isOnLunch ? "text-amber-400 text-[11px] font-semibold" : "text-glow-green text-[11px] font-semibold"}>{status}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-muted-foreground">{s.zone || "—"}</td>
                        <td className="px-5 py-4 text-muted-foreground font-mono text-[10px]">{fmtTime(s.start_time)}</td>
                        <td className="px-5 py-4 text-glow-green font-semibold"><Elapsed start={s.start_time} /></td>
                        <td className="px-5 py-4 flex gap-1">
                          {!s.end_time && (
                            isOnLunch ? (
                              <button
                                type="button"
                                onClick={() => handleEndLunch(s)}
                                disabled={lunchLoadingId === s.id}
                                className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-amber-400 text-slate-900 hover:bg-amber-300 disabled:opacity-50"
                              >
                                {lunchLoadingId === s.id ? "..." : "End"}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleStartLunch(s)}
                                disabled={lunchLoadingId === s.id}
                                className="px-2 py-0.5 rounded-lg text-[10px] font-semibold border border-amber-400/60 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20 disabled:opacity-50"
                              >
                                {lunchLoadingId === s.id ? "..." : "Lunch"}
                              </button>
                            )
                          )}
                          <button
                            type="button"
                            onClick={() => handleClockOut(s.id)}
                            disabled={clockingOut === s.id}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-destructive/20 text-destructive border border-destructive/30 hover:bg-destructive/30 disabled:opacity-50"
                          >
                            {clockingOut === s.id ? "..." : "Out"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>

        {/* Logged Shifts — Pay Summary */}
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">Logged Shifts — Pay Summary</h2>
          <GlassCard className="overflow-hidden !p-0">
            {allShifts.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">No logged shifts yet. Use Log Shift to add completed shifts.</div>
            ) : (
              <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[hsla(210,20%,93%,0.05)]">
                    {["ID","Operator","Zone","Date","Worked","Lunch start","Lunch end","Lunch (min)","OT hrs","OT pay","Total"].map(h => (
                      <th key={h} className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-widest px-5 py-3.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allShifts.map(s => (
                    <tr key={s.id} className="border-b border-[hsla(210,20%,93%,0.03)] row-hover-glow">
                      <td className="px-5 py-4 text-[10px] text-muted-foreground font-mono">#{String(s.id).slice(-4)}</td>
                      <td className="px-5 py-4 text-muted-foreground">{getShiftOperatorLabel(s)}</td>
                      <td className="px-5 py-4 text-muted-foreground">{s.zone || "—"}</td>
                      <td className="px-5 py-4 font-mono text-[10px]">{s.date ? new Date(s.date).toLocaleDateString() : (s.start_time ? new Date(s.start_time).toLocaleDateString() : "—")}</td>
                      <td className="px-5 py-4">{s.worked_hours != null ? Number(s.worked_hours).toFixed(1) : "—"}</td>
                      <td className="px-5 py-4 font-mono text-[10px] text-muted-foreground">{s.break_started_at ? fmtTime(s.break_started_at) : "—"}</td>
                      <td className="px-5 py-4 font-mono text-[10px] text-muted-foreground">{s.break_ended_at ? fmtTime(s.break_ended_at) : "—"}</td>
                      <td className="px-5 py-4 text-muted-foreground">{(Number(s.break_minutes) || 0) > 0 ? `${s.break_minutes} min` : "—"}</td>
                      <td className="px-5 py-4 text-amber-400">{(s.overtime_hours || 0) > 0 ? Number(s.overtime_hours).toFixed(1) : "0"}</td>
                      <td className="px-5 py-4 text-glow-violet font-semibold">{s.overtime_pay != null ? "$" + Number(s.overtime_pay).toFixed(0) : "$0"}</td>
                      <td className="px-5 py-4 text-glow-green font-semibold">{s.total_pay != null ? "$" + Number(s.total_pay).toFixed(0) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </div>

        {/* Today's Shifts */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Today&apos;s Shifts</h2>
            <GlassSelect label="" value={todayFilter} onChange={e => setTodayFilter(e.target.value)} className="!gap-0 min-w-[100px] py-2">
              <option value="All">All</option>
              <option value="Active">Active</option>
              <option value="Closed">Closed</option>
            </GlassSelect>
          </div>
          <GlassCard className="overflow-hidden !p-0">
            {filteredToday.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">No shifts today</div>
            ) : (
              <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
                <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[hsla(210,20%,93%,0.05)]">
                    {["Operator","Zone","In","Out","Lunch",""].map(h => (
                      <th key={h} className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-widest px-5 py-3.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredToday.map(s => (
                    <tr key={s.id} className="border-b border-[hsla(210,20%,93%,0.03)] row-hover-glow">
                      <td className="px-5 py-4 font-medium">{getShiftOperatorLabel(s)}</td>
                      <td className="px-5 py-4 text-muted-foreground">{s.zone || "—"}</td>
                      <td className="px-5 py-4 text-muted-foreground font-mono text-[10px]">{fmtTime(s.start_time)}</td>
                      <td className="px-5 py-4 font-mono text-[10px]">{s.end_time ? fmtTime(s.end_time) : <span className="text-glow-green">Active</span>}</td>
                      <td className="px-5 py-4 text-[10px] text-muted-foreground">
                        {s.on_break && s.break_started_at ? `Started ${fmtTime(s.break_started_at)}` : (Number(s.break_minutes) || 0) > 0 ? `${s.break_minutes} min` : "—"}
                      </td>
                      <td className="px-5 py-4">{!s.end_time && <button type="button" onClick={() => handleClockOut(s.id)} disabled={clockingOut === s.id} className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-destructive/20 text-destructive border border-destructive/30 hover:bg-destructive/30 disabled:opacity-50">Out</button>}</td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </div>

        {showLogShift && <LogShiftModal zones={zones} ops={ops||[]} projectId={projectId} onClose={()=>setShowLogShift(false)} onSaved={async ()=>{await load();onShiftMutated?.();setShowLogShift(false);}}/>}

        <GlassModal open={showClockIn} onOpenChange={(open) => { if (!open) setShowClockIn(false); }} title="Clock In" description="Start a shift for an operator.">
          {clockInErr && <div className="text-sm text-destructive mb-3">{clockInErr}</div>}
          <form onSubmit={handleClockIn} className="flex flex-col gap-4 pt-1">
            <GlassSelect label="Operator *" value={clockInForm.operator_id} onChange={e=>setClockInForm(f=>({...f,operator_id:e.target.value}))} required>
              <option value="">— Select —</option>
              {(ops||[]).map(o=><option key={o.id} value={o.id}>{o.name || o.full_name} ({o.opId||o.id})</option>)}
            </GlassSelect>
            <GlassSelect label="Zone (optional)" value={clockInForm.zone} onChange={e=>setClockInForm(f=>({...f,zone:e.target.value}))} disabled={!zones.length}>
              <option value="">{zones.length ? "—" : "No zones yet"}</option>
              {zones.map(z=><option key={z} value={z}>{z}</option>)}
            </GlassSelect>
            <div className="flex gap-3 justify-end pt-2">
              <button type="button" onClick={()=>setShowClockIn(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 transition-colors">Cancel</button>
              <button type="submit" className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-glow-green text-primary-foreground hover:opacity-90 transition-colors">Clock In</button>
            </div>
          </form>
        </GlassModal>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

function Dashboard({ zones = [], ops, isMobile }) {
  const total        = ops.length;
  const confirmed    = ops.filter(o=>o.stage==="Confirmed").length;
  const credApproved = ops.filter(o=>o.cred==="Approved").length;
  const loaSigned    = ops.filter(o=>o.loa).length;
  const denied       = ops.filter(o=>o.cred==="Denied").length;
  const highRisk     = ops.filter(o=>o.risk==="HIGH").length;
  const medRisk      = ops.filter(o=>o.risk==="MED").length;
  const lowRisk      = ops.filter(o=>o.risk==="LOW").length;
  const atRiskStars  = ops.filter(isRiskByStars).length; // ≤3★ = risk
  const buffer       = ops.filter(o=>o.isBuffer).length;
  const broadcastQ   = ops.filter(isBroadcastQualified).length;
  const pct = v => total ? Math.round(v/total*100) : 0;

  const stageData       = HIRE_STAGES.map(s=>({stage:s, count:ops.filter(o=>o.stage===s).length}));
  const zoneData        = (zones.length ? zones : []).map(z=>({zone:z, confirmed:ops.filter(o=>o.zone===z&&o.stage==="Confirmed").length, total:ops.filter(o=>o.zone===z).length}));
  const tierData        = Object.entries(TIERS).map(([k,v])=>({key:k,...v, count:ops.filter(o=>o.tier===k).length}));
  const reliabilityDist = [5,4,3,2,1].map(r=>({ r, count:ops.filter(o=>o.reliability===r).length }));

  const pageWrap = "min-h-full grid-bg content-glow";
  const pageInner = "px-6 lg:px-10 py-10 max-w-[1400px] mx-auto flex flex-col gap-6 animate-fade-in w-full";
  const sectionTitle = "text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3";

  return (
    <div className={pageWrap}>
      <div className={pageInner}>
        <h1 className="text-2xl font-bold tracking-tight text-heading-glow">Pipeline Dashboard</h1>
        <p className="text-sm text-muted-foreground -mt-2 mb-1">Overview of pipeline, credentials, and zone staffing</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard label="Total Pipeline"   value={total}        sub={total ? `${total - buffer} primary + ${buffer} buffer` : 'No operators yet'} accent="#6366f1"/>
          <StatCard label="Confirmed"        value={confirmed}    sub={`${pct(confirmed)}% of pipeline`} accent="#22c55e"/>
          <StatCard label="Credentialed"     value={credApproved} sub="Festival access approved"         accent="#0ea5e9"/>
          <StatCard label="LOAs Signed"      value={loaSigned}    sub="Agreements locked"                accent="#f59e0b"/>
          <StatCard label="Cred Denied"      value={denied}       sub="Needs backup swap"                accent="#ef4444"/>
          <StatCard label="Broadcast Ready"  value={broadcastQ}   sub="TVU / LiveU / FX6 / Multi-cam"   accent="#22d3ee"/>
        </div>

        <GlassCard className="p-5">
          <div className={sectionTitle}>Reliability risk summary</div>
          <div className="flex flex-wrap gap-6 items-center">
            {[["HIGH",highRisk,"#ef4444"],["MED",medRisk,"#f59e0b"],["LOW",lowRisk,"#22c55e"]].map(([lvl,n,c])=>(
              <div key={lvl} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{background:c}}/>
                <span className="text-sm font-bold" style={{color:c}}>{n}</span>
                <span className="text-[10px] text-muted-foreground">{lvl}</span>
              </div>
            ))}
            <div className="h-5 w-px bg-white/[0.08]" />
            <div className="flex gap-2 items-center">
              <span className="text-[10px] text-muted-foreground">MH Alumni:</span>
              <span className="text-xs font-semibold text-glow-green">{ops.filter(o=>o.workedWithMemeHouse).length}</span>
            </div>
            <div className="flex gap-2 items-center">
              <span className="text-[10px] text-muted-foreground">Late-to-screen:</span>
              <span className="text-xs font-semibold text-amber-400">{ops.filter(o=>o.lateToScreen).length}</span>
            </div>
            <div className="flex gap-2 items-center">
              <span className="text-[10px] text-muted-foreground">Rate instability:</span>
              <span className="text-xs font-semibold text-amber-400">{ops.filter(o=>o.rateInstability).length}</span>
            </div>
            <div className="h-5 w-px bg-white/[0.08]" />
            <div className="flex gap-2 items-center">
              <span className="text-[10px] text-muted-foreground">At risk (≤3★):</span>
              <span className="text-xs font-semibold text-amber-400">{atRiskStars}</span>
            </div>
          </div>
        </GlassCard>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <GlassCard className="p-5">
            <div className={sectionTitle}>Hiring pipeline flow</div>
            <div className="space-y-3">
              {stageData.map(({stage,count})=>(
                <div key={stage}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-muted-foreground font-medium">{stage}</span>
                    <span className="text-xs font-bold" style={{color:STAGE_COLORS[stage]}}>{count}</span>
                  </div>
                  <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-[width] duration-300" style={{width:`${Math.max(pct(count),2)}%`,background:STAGE_COLORS[stage]}}/>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
          <GlassCard className="p-5">
            <div className={sectionTitle}>Credential status</div>
            <div className="space-y-3">
              {CRED_STATES.map(s=>{
                const c=ops.filter(o=>o.cred===s).length;
                return (
                  <div key={s}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-muted-foreground font-medium">{s}</span>
                      <span className="text-xs font-bold" style={{color:CRED_COLORS[s]}}>{c}</span>
                    </div>
                    <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{width:`${Math.max(pct(c),2)}%`,background:CRED_COLORS[s]}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <GlassCard className="p-5">
            <div className={sectionTitle}>Rate tier distribution</div>
            <div className="space-y-2">
              {tierData.map(({key,label,color,count})=>(
                <div key={key} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{background:color}}/>
                  <span className="text-[10px] text-muted-foreground font-medium flex-1">{label}</span>
                  <span className="text-xs font-bold" style={{color}}>{count}</span>
                </div>
              ))}
            </div>
          </GlassCard>
          <GlassCard className="p-5">
            <div className={sectionTitle}>Reliability scores</div>
            <div className="space-y-3">
              {reliabilityDist.map(({r,count})=>(
                <div key={r}>
                  <div className="flex justify-between mb-1">
                    <span className={`text-xs font-semibold ${r>=4?"text-glow-green":r===3?"text-amber-400":"text-destructive"}`}>{"★".repeat(r)}{"☆".repeat(5-r)}</span>
                    <span className="text-xs font-semibold text-muted-foreground">{count}</span>
                  </div>
                  <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{width:`${Math.max(pct(count),2)}%`,background:r>=4?"#22c55e":r===3?"#f59e0b":"#ef4444"}}/>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
          <GlassCard className="p-5">
            <div className={sectionTitle}>Zone staffing</div>
            <div className="space-y-2">
              {zoneData.map(({zone,confirmed:c,total:t})=>(
                <div key={zone}>
                  <div className="flex justify-between mb-0.5">
                    <span className="text-[10px] text-muted-foreground font-medium">{zone}</span>
                    <span className={`text-[10px] font-bold ${c>0?"text-glow-green":"text-destructive"}`}>{c}/{t}</span>
                  </div>
                  <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-[width]" style={{width:t>0?`${(c/t)*100}%`:"0%",background:c===t?"#22c55e":c>0?"#f59e0b":"#ef4444"}}/>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

// ─── KANBAN ───────────────────────────────────────────────────────────────────
// Valid drag: one stage forward or any step back (no jump e.g. Outreach → Confirmed).
function canMoveToStage(fromStage, toStage) {
  const i = HIRE_STAGES.indexOf(fromStage);
  const j = HIRE_STAGES.indexOf(toStage);
  if (i === -1 || j === -1) return true;
  if (j <= i) return true;
  return j === i + 1;
}

/* Lovable Kanban: column 270px, glass rounded-2xl border-t-2, header px-1 mb-1, card !p-4 gap-2.5 !rounded-xl */
const KANBAN_COLUMN_WIDTH = 270;
const KANBAN_STAGE_STYLE = {
  Outreach: { border: "border-t-glow-cyan/25", text: "text-glow-cyan" },
  Responded: { border: "border-t-glow-cyan/15", text: "text-glow-cyan" },
  Screened: { border: "border-t-glow-violet/25", text: "text-glow-violet" },
  Interviewing: { border: "border-t-glow-amber/25", text: "text-glow-amber" },
  Offered: { border: "border-t-glow-amber/15", text: "text-glow-amber" },
  "LOA Signed": { border: "border-t-glow-green/15", text: "text-glow-green" },
  Confirmed: { border: "border-t-glow-green/25", text: "text-glow-green" },
  Passed: { border: "border-t-glow-gray/20", text: "text-glow-gray" },
};
function getKanbanStageStyle(stageId) {
  return KANBAN_STAGE_STYLE[stageId] || { border: "border-t-glow-cyan/25", text: "text-glow-cyan" };
}

// Card composition from Lovable KanbanPage: name, meta row (tier · zone · dayRate), pills row; keep drag + quick confirm.
const KanbanCard = memo(function KanbanCard({ op, isDragging, onDragStart, onDragEnd, onMouseDown, onMouseLeave, draggable, onClick, onQuickConfirm }) {
  const tierColor = TIERS[op.tier]?.color || "#6366f1";
  const dayRate = op.day_rate ?? op.dayRate;
  const dayRateLabel = typeof dayRate === "number" ? `$${dayRate}` : (dayRate || "—");
  const showQuickConfirm = onQuickConfirm && (op?.stage ?? "") !== "Confirmed";
  const stageForPill = (op.stage || "").toLowerCase().replace(/\s+/g, "-");
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onMouseDown={e => { if (draggable) e.currentTarget.style.cursor = "grabbing"; onMouseDown?.(e); }}
      onMouseLeave={e => { if (draggable) e.currentTarget.style.cursor = "grab"; onMouseLeave?.(e); }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      className={[
        "glass rounded-xl p-4 flex flex-col gap-2.5 transition-all duration-200 cursor-default card-hover-subtle",
        isDragging && "shadow-[0_12px_40px_rgba(0,0,0,0.5)] ring-2 ring-primary/30 scale-[1.02]",
      ].filter(Boolean).join(" ")}
      style={{ cursor: draggable ? "grab" : onClick ? "pointer" : "default" }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold text-foreground truncate flex-1 min-w-0">{op.name}</span>
        {showQuickConfirm && (
          <button type="button" onClick={e => { e.stopPropagation(); onQuickConfirm(op); }} className="flex-shrink-0 px-2 py-0.5 rounded-lg text-[9px] font-bold border border-glow-green/50 bg-glow-green/15 text-glow-green hover:bg-glow-green/25 transition-colors whitespace-nowrap" title="Mark confirmed">Confirm</button>
        )}
      </div>
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
        <span>{op.reliability != null ? `${op.reliability}★` : "—"}</span>
        <span className="opacity-25">·</span>
        <span>{op.zone || "—"}</span>
        <span className="opacity-25">·</span>
        <span>{dayRateLabel}/day</span>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-0.5">
        {stageForPill && ["outreach", "responded", "screened", "interviewing", "offered", "loa-signed", "confirmed"].includes(stageForPill) ? (
          <StatusPill status={stageForPill} showIcon={false} className="!text-[10px] !px-2.5 !py-0.5" />
        ) : op.stage ? (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold glass-subtle text-muted-foreground">{op.stage}</span>
        ) : null}
        {isRiskByStars(op) && <Tag label="Risk" color="#f59e0b" small />}
        {op.workedWithMemeHouse && <span className="text-[10px] font-semibold text-glow-green">✓ Alumni</span>}
        {op.isBuffer && <span className="text-[10px] font-semibold text-glow-violet">BUF</span>}
      </div>
    </div>
  );
});

const KANBAN_DESKTOP_BREAKPOINT = 1024;

/** stages: array of { id, label } from project config, or default HIRE_STAGES */
function Kanban({ ops, onUpdate, stages: stagesProp }) {
  const stages = stagesProp?.length ? stagesProp : HIRE_STAGES.map((id) => ({ id, label: id }));
  const stageIds = stages.map((s) => s.id);
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);
  const [dropHighlight, setDropHighlight] = useState(null);
  const [mobileStage, setMobileStage] = useState(stageIds[0]);
  const [mobileCardMenu, setMobileCardMenu] = useState(null);
  const [pendingQuickConfirm, setPendingQuickConfirm] = useState(null);
  const isMobile = useIsMobile(KANBAN_DESKTOP_BREAKPOINT);
  const dragOp = ops.find((o) => o.id === drag);

  const handleQuickConfirm = useCallback((op) => {
    if ((op?.stage ?? "") === "Confirmed") return;
    setPendingQuickConfirm(op);
  }, []);
  const commitQuickConfirm = useCallback(() => {
    if (!pendingQuickConfirm) return;
    onUpdate(pendingQuickConfirm.id, { stage: "Confirmed" });
    setPendingQuickConfirm(null);
  }, [pendingQuickConfirm, onUpdate]);

  const stageOpsByStage = useMemo(() => {
    const map = {};
    stageIds.forEach((id) => { map[id] = []; });
    ops.forEach((op) => {
      if (stageIds.includes(op.stage)) map[op.stage].push(op);
    });
    return map;
  }, [ops, stageIds]);

  const stageCounts = useMemo(() => {
    const c = {};
    stageIds.forEach((id) => { c[id] = (stageOpsByStage[id] || []).length; });
    return c;
  }, [stageOpsByStage, stageIds]);

  const drop = useCallback((stage) => {
    if (!drag || !dragOp) { setDrag(null); setOver(null); setDropHighlight(null); return; }
    if (!canMoveToStage(dragOp.stage, stage)) { setDrag(null); setOver(null); setDropHighlight(null); return; }
    onUpdate(drag, { stage });
    setDropHighlight(stage);
    setTimeout(() => setDropHighlight(null), 400);
    setDrag(null);
    setOver(null);
  }, [drag, dragOp, onUpdate]);

  // Mobile: move stage from menu
  const moveToStage = useCallback((opId, stage) => {
    onUpdate(opId, { stage });
    setMobileCardMenu(null);
  }, [onUpdate]);

  if (isMobile) {
    const stageOps = stageOpsByStage[mobileStage] || [];
    const mobileStageLabel = stages.find((s) => s.id === mobileStage)?.label ?? mobileStage;
    return (
      <>
        {pendingQuickConfirm && (
          <QuickConfirmDialog op={pendingQuickConfirm} onConfirm={commitQuickConfirm} onCancel={() => setPendingQuickConfirm(null)} />
        )}
        <div className="kanban-mobile-shell h-full flex flex-col min-h-0 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.04] backdrop-blur-xl">
          <div className="flex-shrink-0 px-4 py-3 border-b border-white/[0.06]">
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1" style={{ WebkitOverflowScrolling: "touch" }}>
              {stages.map((stage) => {
                const isActive = mobileStage === stage.id;
                const stageColor = STAGE_COLORS[stage.id] || "#6366f1";
                return (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => setMobileStage(stage.id)}
                    className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${!isActive ? "text-muted-foreground" : ""}`}
                    style={{
                      background: isActive ? stageColor : "rgba(255,255,255,0.06)",
                      color: isActive ? "#fff" : undefined,
                      border: isActive ? "none" : "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    {stage.label} ({stageCounts[stage.id] ?? 0})
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            {stageOps.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-10 px-4 rounded-2xl bg-white/[0.03] border border-white/[0.04]">No operators in {mobileStageLabel}</div>
            ) : (
              <div className="flex flex-col gap-3">
                {stageOps.map((op) => (
                  <div key={op.id} className="relative">
                    <KanbanCard op={op} draggable={false} onClick={() => setMobileCardMenu(mobileCardMenu?.id === op.id ? null : { id: op.id, op })} onQuickConfirm={handleQuickConfirm} />
                    {mobileCardMenu?.id === op.id && (
                      <div className="absolute top-full left-0 right-0 mt-2 p-4 z-10 rounded-2xl border border-white/[0.08] bg-black/60 backdrop-blur-xl shadow-xl">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Move to stage</div>
                        <div className="flex flex-wrap gap-2">
                          {stages.filter((s) => s.id !== op.stage).map((s) => (
                            <button key={s.id} type="button" onClick={() => moveToStage(op.id, s.id)} className="px-3 py-2 rounded-xl text-xs font-medium border border-white/10 bg-white/5 text-foreground hover:bg-white/10 transition-colors">{s.label}</button>
                          ))}
                        </div>
                        {op.stage !== "Confirmed" && (
                          <button type="button" onClick={() => { setPendingQuickConfirm(op); setMobileCardMenu(null); }} className="mt-3 w-full py-2 rounded-xl text-xs font-bold border border-green-500/50 bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-colors">Confirm now</button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // Desktop: Lovable hiring pipeline — exact structure: gap-4, 270px columns, stage bar, compact cards
  const desktopBoard = (
    <div className="flex gap-4 overflow-x-auto pb-6">
      {stages.map((stage) => {
        const stageOps = stageOpsByStage[stage.id] || [];
        const isOver = over === stage.id;
        const canDrop = dragOp && canMoveToStage(dragOp.stage, stage.id);
        const isHighlight = dropHighlight === stage.id;
        const { border: borderClass, text: textClass } = getKanbanStageStyle(stage.id);
        return (
          <div
            key={stage.id}
            onDragOver={(e) => { e.preventDefault(); if (canDrop) setOver(stage.id); }}
            onDrop={() => drop(stage.id)}
            onDragLeave={() => setOver(null)}
            className="min-w-[270px] w-[270px] flex-shrink-0"
          >
            <div
              className={`glass rounded-2xl border-t-2 ${borderClass} p-3 flex flex-col gap-2.5 transition-all duration-200 min-h-[160px] ${
                isHighlight ? "ring-2 ring-glow-green/40 bg-glow-green/5" : isOver && canDrop ? "ring-2 ring-primary/30 bg-white/[0.06]" : ""
              }`}
            >
              <div className="flex items-center justify-between px-1 mb-1">
                <span className={`text-[11px] font-semibold uppercase tracking-widest ${textClass}`}>{stage.label}</span>
                <span className="text-[10px] text-muted-foreground glass-subtle px-2 py-0.5 rounded-full font-medium shrink-0">
                  {stageOps.length}
                </span>
              </div>
              <div className="flex flex-col gap-2.5 min-h-0">
                {stageOps.map((op) => (
                  <KanbanCard
                    key={op.id}
                    op={op}
                    isDragging={drag === op.id}
                    draggable={true}
                    onDragStart={() => setDrag(op.id)}
                    onDragEnd={() => { setDrag(null); setOver(null); }}
                    onQuickConfirm={handleQuickConfirm}
                  />
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      {pendingQuickConfirm && (
        <QuickConfirmDialog op={pendingQuickConfirm} onConfirm={commitQuickConfirm} onCancel={() => setPendingQuickConfirm(null)} />
      )}
      {desktopBoard}
    </>
  );
}

// ─── CREDENTIALS TRACKER ──────────────────────────────────────────────────────

function CredsTracker({ zones = [], ops = [], onUpdate, onAddOperator, onUpdateDefaultRate, onRatingHistory, onOperatorDeleted, isMobile, credentialsRequired = true }) {
  const [filter, setFilter] = useState("All");
  const [editingOp, setEditingOp] = useState(null);
  const filtered = filter==="All" ? ops : ops.filter(o=>o.cred===filter);
  const riskyOps = ops.filter(o=>o.risk==="HIGH" || isRiskByStars(o));

  const filterPills = (
    <div className="flex flex-wrap gap-2 items-center">
      {["All", ...CRED_STATES].map(s => (
        <button key={s} type="button" onClick={() => setFilter(s)} className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-300 border ${filter === s ? "glass text-primary border-primary/20 pill-glow-amber" : "glass-subtle text-muted-foreground border-transparent hover:text-foreground"}`}>
          {s} ({s === "All" ? ops.length : ops.filter(o => o.cred === s).length})
        </button>
      ))}
      {onAddOperator && <button type="button" onClick={onAddOperator} className="btn-primary-glow bg-primary text-primary-foreground hover:bg-primary/90 text-xs rounded-xl px-3 py-2 font-semibold inline-flex items-center gap-1.5 transition-colors ml-auto"><Plus className="w-3.5 h-3.5" /> Add Operator</button>}
    </div>
  );

  if (isMobile) {
    return (
      <div className="min-h-full grid-bg content-glow">
        <div className="px-6 lg:px-10 py-10 max-w-[1400px] mx-auto flex flex-col gap-6 animate-fade-in">
          <PageHeader label="CREDENTIALS" title="Credential Tracker" subtitle="Track status and badges by operator" actions={onAddOperator ? <button type="button" onClick={onAddOperator} className="btn-primary-glow min-h-[44px] bg-primary text-primary-foreground hover:bg-primary/90 text-xs rounded-xl px-3 py-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"><Plus className="w-3.5 h-3.5 inline mr-1" /> Add Operator</button> : null} />
        {credentialsRequired && riskyOps.length > 0 && (
          <HudCard className="border-destructive/30 bg-destructive/5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-destructive mb-2">⚠ High risk</div>
            {riskyOps.slice(0, 5).map(op => (
              <div key={op.id} className="flex gap-2 items-center text-[10px] text-destructive/90 mb-1.5 flex-wrap">
                <Tag label="HIGH" color="#ef4444" small />
                <span className="font-semibold">{op.name}</span>
                <span style={{ color: CRED_COLORS[op.cred] }}>{op.cred}</span>
              </div>
            ))}
            {riskyOps.length > 5 && <div className="text-[9px] text-muted-foreground">+{riskyOps.length - 5} more</div>}
          </HudCard>
        )}
        {filterPills}
        {filtered.length === 0 ? (
          <div className="glass-panel rounded-2xl p-10 text-center text-sm text-muted-foreground">No operators</div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(op => (
              <HudCard key={op.id} className={op.cred === "Denied" ? "bg-destructive/10 border-destructive/20" : op.risk === "HIGH" ? "bg-amber-500/5 border-amber-500/20" : ""}>
                <div className="flex justify-between items-start mb-2">
                  <div><div className="text-sm font-semibold text-foreground">{op.name}</div><div className="text-[10px] text-muted-foreground">{op.opId || op.id}</div></div>
                  <Tag label={op.cred} color={CRED_COLORS[op.cred]} small />
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  <Tag label={op.credType} color={CRED_TYPE_COLORS[op.credType]} small />
                  <Tag label={op.zone} color="#6366f1" small />
                  <span className="text-[10px] text-glow-green font-semibold">${op.rate ?? 0}</span>
                </div>
                <select value={op.cred} onChange={e => onUpdate(op.id, { cred: e.target.value })} className="w-full px-3 py-2 rounded-xl glass text-sm text-foreground mb-2 focus:outline-none focus:ring-1 focus:ring-primary/40" style={{ color: CRED_COLORS[op.cred], fontWeight: 700 }}>
                  {CRED_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button type="button" onClick={() => setEditingOp(op)} className="w-full py-2 rounded-xl text-xs font-semibold bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-colors">Edit</button>
              </HudCard>
            ))}
          </div>
        )}
        {editingOp && <EditOperatorModal zones={zones} op={editingOp} onSave={onUpdate} onClose={() => setEditingOp(null)} onUpdateDefaultRate={onUpdateDefaultRate} onRatingHistory={onRatingHistory} onDelete={onOperatorDeleted} />}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full grid-bg content-glow">
      <div className="px-6 lg:px-10 py-10 max-w-[1400px] mx-auto flex flex-col gap-6 animate-fade-in w-full">
        <PageHeader label="CREDENTIALS" title="Credential Tracker" subtitle="Track status and badges by operator" actions={onAddOperator ? <button type="button" onClick={onAddOperator} className="btn-primary-glow min-h-[44px] bg-primary text-primary-foreground hover:bg-primary/90 text-xs rounded-xl px-3 py-2 font-semibold inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background"><Plus className="w-3.5 h-3.5" /> Add Operator</button> : null} />
        {credentialsRequired && riskyOps.length > 0 && (
          <HudCard className="border-destructive/30 bg-destructive/5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-destructive mb-2">⚠ High risk flags — immediate action</div>
            {riskyOps.map(op => (
              <div key={op.id} className="flex gap-2 items-center text-[11px] text-destructive/90 mb-1.5 flex-wrap">
                <Tag label="HIGH" color="#ef4444" small />
                <span className="font-semibold">{op.name}</span>
                <span className="text-muted-foreground">{op.id}</span>
                <span className="opacity-50">·</span>
                <span style={{ color: CRED_COLORS[op.cred] }}>{op.cred}</span>
                <span className="opacity-50">·</span>
                <Tag label={op.credType} color={CRED_TYPE_COLORS[op.credType]} small />
                {op.lateToScreen && <Tag label="Late Screen" color="#f59e0b" small />}
                {op.rateInstability && <Tag label="Rate Instability" color="#f59e0b" small />}
                {!op.workedWithMemeHouse && !op.refs && <Tag label="New+No Refs" color="#f59e0b" small />}
              </div>
            ))}
          </HudCard>
        )}
        {filterPills}
        <GlassCard className="overflow-hidden !p-0">
          <div className="overflow-x-auto max-h-[440px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[hsla(210,20%,93%,0.05)]">
                  {["ID","Name","Stars","Zone","Cred Status","Cred Type","Rate","Risk",""].map(h => (
                    <th key={h} className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-widest px-5 py-3.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="px-5 py-10 text-center text-sm text-muted-foreground">No operators yet</td></tr>
                ) : filtered.map(op => (
                  <tr key={op.id} className="border-b border-[hsla(210,20%,93%,0.03)] row-hover-glow" style={{ background: (!credentialsRequired && op.cred === "Denied") ? undefined : op.cred === "Denied" ? "rgba(42,0,0,0.25)" : op.risk === "HIGH" ? "rgba(42,10,0,0.15)" : undefined }}>
                    <td className="px-5 py-4 text-[10px] text-muted-foreground font-mono">{op.opId || op.id}</td>
                    <td className="px-5 py-4">
                      <div className="font-medium">{op.name}</div>
                      <div className="text-[9px] text-muted-foreground">{op.workedWithMemeHouse ? "✓ MH Alumni" : op.source || ""}</div>
                    </td>
                    <td className="px-5 py-4"><div className="flex items-center gap-1.5 flex-wrap"><span className="text-sm font-medium">{op.reliability != null ? `${op.reliability}★` : "—"}</span>{isRiskByStars(op) && <Tag label="Risk" color="#f59e0b" small />}</div></td>
                    <td className="px-5 py-4 text-muted-foreground text-[10px]">{op.zone || "—"}</td>
                    <td className="px-5 py-4">
                      <select value={op.cred} onChange={e => onUpdate(op.id, { cred: e.target.value })} className="bg-transparent border-none text-[10px] font-semibold cursor-pointer px-1 py-0.5 rounded focus:outline-none focus:ring-1 focus:ring-primary/40" style={{ color: CRED_COLORS[op.cred] }}>
                        {CRED_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-5 py-4">
                      <select value={op.credType} onChange={e => onUpdate(op.id, { credType: e.target.value })} className="bg-transparent border-none text-[10px] font-semibold cursor-pointer px-1 py-0.5 rounded focus:outline-none focus:ring-1 focus:ring-primary/40" style={{ color: CRED_TYPE_COLORS[op.credType] }}>
                        {CRED_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className="px-5 py-4 text-glow-green font-semibold">${op.rate ?? 0}</td>
                    <td className="px-5 py-4">{isRiskByStars(op) ? <Tag label="Risk" color="#f59e0b" small /> : <span className="text-[10px] text-muted-foreground">OK</span>}</td>
                    <td className="px-5 py-4"><button type="button" onClick={() => setEditingOp(op)} className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-colors">Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
        {editingOp && <EditOperatorModal zones={zones} op={editingOp} onSave={onUpdate} onClose={() => setEditingOp(null)} onUpdateDefaultRate={onUpdateDefaultRate} onRatingHistory={onRatingHistory} onDelete={onOperatorDeleted} />}
      </div>
    </div>
  );
}

// ─── OPERATORS (editable roster) ──────────────────────────────────────────────

function OperatorsView({ zones = [], ops = [], onUpdate, onAddOperator, onUpdateDefaultRate, onRatingHistory, onOperatorDeleted, isMobile }) {
  const [editingOp, setEditingOp] = useState(null);
  const [search, setSearch] = useState("");
  const q = (search || "").toLowerCase().trim();
  const filtered = (Array.isArray(ops) ? ops : []).filter(o =>
    !q || (o.name || "").toLowerCase().includes(q) || (o.opId || "").toLowerCase().includes(q) || (o.zone || "").toLowerCase().includes(q)
  );

  const addButton = onAddOperator ? (
<button type="button" onClick={onAddOperator} className="btn-primary-glow min-h-[44px] bg-primary text-primary-foreground hover:bg-primary/90 text-xs rounded-xl px-3 py-2 font-semibold inline-flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background">
    <Plus className="w-3.5 h-3.5" /> Add Operator
    </button>
  ) : null;

  if (isMobile) {
    return (
      <div className="min-h-full grid-bg content-glow">
        <div className="px-6 lg:px-10 py-10 max-w-[1400px] mx-auto flex flex-col gap-6 animate-fade-in">
          <PageHeader label="OPERATORS" title="Operator Roster" subtitle="Search and manage crew for this project" actions={addButton} />
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, ID, zone..." className="w-full pl-9 pr-4 py-2.5 rounded-xl glass text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all duration-300" />
          </div>
          {filtered.length === 0 ? (
            <div className="glass-panel rounded-2xl p-10 text-center text-sm text-muted-foreground">No operators yet.</div>
          ) : (
            <div className="flex flex-col gap-3">
              {filtered.map(op => (
                <HudCard key={op.id}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="text-sm font-semibold text-foreground">{op.name || "—"}</div>
                      <div className="text-[10px] text-muted-foreground">{op.opId || op.id} · {op.zone || "—"}</div>
                    </div>
                    <span className="text-[11px] text-glow-green font-semibold">${op.rate ?? 0}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className="text-xs font-medium">{op.reliability != null ? `${op.reliability}★` : "—"}</span>
                    {isRiskByStars(op) && <Tag label="Risk" color="#f59e0b" small />}
                    <Tag label={op.stage || "—"} color={STAGE_COLORS[op.stage] || "#64748b"} small />
                    <Tag label={op.cred || "—"} color={CRED_COLORS[op.cred] || "#64748b"} small />
                    {(op.availabilityStatus && AVAILABILITY_BADGE[op.availabilityStatus]) && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border border-current/30" style={{ color: AVAILABILITY_BADGE[op.availabilityStatus].color }}>{AVAILABILITY_BADGE[op.availabilityStatus].label}</span>
                    )}
                  </div>
                  <button type="button" onClick={()=>setEditingOp(op)} className="w-full py-2 rounded-xl text-xs font-semibold bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-colors">Edit</button>
                </HudCard>
              ))}
            </div>
          )}
          <div className="text-[10px] text-muted-foreground">{filtered.length} of {ops.length} operators</div>
          {editingOp && <EditOperatorModal zones={zones} op={editingOp} onSave={onUpdate} onClose={()=>setEditingOp(null)} onUpdateDefaultRate={onUpdateDefaultRate} onRatingHistory={onRatingHistory} onDelete={onOperatorDeleted}/>}
        </div>
      </div>
    );
  }

  const desktopActions = (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="relative w-56">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search operators..." className="w-full pl-9 pr-4 py-2.5 rounded-xl glass text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all duration-300" />
      </div>
      {addButton}
    </div>
  );

  return (
    <div className="min-h-full grid-bg content-glow">
      <div className="px-6 lg:px-10 py-10 max-w-[1400px] mx-auto flex flex-col gap-6 animate-fade-in w-full">
        <PageHeader label="OPERATORS" title="Operator Roster" subtitle="Search and manage crew for this project" actions={desktopActions} />
        <GlassCard className="overflow-hidden !p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[hsla(210,20%,93%,0.05)]">
                  {["ID","Name","Phone","Zone","Stage","Cred Status","Stars","Availability","Day Rate",""].map(h=>(
                    <th key={h} className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-widest px-5 py-3.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length===0 ? (
                  <tr><td colSpan={9} className="px-5 py-10 text-center text-sm text-muted-foreground">No operators yet. Add your first operator to get started.</td></tr>
                ) : filtered.map(op=>(
                  <tr key={op.id} className="border-b border-[hsla(210,20%,93%,0.03)] row-hover-glow cursor-pointer" onClick={()=>setEditingOp(op)} style={{ background: op.cred==="Denied" ? "rgba(42,0,0,0.25)" : undefined }}>
                    <td className="px-5 py-4 text-[10px] text-muted-foreground font-mono">{op.opId||op.id}</td>
                    <td className="px-5 py-4 font-medium">{op.name||'—'}</td>
                    <td className="px-5 py-4 text-muted-foreground">{op.phone||'—'}</td>
                    <td className="px-5 py-4 text-muted-foreground">{op.zone||'—'}</td>
                    <td className="px-5 py-4"><HudBadge label={op.stage||'—'} color={STAGE_COLORS[op.stage]||"#64748b"} small /></td>
                    <td className="px-5 py-4"><HudBadge label={op.cred||'—'} color={CRED_COLORS[op.cred]||"#64748b"} small /></td>
                    <td className="px-5 py-4"><div className="flex items-center gap-1.5"><span className="text-sm font-medium">{op.reliability != null ? `${op.reliability}★` : "—"}</span>{isRiskByStars(op) && <Tag label="Risk" color="#f59e0b" small />}</div></td>
                    <td className="px-5 py-4">
                      {(op.availabilityStatus && AVAILABILITY_BADGE[op.availabilityStatus]) ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border border-current/30" style={{ color: AVAILABILITY_BADGE[op.availabilityStatus].color }}>{AVAILABILITY_BADGE[op.availabilityStatus].label}</span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-glow-green font-semibold">${op.rate??0}</td>
                    <td className="px-5 py-4"><button type="button" onClick={e=>{ e.stopPropagation(); setEditingOp(op); }} className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-colors">Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
        <div className="text-[10px] text-muted-foreground">{filtered.length} of {ops.length} operators</div>
        {editingOp && <EditOperatorModal zones={zones} op={editingOp} onSave={onUpdate} onClose={()=>setEditingOp(null)} onUpdateDefaultRate={onUpdateDefaultRate} onRatingHistory={onRatingHistory} onDelete={onOperatorDeleted}/>}
      </div>
    </div>
  );
}

// ─── DEPLOYMENT MATRIX (drag-and-drop by house) ───────────────────────────────

const UNASSIGNED_ZONE = "Floater"; // zone value for "Unassigned" column

// Derive live shift status from project shifts: end_time → Completed; on_break → On Lunch; start_time → On Shift; else Off Shift
function getDeployShiftStatus(op, shifts = []) {
  if (!shifts.length) return "off_shift";
  const opId = Number(op.id);
  const active = shifts.find((s) => Number(s.operator_id) === opId && !s.end_time);
  if (active) return active.on_break ? "on_lunch" : "on_shift";
  const hasCompleted = shifts.some((s) => Number(s.operator_id) === opId && s.end_time);
  return hasCompleted ? "completed" : "off_shift";
}

const DEPLOY_STATUS_LABEL = { on_shift: "On Shift", on_lunch: "Lunch", completed: "Completed", off_shift: "Off Shift" };

function DeployMatrix({ zones = [], ops, shifts = [], onUpdate }) {
  const [dragId, setDragId] = useState(null);
  const [overColumn, setOverColumn] = useState(null);

  const columns = useMemo(() => {
    const houses = (zones || []).filter(z => z !== UNASSIGNED_ZONE);
    return [{ id: "Unassigned", label: "Unassigned Operators", zoneValue: UNASSIGNED_ZONE }, ...houses.map(z => ({ id: z, label: z, zoneValue: z }))];
  }, [zones]);

  const getOpsForColumn = useCallback((col) => {
    if (col.id === "Unassigned") return (ops || []).filter(o => !o.zone || o.zone === UNASSIGNED_ZONE);
    return (ops || []).filter(o => o.zone === col.zoneValue);
  }, [ops]);

  const handleDrop = useCallback((targetZoneValue) => {
    if (!dragId || !onUpdate) return;
    onUpdate(dragId, { zone: targetZoneValue });
    setDragId(null);
    setOverColumn(null);
  }, [dragId, onUpdate]);

  if (!zones?.length) {
    return (
      <div className="min-h-full grid-bg content-glow border-0">
        <div className="px-6 lg:px-10 py-8 max-w-[1400px] mx-auto flex flex-col gap-5 animate-fade-in w-full">
          <h1 className="text-2xl font-bold tracking-tight text-heading-glow">Deployment Matrix</h1>
          <p className="text-sm text-muted-foreground -mt-2 mb-1">Assign operators to houses</p>
          <div className="glass-panel rounded-2xl p-10 text-center">
            <p className="text-sm text-muted-foreground">No zones configured. Add zones in project settings to see deployment matrix.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full grid-bg content-glow border-0">
      <div className="px-6 lg:px-10 py-8 max-w-[1400px] mx-auto flex flex-col gap-5 animate-fade-in w-full">
        <h1 className="text-2xl font-bold tracking-tight text-heading-glow">Deployment Matrix</h1>
        <p className="text-sm text-muted-foreground -mt-1 mb-0">Drag operators between houses to assign. Unassigned operators can be deployed to any column.</p>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((col) => {
            const columnOps = getOpsForColumn(col);
            const opCount = columnOps.length;
            const lunchCount = columnOps.filter((op) => getDeployShiftStatus(op, shifts) === "on_lunch").length;
            const riskCount = columnOps.filter((o) => (o.reliability ?? 5) <= 3).length;
            const isOver = overColumn === col.id;
            return (
              <div
                key={col.id}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setOverColumn(col.id); }}
                onDragLeave={() => setOverColumn(null)}
                onDrop={() => handleDrop(col.zoneValue)}
                className="min-w-[260px] w-[260px] flex-shrink-0"
              >
                <div className={`glass rounded-2xl border-t-2 p-3 flex flex-col gap-2.5 transition-all duration-200 min-h-[180px] ${
                  isOver ? "border-t-primary ring-2 ring-primary/30 bg-white/[0.03]" : "border-t-white/[0.06]"
                }`}
                >
                  <div className="flex items-center justify-between px-1 mb-1">
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-foreground">{col.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground flex-wrap">
                    <span>{opCount} ops</span>
                    <span className="text-white/30">•</span>
                    <span className={lunchCount > 0 ? "text-amber-400 font-medium" : ""}>{lunchCount} lunch</span>
                    <span className="text-white/30">•</span>
                    <span className={riskCount > 0 ? "text-destructive/90 font-medium" : ""}>{riskCount} risk</span>
                  </div>
                  <div className="flex flex-col gap-2 flex-1 min-h-0">
                    {columnOps.map((op) => {
                      const av = op.availabilityStatus && AVAILABILITY_BADGE[op.availabilityStatus];
                      const avLabel = av ? (op.availabilityStatus === "Partial" && op.availableThrough ? `Partial — through ${formatDateShort(op.availableThrough)}` : av.label) : null;
                      const shiftStatus = getDeployShiftStatus(op, shifts);
                      const statusLabel = DEPLOY_STATUS_LABEL[shiftStatus];
                      return (
                      <div
                        key={op.id}
                        draggable={!!onUpdate}
                        onDragStart={() => setDragId(op.id)}
                        onDragEnd={() => { setDragId(null); setOverColumn(null); }}
                        className="glass rounded-xl p-3 flex flex-col gap-1.5 cursor-grab active:cursor-grabbing border border-white/[0.04] hover:border-white/[0.08] card-hover-subtle transition-all duration-150"
                      >
                        <span className="text-sm font-semibold text-foreground truncate">{op.name}</span>
                        <span className={shiftStatus === "on_shift" ? "text-[10px] font-semibold px-1.5 py-0.5 rounded border border-emerald-400/40 text-emerald-400 bg-emerald-500/10 w-fit" : shiftStatus === "on_lunch" ? "text-[10px] font-semibold px-1.5 py-0.5 rounded border border-amber-400/40 text-amber-400 bg-amber-500/10 w-fit" : "text-[10px] text-muted-foreground"}>
                          {statusLabel}
                        </span>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Stars value={op.reliability ?? 3} disabled />
                          {avLabel ? (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-current/30" style={{ color: av?.color ?? "inherit" }}>{avLabel}</span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">{op.stage || "—"}</span>
                          )}
                          {(op.reliability ?? 5) <= 3 && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-destructive/20 text-destructive border border-destructive/30">Risk</span>
                          )}
                        </div>
                      </div>
                    ); })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── EXPENSES (project-level production expenses) ──────────────────────────────
function AddExpenseModal({ projectId, onSave, onClose }) {
  const [form, setForm] = useState({ category: "Misc Production", description: "", amount: "", date: new Date().toISOString().slice(0, 10), submittedBy: "", note: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const handleSubmit = (e) => {
    e.preventDefault();
    setErr(null);
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount < 0) { setErr("Amount must be a number ≥ 0"); return; }
    if (!(form.description || "").trim()) { setErr("Description required"); return; }
    setSaving(true);
    try {
      const added = addExpense(projectId, { ...form, amount });
      onSave(added);
      onClose();
    } catch (e) { setErr(e?.message || "Failed"); }
    finally { setSaving(false); }
  };
  return (
    <GlassModal open={true} onOpenChange={(open) => { if (!open) onClose(); }} title="Add Expense" description="Log a production expense for this project.">
      {err && <div className="text-sm text-destructive mb-3">{err}</div>}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
        <GlassSelect label="Category" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
          {EXPENSE_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
        </GlassSelect>
        <GlassInput label="Description" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="e.g. Crew lunch W1" required />
        <GlassInput label="Amount ($)" type="number" min={0} step={0.01} value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="0" required />
        <GlassInput label="Date" type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} required />
        <GlassInput label="Submitted by" value={form.submittedBy} onChange={e=>setForm(f=>({...f,submittedBy:e.target.value}))} placeholder="Name or team" />
        <div>
          <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">Note (optional)</label>
          <textarea value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))} placeholder="Optional"
            className="w-full min-h-[60px] px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y" />
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 transition-colors">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary-glow flex-1 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">{saving ? "Saving…" : "Add Expense"}</button>
        </div>
      </form>
    </GlassModal>
  );
}

function ExpensesView({ projectId, expenses = [], onRefresh, isMobile }) {
  const [showAdd, setShowAdd] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (location.state?.openAddExpense) {
      setShowAdd(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state?.openAddExpense, location.pathname, navigate]);
  const fmt$ = n => (n == null || Number.isNaN(n)) ? "$0" : "$" + Math.round(n).toLocaleString();
  const total = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const addButton = (
    <button type="button" onClick={()=>setShowAdd(true)} className="btn-primary-glow min-h-[44px] bg-primary text-primary-foreground hover:bg-primary/90 text-xs rounded-xl px-3 py-2 font-semibold inline-flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background">
      <Plus className="w-3.5 h-3.5" /> Add Expense
    </button>
  );
  return (
    <div className="min-h-full grid-bg content-glow">
      <div className="px-6 lg:px-10 py-10 max-w-[1400px] mx-auto flex flex-col gap-6 animate-fade-in w-full">
        <PageHeader label="EXPENSES" title="Production Expenses" subtitle="Track non-labor expenses for this project" actions={addButton} />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="glass rounded-2xl border border-white/[0.06] px-5 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Total Expenses</div>
            <div className="text-2xl font-bold text-glow-green tracking-tight">{fmt$(total)}</div>
          </div>
        </div>
        <GlassCard className="overflow-hidden !p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[hsla(210,20%,93%,0.05)]">
                  {["Date","Category","Description","Amount","Submitted by",""].map(h=>(
                    <th key={h} className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-widest px-5 py-3.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-muted-foreground">No expenses yet. Add an expense to track production spend beyond labor.</td></tr>
                ) : expenses.map(exp=>(
                  <tr key={exp.id} className="border-b border-[hsla(210,20%,93%,0.03)] row-hover-glow">
                    <td className="px-5 py-4 text-[10px] text-muted-foreground">{exp.date || "—"}</td>
                    <td className="px-5 py-4"><span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border border-white/10 glass-subtle">{exp.category || "—"}</span></td>
                    <td className="px-5 py-4 font-medium text-foreground">{exp.description || "—"}</td>
                    <td className="px-5 py-4 text-glow-green font-semibold">{fmt$(Number(exp.amount))}</td>
                    <td className="px-5 py-4 text-muted-foreground text-[10px]">{exp.submittedBy || "—"}</td>
                    <td className="px-5 py-4">
                      <button type="button" onClick={()=>{ removeExpense(projectId, exp.id); onRefresh(); }} className="px-2.5 py-1 rounded-lg text-[10px] font-semibold border border-destructive/40 text-destructive bg-destructive/10 hover:bg-destructive/20 transition-colors">Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {expenses.length > 0 && (
            <div className="px-5 py-3 border-t border-white/[0.06] text-[10px] text-muted-foreground">
              {expenses.length} expense{expenses.length !== 1 ? "s" : ""} · Total {fmt$(total)}
            </div>
          )}
        </GlassCard>
        {showAdd && <AddExpenseModal projectId={projectId} onSave={()=>{ onRefresh(); setShowAdd(false); }} onClose={()=>setShowAdd(false)} />}
      </div>
    </div>
  );
}

// ─── EMERGENCY POOL ───────────────────────────────────────────────────────────
// Not rendered in any route; reskin with shared page wrapper + GlassCard if wired into nav later.
function EmergencyPool({ ops }) {
  const pool = ops.filter(o =>
    o.cred === "Approved" &&
    (o.zone === "Floater" || o.stage !== "Confirmed") &&
    o.reliability >= 4 &&
    o.stage !== "Passed" && o.stage !== "Outreach"
  );

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{background:"#0a1a0a",border:"1px solid #22c55e",borderRadius:8,padding:"14px 18px",display:"flex",gap:16,alignItems:"center"}}>
        <span style={{fontSize:24,fontWeight:900,color:"#22c55e",fontFamily:"monospace"}}>{pool.length}</span>
        <div>
          <div style={{fontSize:11,color:"#22c55e",fontWeight:800}}>EMERGENCY REPLACEMENT OPS READY</div>
          <div style={{fontSize:10,color:"#64748b",marginTop:2}}>Auto-filter: Cred Approved · Floater or unassigned · Reliability ≥ 4 · Not passed</div>
        </div>
      </div>
      {pool.length===0 && (
        <div style={{background:"#1a0000",border:"1px solid #ef4444",borderRadius:8,padding:"20px",textAlign:"center"}}>
          <div style={{fontSize:14,color:"#ef4444",fontWeight:800}}>⚠ NO QUALIFIED EMERGENCY OPS AVAILABLE</div>
          <div style={{fontSize:11,color:"#64748b",marginTop:6}}>Credential more floaters or improve reliability scores.</div>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:10}}>
        {pool.map(op=>(
          <div key={op.id} style={{background:"#0f172a",border:"1px solid #22c55e33",borderLeft:"3px solid #22c55e",borderRadius:8,padding:"14px 14px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div>
                <div style={{fontSize:12,fontWeight:800,color:"var(--hud-text)"}}>{op.name}</div>
                <div style={{fontSize:10,color:"#64748b"}}>{op.id} · {op.phone}</div>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                <span className="text-sm font-medium">{op.reliability != null ? `${op.reliability}★` : "—"}</span>
                {isRiskByStars(op) && <Tag label="Risk" color="#f59e0b" small />}
                <span className="text-[10px] text-muted-foreground">· {op.tier || "—"}</span>
              </div>
            </div>
            <div style={{display:"flex",gap:5,marginBottom:8,flexWrap:"wrap",alignItems:"center"}}>
              <Stars value={op.reliability} disabled />
              <Tag label={op.credType} color={CRED_TYPE_COLORS[op.credType]} small/>
              {op.workedWithMemeHouse && <Tag label="MH Alumni" color="#22c55e" small/>}
            </div>
            <div style={{display:"flex",gap:3,flexWrap:"wrap",marginBottom:8}}>
              {op.gear.map(g=><GearChip key={g} label={g} active/>)}
            </div>
            <div style={{fontSize:10,color:"#94a3b8"}}>
              Stage: <span style={{color:STAGE_COLORS[op.stage],fontWeight:700}}>{op.stage}</span> · {op.zone}
            </div>
            {isBroadcastQualified(op) && <div style={{fontSize:9,color:"#22d3ee",fontWeight:700,marginTop:4}}>📡 BROADCAST QUALIFIED</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── POST-EVENT REVIEW ────────────────────────────────────────────────────────

const POST_EVENT_COLS = "80px 1fr 60px 85px 100px 85px 1fr";

function PostEventReview({ ops, onUpdate }) {
  const reviewed  = ops.filter(o=>o.perfScore!==null);
  const rehireYes = ops.filter(o=>o.rehireEligible===true);
  const rehireNo  = ops.filter(o=>o.rehireEligible===false);
  const avgScore  = reviewed.length ? (reviewed.reduce((a,o)=>a+(o.perfScore||0),0)/reviewed.length).toFixed(1) : "—";
  const [filter, setFilter] = useState("all");

  const filtered = filter==="all" ? ops.filter(o=>o.stage==="Confirmed"||o.stage==="Passed"||o.perfScore!==null)
    : filter==="reviewed" ? reviewed
    : filter==="rehire" ? rehireYes
    : rehireNo;

  return (
    <div className="min-h-full grid-bg content-glow">
      <div className="px-6 lg:px-10 py-10 max-w-[1400px] mx-auto flex flex-col gap-6 animate-fade-in w-full">
        <h1 className="text-2xl font-bold tracking-tight text-heading-glow">Post-Event Review</h1>
        <p className="text-sm text-muted-foreground -mt-2 mb-1">Rate performance and rehire eligibility</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Ops Reviewed"   value={reviewed.length}  sub={`of ${ops.length} total`}    accent="#6366f1"/>
          <StatCard label="Avg Perf Score" value={avgScore}          sub="Out of 5.0"                  accent="#f59e0b"/>
          <StatCard label="Rehire Eligible" value={rehireYes.length} sub="Available for next event"    accent="#22c55e"/>
          <StatCard label="Do Not Rehire"  value={rehireNo.length}   sub="Flagged in roster DB"        accent="#ef4444"/>
        </div>
        <GlassCard className="p-5 border-glow-amber/20">
          <p className="text-sm text-muted-foreground">
            📁 <strong className="text-amber-400">FESTIVAL_ROSTER_DB</strong> — All reviewed ops are automatically written to the reusable festival database for future event hiring.
          </p>
        </GlassCard>
        <div className="flex flex-wrap gap-2">
          {[["all","All Ops"],["reviewed","Reviewed"],["rehire","Rehire ✓"],["no-rehire","No Rehire ✗"]].map(([v,l])=>(
            <button key={v} type="button" onClick={()=>setFilter(v)} className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${filter===v ? "glass text-primary border-primary/20" : "glass-subtle text-muted-foreground border-transparent hover:text-foreground"}`}>{l}</button>
          ))}
        </div>
        <GlassCard className="overflow-hidden !p-0">
          <div className="grid border-b border-[hsla(210,20%,93%,0.05)]" style={{gridTemplateColumns:POST_EVENT_COLS}}>
            {["ID","Name","Stars","Zone","Perf Score","Rehire?","Notes"].map(h=>(
              <span key={h} className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-widest px-5 py-3.5">{h}</span>
            ))}
          </div>
          <div className="max-h-[480px] overflow-y-auto">
            {filtered.map(op=>(
              <div key={op.id} className={`grid border-b border-[hsla(210,20%,93%,0.03)] row-hover-glow items-center ${op.rehireEligible===false?"bg-destructive/20":op.rehireEligible===true?"bg-glow-green/10":""}`} style={{gridTemplateColumns:POST_EVENT_COLS}}>
                <span className="px-5 py-4 text-[10px] text-muted-foreground font-mono">{op.id}</span>
                <div className="px-5 py-4 min-w-0">
                  <div className="text-sm font-medium text-foreground">{op.name}</div>
                  <div className="text-[10px] text-muted-foreground">{op.workedWithMemeHouse?"✓ MH Alumni":op.source}</div>
                </div>
                <div className="px-5 py-4 flex items-center gap-1.5"><span className="text-sm font-medium">{op.reliability != null ? `${op.reliability}★` : "—"}</span>{isRiskByStars(op) && <Tag label="Risk" color="#f59e0b" small />}</div>
                <span className="px-5 py-4 text-[10px] text-muted-foreground font-medium">{op.zone}</span>
                <div className="px-5 py-4"><Stars value={op.perfScore||0} onChange={v=>onUpdate(op.id,{perfScore:v})}/></div>
                <div className="px-5 py-4 flex gap-2">
                  <button type="button" onClick={()=>onUpdate(op.id,{rehireEligible:true})} className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors ${op.rehireEligible===true?"bg-glow-green text-primary-foreground":"glass-subtle text-muted-foreground hover:text-foreground"}`}>Y</button>
                  <button type="button" onClick={()=>onUpdate(op.id,{rehireEligible:false})} className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors ${op.rehireEligible===false?"bg-destructive/20 text-destructive border border-destructive/30":"glass-subtle text-muted-foreground hover:text-foreground"}`}>N</button>
                </div>
                <div className="px-5 py-4">
                  <input value={op.postNotes||""} onChange={e=>onUpdate(op.id,{postNotes:e.target.value})} placeholder="Post-event note..." className="w-full bg-transparent border-none border-b border-white/[0.06] text-muted-foreground text-xs py-1 outline-none focus:border-primary/30 focus:ring-0"/>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

// ─── EDIT OPERATOR MODAL ──────────────────────────────────────────────────────
function EditOperatorModal({ op, zones = [], onSave, onClose, onUpdateDefaultRate, onRatingHistory, onDelete }) {
  const defaultZone = zones.length ? (zones.includes(op?.zone) ? op.zone : zones[0]) : (op?.zone || '');
  const [form, setForm] = useState({ full_name: op?.name||'', phone: op?.phone||'', day_rate: op?.rate||0, zone: defaultZone, cred_status: op?.cred||'Not Started', availabilityStatus: op?.availabilityStatus??'', availableThrough: op?.availableThrough??'', availabilityNote: op?.availabilityNote??'', reliability: op?.reliability ?? 3, ratingChangeReason: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => { if (op) setForm(f=>({ ...f, full_name: op.name||'', phone: op.phone||'', day_rate: op.rate||0, zone: zones.length ? (zones.includes(op.zone) ? op.zone : zones[0]) : (op.zone||''), cred_status: op.cred||'Not Started', availabilityStatus: op.availabilityStatus??'', availableThrough: op.availableThrough??'', availabilityNote: op.availabilityNote??'', reliability: op.reliability ?? 3, ratingChangeReason: '' })); }, [op, zones]);
  const ratingChanged = op && Number(form.reliability) !== Number(op.reliability);
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr(null);
    if (ratingChanged && !(form.ratingChangeReason || '').trim()) { setErr('Reason for rating change is required'); return; }
    setSaving(true);
    try {
      const payload = { name: form.full_name, phone: form.phone, rate: Number(form.day_rate)||0, zone: form.zone, cred: form.cred_status };
      if (form.availabilityStatus) payload.availabilityStatus = form.availabilityStatus; else payload.availabilityStatus = null;
      if (form.availableThrough) payload.availableThrough = form.availableThrough; else payload.availableThrough = null;
      if (form.availabilityNote) payload.availabilityNote = form.availabilityNote; else payload.availabilityNote = null;
      if (form.reliability != null) payload.reliability = Number(form.reliability);
      if (ratingChanged && onRatingHistory) {
        await onRatingHistory(op.id, { old_rating: op.reliability ?? 3, new_rating: Number(form.reliability), reason: (form.ratingChangeReason || '').trim() });
      }
      await onSave(op.id, payload);
      onClose();
    } catch (e) { setErr(e?.message || 'Failed'); }
    finally { setSaving(false); }
  };
  const handleConfirmDelete = async () => {
    if (!op) return;
    setDeleting(true);
    try {
      await api.deleteOperator(op.id);
      onDelete?.(op.id);
      onClose();
    } catch (e) {
      setErr(e?.message || 'Failed to delete');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };
  if (!op) return null;
  return (
    <>
    <GlassModal open={true} onOpenChange={(open) => { if (!open) onClose(); }} title="Edit Operator" description="Update operator details and credential status.">
      {err && <div className="text-sm text-destructive mb-3">{err}</div>}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
        <GlassInput label="Full Name" value={form.full_name} onChange={e=>setForm(f=>({...f,full_name:e.target.value}))} required />
        <GlassInput label="Phone" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} />
        <GlassInput label="Day Rate (this project)" type="number" value={form.day_rate||''} onChange={e=>setForm(f=>({...f,day_rate:e.target.value}))} min={0} placeholder="500" />
        {onUpdateDefaultRate && (
          <button type="button" onClick={() => { onUpdateDefaultRate(op.id, Number(form.day_rate) || 0); }} className="text-xs text-muted-foreground bg-transparent border-none cursor-pointer underline hover:text-foreground">Update default rate in library</button>
        )}
        <div>
          <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">Star rating (1–5)</label>
          <Stars value={form.reliability} onChange={v=>setForm(f=>({...f,reliability:v}))} />
          <p className="text-[10px] text-muted-foreground mt-1">{STAR_RATING_LABELS[form.reliability] ?? form.reliability} — {form.reliability <= 3 ? "Risk" : "OK"}</p>
        </div>
        {ratingChanged && (
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">Reason for rating change (required)</label>
            <textarea value={form.ratingChangeReason} onChange={e=>setForm(f=>({...f,ratingChangeReason:e.target.value}))} placeholder="e.g. Strong performance on last shoot"
              className="w-full min-h-[72px] px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y" required />
          </div>
        )}
        <GlassSelect label="Zone" value={zones.length ? form.zone : ''} onChange={e=>setForm(f=>({...f,zone:e.target.value}))} disabled={!zones.length}>
          {!zones.length ? <option value="">No zones yet — add in Settings</option> : zones.map(z=><option key={z} value={z}>{z}</option>)}
        </GlassSelect>
        <GlassSelect label="Credential Status" value={form.cred_status} onChange={e=>setForm(f=>({...f,cred_status:e.target.value}))}>
          {CRED_STATES.map(s=><option key={s} value={s}>{s}</option>)}
        </GlassSelect>
        <GlassSelect label="Availability Status" value={form.availabilityStatus} onChange={e=>setForm(f=>({...f,availabilityStatus:e.target.value||null}))}>
          <option value="">—</option>
          {AVAILABILITY_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
        </GlassSelect>
        {(form.availabilityStatus==='Partial'||form.availabilityStatus==='Unavailable') && (
          <GlassInput label="Available Through" type="date" value={form.availableThrough||''} onChange={e=>setForm(f=>({...f,availableThrough:e.target.value||null}))} />
        )}
        <div>
          <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">Availability Note</label>
          <textarea value={form.availabilityNote||''} onChange={e=>setForm(f=>({...f,availabilityNote:e.target.value||null}))} placeholder="Optional"
            className="w-full min-h-[60px] px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y" />
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 transition-colors">Cancel</button>
          <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">{saving ? "Saving…" : "Save"}</button>
        </div>
        <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-2">
          <button type="button" onClick={() => { onSave(op.id, { isArchived: true }); onClose(); }} className="w-full py-2 rounded-xl text-sm font-semibold border border-white/10 text-muted-foreground hover:bg-white/5 transition-colors">Archive Operator</button>
          {onDelete && (
            <button type="button" onClick={() => setShowDeleteConfirm(true)} className="w-full py-2 rounded-xl text-sm font-semibold border border-destructive/50 text-destructive bg-destructive/10 hover:bg-destructive/20 transition-colors">Delete permanently</button>
          )}
        </div>
      </form>
    </GlassModal>
    {showDeleteConfirm && (
      <GlassModal open={true} onOpenChange={(open) => { if (!open) setShowDeleteConfirm(false); }} title="Delete this operator permanently?" description="This will permanently remove the operator from the portal. This action cannot be undone." className="max-w-[400px]">
        <div className="flex gap-3 justify-end pt-4">
          <button type="button" onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 transition-colors">Cancel</button>
          <button type="button" onClick={handleConfirmDelete} disabled={deleting} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-destructive/50 text-destructive-foreground bg-destructive hover:bg-destructive/90 disabled:opacity-50 transition-colors">{deleting ? "Deleting…" : "Delete permanently"}</button>
        </div>
      </GlassModal>
    )}
    </>
  );
}

// ─── ADD OPERATOR MODAL (From Library | New Operator) ──────────────────────────
function AddOperatorModal({ zones = [], onSave, onClose, projectId }) {
  const defaultZone = zones.length ? zones[0] : '';
  const [tab, setTab] = useState(projectId ? 'library' : 'new');
  const [form, setForm] = useState({ full_name: '', tier: 'T2', zone: defaultZone, hire_stage: 'Outreach', cred_status: 'Not Started', cred_type: 'None', day_rate: '', planned_days: 1, reliability: 3 });
  const [confirmImmediately, setConfirmImmediately] = useState(false);
  const [err, setErr] = useState(null);
  const [libraryList, setLibraryList] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');
  const [selectedLibraryOp, setSelectedLibraryOp] = useState(null);
  const [libraryProjectRate, setLibraryProjectRate] = useState('');
  const [libraryZone, setLibraryZone] = useState(defaultZone);
  const [librarySubmitting, setLibrarySubmitting] = useState(false);

  useEffect(() => {
    if (tab === 'library' && projectId) {
      setLibraryLoading(true);
      api.getLibraryOperators()
        .then((data) => { setLibraryList(Array.isArray(data) ? data : []); })
        .catch(() => setLibraryList([]))
        .finally(() => setLibraryLoading(false));
    }
  }, [tab, projectId]);

  const libraryFiltered = librarySearch.trim()
    ? libraryList.filter((o) => (o.full_name || '').toLowerCase().includes(librarySearch.toLowerCase()) || (o.op_id || '').toLowerCase().includes(librarySearch.toLowerCase()))
    : libraryList;

  const handleSubmitNew = async (e) => {
    e.preventDefault();
    setErr(null);
    const rate = form.day_rate === '' ? 0 : Number(form.day_rate);
    if (rate < 0 || rate > 9999) { setErr('Day rate must be 0–9999'); return; }
    const plannedDays = form.planned_days != null && form.planned_days !== '' ? Math.floor(Number(form.planned_days)) : 1;
    if (!Number.isInteger(plannedDays) || plannedDays < 0) { setErr('Planned days must be an integer ≥ 0'); return; }
    if (!(form.full_name||'').trim()) { setErr('Name required'); return; }
    const hireStage = confirmImmediately ? 'Confirmed' : 'Outreach';
    try {
      await onSave({ ...form, day_rate: rate, planned_days: plannedDays, hire_stage: hireStage, reliability: Number(form.reliability) || 3 });
      onClose();
    } catch (e) { setErr(e?.message || 'Failed'); }
  };

  const handleAddFromLibrary = async (e) => {
    e.preventDefault();
    if (!selectedLibraryOp || !projectId) return;
    setErr(null);
    setLibrarySubmitting(true);
    const rate = libraryProjectRate === '' ? (selectedLibraryOp.day_rate ?? 0) : Number(libraryProjectRate);
    if (rate < 0) { setErr('Rate must be ≥ 0'); setLibrarySubmitting(false); return; }
    const hireStage = confirmImmediately ? 'Confirmed' : 'Outreach';
    try {
      await onSave({
        operator_id: selectedLibraryOp.id,
        project_day_rate: rate,
        day_rate: rate,
        zone: libraryZone || undefined,
        hire_stage: hireStage,
        cred_status: 'Not Started',
        cred_type: 'None',
        planned_days: 1,
        tier: selectedLibraryOp.tier || 'T2',
      });
      onClose();
    } catch (e) { setErr(e?.message || 'Failed'); } finally { setLibrarySubmitting(false); }
  };

  return (
    <GlassModal open={true} onOpenChange={(open) => { if (!open) onClose(); }} title="Add Operator" description={projectId ? "Add from library or create a new operator." : "Create a new operator."} className="max-w-[440px]">
      {projectId && (
        <div className="flex gap-2 mb-4">
          <button type="button" onClick={()=>setTab('library')} className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${tab==='library' ? 'glass text-primary border-primary/20 pill-glow-amber' : 'glass-subtle text-muted-foreground border-transparent hover:text-foreground'}`}>From Library</button>
          <button type="button" onClick={()=>setTab('new')} className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${tab==='new' ? 'glass text-primary border-primary/20 pill-glow-amber' : 'glass-subtle text-muted-foreground border-transparent hover:text-foreground'}`}>New Operator</button>
        </div>
      )}
      {err && <div className="text-sm text-destructive mb-3">{err}</div>}

        {tab === 'library' && projectId ? (
          <form onSubmit={handleAddFromLibrary} className="flex flex-col gap-4">
            <GlassInput label="Search by name or ID" value={librarySearch} onChange={e=>setLibrarySearch(e.target.value)} placeholder="Type to filter..." />
            <div className="max-h-[180px] overflow-y-auto rounded-xl border border-white/[0.06] p-2 glass-subtle">
              {libraryLoading ? <div className="p-3 text-xs text-muted-foreground">Loading…</div> : libraryFiltered.length === 0 ? <div className="p-3 text-xs text-muted-foreground">No operators in library. Use New Operator to add one.</div> : libraryFiltered.map((o) => (
                <button key={o.id} type="button" onClick={()=>{ setSelectedLibraryOp(o); setLibraryProjectRate(o.day_rate != null ? String(o.day_rate) : ''); }} className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedLibraryOp?.id===o.id ? 'glass text-primary border border-primary/20' : 'text-foreground hover:bg-white/5'}`}>
                  {o.full_name || '—'} · {o.op_id || o.id} · ${o.day_rate ?? 0}
                </button>
              ))}
            </div>
            {selectedLibraryOp && (
              <>
                <GlassInput label="Project day rate (editable for this project)" type="number" min={0} value={libraryProjectRate} onChange={e=>setLibraryProjectRate(e.target.value)} placeholder={String(selectedLibraryOp.day_rate ?? 0)} />
                <GlassSelect label="Zone" value={zones.length ? libraryZone : ''} onChange={e=>setLibraryZone(e.target.value)} disabled={!zones.length}>
                  {!zones.length ? <option value="">No zones yet</option> : zones.map(z=><option key={z} value={z}>{z}</option>)}
                </GlassSelect>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={confirmImmediately} onChange={e=>setConfirmImmediately(e.target.checked)} className="accent-primary w-4 h-4 rounded" />
                  <span className="text-xs font-semibold text-foreground">Confirm immediately</span>
                </label>
              </>
            )}
            <div className="flex gap-3 justify-end pt-2">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 transition-colors">Cancel</button>
              <button type="submit" disabled={!selectedLibraryOp || librarySubmitting} className="btn-primary-glow flex-1 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">{librarySubmitting ? "Adding…" : "Add to project"}</button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmitNew} className="flex flex-col gap-4">
            <GlassInput label="Full Name *" value={form.full_name} onChange={e=>setForm(f=>({...f,full_name:e.target.value}))} required placeholder="Jane Doe" />
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">Star rating (1–5) — primary quality signal</label>
              <Stars value={form.reliability} onChange={v=>setForm(f=>({...f,reliability:v}))} />
              <p className="text-[10px] text-muted-foreground mt-1">{STAR_RATING_LABELS[form.reliability] ?? form.reliability} — {form.reliability <= 3 ? "Risk" : "OK"}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <GlassInput label="Day Rate" type="number" value={form.day_rate} onChange={e=>setForm(f=>({...f,day_rate:e.target.value}))} min={0} placeholder="500" />
              <GlassSelect label="Tier (optional)" value={form.tier} onChange={e=>setForm(f=>({...f,tier:e.target.value}))}>
                {Object.keys(TIERS).map(t=><option key={t} value={t}>{t}</option>)}
              </GlassSelect>
            </div>
            <GlassInput label="Planned Days (≥ 0)" type="number" value={form.planned_days} onChange={e=>setForm(f=>({...f,planned_days:e.target.value}))} min={0} step={1} placeholder="1" />
            <GlassSelect label="Zone" value={zones.length ? form.zone : ''} onChange={e=>setForm(f=>({...f,zone:e.target.value}))} disabled={!zones.length}>
              {!zones.length ? <option value="">No zones yet — add in Settings</option> : zones.map(z=><option key={z} value={z}>{z}</option>)}
            </GlassSelect>
            {projectId && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={confirmImmediately} onChange={e=>setConfirmImmediately(e.target.checked)} className="accent-primary w-4 h-4 rounded" />
                <span className="text-xs font-semibold text-foreground">Confirm immediately</span>
              </label>
            )}
            <div className="flex gap-3 justify-end pt-2">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 transition-colors">Cancel</button>
              <button type="submit" className="btn-primary-glow flex-1 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">Add Operator</button>
            </div>
          </form>
        )}
    </GlassModal>
  );
}

// ─── ALL OPERATORS ────────────────────────────────────────────────────────────
const STATUS_PRIORITY = { Confirmed: 0, Approved: 1, "LOA Signed": 2, Offered: 3, Interviewing: 4, Screened: 5, Responded: 6, Outreach: 7, Passed: 8 };

function QuickConfirmDialog({ op, onConfirm, onCancel }) {
  if (!op) return null;
  return (
    <GlassModal open={true} onOpenChange={(open) => { if (!open) onCancel(); }} title="Confirm this operator now?" description={`${op.name || "—"} will be moved directly to Confirmed. Metrics will update immediately.`} className="max-w-[320px]">
      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl text-sm font-semibold border border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 transition-colors">Cancel</button>
        <button type="button" onClick={onConfirm} className="px-4 py-2 rounded-xl text-sm font-semibold bg-glow-green text-primary-foreground hover:opacity-90 transition-opacity">Confirm</button>
      </div>
    </GlassModal>
  );
}

function RatingChangeModal({ op, oldRating, newRating, onConfirm, onCancel }) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);
  const handleSubmit = (e) => {
    e.preventDefault();
    const r = (reason || "").trim();
    if (!r) { setErr("Reason is required"); return; }
    setErr(null);
    setSubmitting(true);
    onConfirm(r, () => setSubmitting(false));
  };
  if (!op) return null;
  const label = STAR_RATING_LABELS[newRating] ?? `${newRating}★`;
  return (
    <GlassModal open={true} onOpenChange={(open) => { if (!open) onCancel(); }} title="Star rating change" description={`${op.name || "—"} → ${newRating}★ (${label}). Provide a reason for audit.`} className="max-w-[360px]">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 pt-1">
        {err && <p className="text-sm text-destructive">{err}</p>}
        <div>
          <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">Reason for change (required)</label>
          <textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="e.g. Strong performance on last shoot"
            className="w-full min-h-[80px] px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y" required />
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl text-sm font-semibold border border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 transition-colors">Cancel</button>
          <button type="submit" disabled={submitting} className="px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity">{submitting ? "Saving…" : "Save rating"}</button>
        </div>
      </form>
    </GlassModal>
  );
}

function OpsTable({ zones = [], ops = [], onUpdate, onAddOperator, onRatingHistory }) {
  const [sort, setSort]         = useState("status");
  const [search, setSearch]     = useState("");
  const [stageF, setStageF]     = useState("All");
  const [zoneF, setZoneF]       = useState("All");
  const [credF, setCredF]       = useState("All");
  const [availabilityF, setAvailabilityF] = useState("All");
  const [selected, setSelected] = useState(null);
  const [pendingQuickConfirm, setPendingQuickConfirm] = useState(null);
  const [pendingRatingChange, setPendingRatingChange] = useState(null);

  const safe = o => {
    if (!o || typeof o !== 'object') return { id:0, opId:'—', name:'', tier:'T2', zone:'Floater', stage:'Outreach', cred:'Not Started', credType:'None', rate:0, reliability:3, risk:'LOW', loa:false, gear:[], source:'', workedWithMemeHouse:false, isBuffer:false, plannedDays:1, active:true, availabilityStatus:null, availableThrough:null, availabilityNote:null };
    return {
      id: o.id,
      opId: o.opId ?? o.op_id ?? `OP-${o.id}`,
      name: String(o.name ?? ''),
      tier: o.tier ?? 'T2',
      zone: String(o.zone ?? 'Floater'),
      stage: o.stage ?? 'Outreach',
      cred: o.cred ?? 'Not Started',
      credType: o.credType ?? 'None',
      rate: Number(o.rate) ?? 0,
      reliability: Number(o.reliability) ?? 3,
      risk: o.risk ?? 'LOW',
      loa: !!o.loa,
      gear: Array.isArray(o.gear) ? o.gear : [],
      source: String(o.source ?? ''),
      workedWithMemeHouse: !!o.workedWithMemeHouse,
      isBuffer: !!o.isBuffer,
      plannedDays: o.plannedDays ?? 1,
      active: o.active !== false,
      availabilityStatus: o.availabilityStatus ?? null,
      availableThrough: o.availableThrough ?? null,
      availabilityNote: o.availabilityNote ?? null,
    };
  };

  const list = (Array.isArray(ops) ? ops : []).map(safe);
  const q = (search || '').toLowerCase().trim();

  const filtered = list
    .filter(o=>{
      const ms = !q || (o.name || '').toLowerCase().includes(q) || String(o.id || '').includes(q) || (o.opId || '').toLowerCase().includes(q) || (o.zone || '').toLowerCase().includes(q);
      const mst = stageF==="All" || o.stage===stageF;
      const mz = zoneF==="All" || o.zone===zoneF;
      const mc = credF==="All" || o.cred===credF;
      const gear = Array.isArray(o.gear) ? o.gear : [];
      const mg = availabilityF==="All" || (availabilityF==="Broadcast" && isBroadcastQualified(o));
      return ms && mst && mz && mc && mg;
    })
    .sort((a,b)=>{
      if(sort==="status") {
        const pa = STATUS_PRIORITY[a.stage] ?? 99;
        const pb = STATUS_PRIORITY[b.stage] ?? 99;
        if (pa !== pb) return pa - pb;
      }
      if(sort==="name") return (a.name||'').localeCompare(b.name||'');
      if(sort==="rate") return (Number(b.rate)||0) - (Number(a.rate)||0);
      if(sort==="rel")  return (Number(b.reliability)||0) - (Number(a.reliability)||0);
      return String(a.id||a.opId||'').localeCompare(String(b.id||b.opId||''));
    });

  const op = list.find(o=>o.id===selected);

  const handleQuickConfirm = (operator) => {
    if ((operator?.stage ?? "") === "Confirmed") return;
    setPendingQuickConfirm(operator);
  };
  const commitQuickConfirm = () => {
    if (!pendingQuickConfirm) return;
    onUpdate(pendingQuickConfirm.id, { stage: "Confirmed" });
    setPendingQuickConfirm(null);
  };

  const cols = "80px 1fr 95px 90px 80px 100px 85px 55px 55px 72px";
  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {pendingQuickConfirm && (
        <QuickConfirmDialog
          op={pendingQuickConfirm}
          onConfirm={commitQuickConfirm}
          onCancel={() => setPendingQuickConfirm(null)}
        />
      )}
      {pendingRatingChange && onRatingHistory && (
        <RatingChangeModal
          op={pendingRatingChange.op}
          oldRating={pendingRatingChange.op.reliability ?? 3}
          newRating={pendingRatingChange.newRating}
          onConfirm={async (reason, done) => {
            try {
              await onRatingHistory(pendingRatingChange.op.id, { old_rating: pendingRatingChange.op.reliability ?? 3, new_rating: pendingRatingChange.newRating, reason });
              const u = { ...pendingRatingChange.op, reliability: pendingRatingChange.newRating };
              onUpdate(pendingRatingChange.op.id, { reliability: pendingRatingChange.newRating, risk: computeAutoRisk(u) });
            } finally { setPendingRatingChange(null); done?.(); }
          }}
          onCancel={() => setPendingRatingChange(null)}
        />
      )}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex-1 min-w-[160px]">
          <GlassInput label="" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, ID, zone..." className="!gap-0" />
        </div>
        <GlassSelect label="" value={stageF} onChange={e=>setStageF(e.target.value)} className="!gap-0 min-w-[100px] py-2">
          <option value="All">All Status</option>{HIRE_STAGES.map(s=><option key={s} value={s}>{s}</option>)}
        </GlassSelect>
        <GlassSelect label="" value={zoneF} onChange={e=>setZoneF(e.target.value)} className="!gap-0 min-w-[90px] py-2">
          <option value="All">All Zones</option>{zones.map(z=><option key={z} value={z}>{z}</option>)}
        </GlassSelect>
        <GlassSelect label="" value={credF} onChange={e=>setCredF(e.target.value)} className="!gap-0 min-w-[90px] py-2">
          <option value="All">All Cred</option>{CRED_STATES.map(c=><option key={c} value={c}>{c}</option>)}
        </GlassSelect>
        <GlassSelect label="" value={availabilityF} onChange={e=>setAvailabilityF(e.target.value)} className="!gap-0 min-w-[100px] py-2">
          <option value="All">All</option>
          <option value="Broadcast">📡 Broadcast</option>
        </GlassSelect>
        {["status","name","rate","rel"].map(s=>(
          <button key={s} type="button" onClick={()=>setSort(s)} className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${sort===s ? "glass text-primary border-primary/20" : "glass-subtle text-muted-foreground border-transparent hover:text-foreground"}`}>↕ {s==="rel"?"REL":s.toUpperCase()}</button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="glass-panel rounded-2xl p-10 text-center">
          <div className="text-sm font-medium text-foreground mb-2">No operators yet</div>
          <div className="text-sm text-muted-foreground mb-6">Add your first operator to get started</div>
          {onAddOperator && (
            <button type="button" onClick={onAddOperator} className="btn-primary-glow px-4 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
              + Add Operator
            </button>
          )}
        </div>
      ) : (
    <div className="flex gap-4 flex-1 min-w-0">
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        <GlassCard className="overflow-hidden !p-0">
          <div className="grid border-b border-[hsla(210,20%,93%,0.05)]" style={{gridTemplateColumns:cols}}>
            {["ID","Full Name","Stage","Zone","Day Rate","Credential","Availability","LOA","Risk",""].map(h=>(
              <span key={h || "actions"} className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-widest px-5 py-3.5">{h}</span>
            ))}
          </div>
          <div className="max-h-[490px] overflow-y-auto">
            {filtered.map((o,i)=>(
              <div
                key={o.id ?? o.opId ?? `op-${i}`}
                onClick={()=>setSelected(selected===o.id?null:o.id)}
                className={`grid border-b border-[hsla(210,20%,93%,0.03)] row-hover-glow cursor-pointer items-center transition-colors ${selected===o.id?"bg-white/[0.08]":o.cred==="Denied"?"bg-destructive/20":o.isBuffer?"bg-white/[0.03]":""}`}
                style={{gridTemplateColumns:cols}}
              >
                <span className="px-5 py-4 text-[10px] text-muted-foreground font-mono truncate">{o.opId ?? o.id}</span>
                <div className="px-5 py-4 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{o.name || '—'}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{o.workedWithMemeHouse?"✓ Alumni":o.source||''}{isBroadcastQualified(o)?" · 📡":""}</div>
                </div>
                <div className="px-5 py-4"><HudBadge label={o.stage} color={STAGE_COLORS[o.stage]||"#64748b"} small /></div>
                <span className="px-5 py-4 text-[10px] text-muted-foreground truncate">{o.zone}</span>
                <span className="px-5 py-4 text-[10px] text-glow-green font-semibold">${o.rate ?? 0}</span>
                <div className="px-5 py-4"><HudBadge label={o.cred} color={CRED_COLORS[o.cred]||"#64748b"} small /></div>
                <div className="px-5 py-4">
                  {(o.availabilityStatus && AVAILABILITY_BADGE[o.availabilityStatus]) ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border border-current/30" style={{ color: AVAILABILITY_BADGE[o.availabilityStatus].color }}>{AVAILABILITY_BADGE[o.availabilityStatus].label}</span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">—</span>
                  )}
                </div>
                <span className={`px-5 py-4 text-[10px] font-medium ${o.loa?"text-glow-green":"text-muted-foreground"}`}>{o.loa?"✓":""}</span>
                <div className="px-5 py-4">{isRiskByStars(o) ? <Tag label="Risk" color="#f59e0b" small/> : <span className="text-[10px] text-muted-foreground">OK</span>}</div>
                <div className="px-5 py-4 flex items-center">
                  {o.stage !== "Confirmed" && (
                    <button type="button" onClick={e=>{ e.stopPropagation(); handleQuickConfirm(o); }} className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold bg-glow-green/20 text-glow-green border border-glow-green/40 hover:opacity-90 transition-opacity whitespace-nowrap" title="Mark confirmed">Confirm</button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="px-5 py-3 border-t border-white/[0.06] text-[10px] text-muted-foreground">
            {filtered.length} of {list.length} operators
          </div>
        </GlassCard>
      </div>

      {op && (
        <div className="w-[268px] flex-shrink-0 flex flex-col gap-4 max-h-[82vh] overflow-y-auto rounded-2xl border border-white/[0.06] bg-white/[0.06] backdrop-blur-xl p-5 shadow-[0_24px_80px_hsla(0,0%,0%,0.4)]">
          <div>
            <div className="text-[10px] text-muted-foreground font-mono mb-1">{op.id}</div>
            <div className="text-base font-bold text-foreground mb-2">{op.name}</div>
            <div className="flex gap-2 flex-wrap items-center">
              <span className="text-sm font-medium">{op.reliability != null ? `${op.reliability}★` : "—"}</span>
              {isRiskByStars(op) && <Tag label="Risk" color="#f59e0b" small />}
              <span className="text-[10px] text-muted-foreground">· Tier {op.tier || "—"}</span>
              {op.workedWithMemeHouse && <Tag label="MH Alumni" color="#22c55e"/>}
              {op.isBuffer && <Tag label="BUFFER" color="#a855f7"/>}
            </div>
          </div>

          <div className="border-t border-white/[0.06] pt-4">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Star rating · Risk</div>
            <Stars value={op.reliability} onChange={v=>{ if (onRatingHistory) setPendingRatingChange({ op, newRating: v }); else { const u={...op,reliability:v}; onUpdate(op.id,{reliability:v,risk:computeAutoRisk(u)}); } }} />
            <div className="mt-3 flex gap-2 items-center">
              {isRiskByStars(op) ? <Tag label="Risk (≤3★)" color="#f59e0b" small /> : <span className="text-[10px] text-muted-foreground">OK</span>}
            </div>
            <div className="mt-3 flex flex-col gap-2">
              {[["lateToScreen","Late to Screening"],["rateInstability","Rate Instability"],["workedWithMemeHouse","Worked w/ MemeHouse"]].map(([k,l])=>(
                <label key={k} className="flex gap-2 items-center cursor-pointer">
                  <input type="checkbox" checked={op[k]||false}
                    onChange={e=>{const u={...op,[k]:e.target.checked};onUpdate(op.id,{[k]:e.target.checked,risk:computeAutoRisk(u)});}}
                    className="accent-primary w-4 h-4 rounded"/>
                  <span className={`text-xs font-semibold ${op[k]?(k==="workedWithMemeHouse"?"text-glow-green":"text-amber-400"):"text-muted-foreground"}`}>{l}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="border-t border-white/[0.06] pt-4">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">GEAR FAMILIARITY</div>
            <div className="flex gap-2 flex-wrap">
              {GEAR_TAGS.map(g=>(
                <GearChip key={g} label={g} active={(Array.isArray(op.gear) ? op.gear : []).includes(g)}
                  onClick={()=>{
                    const arr = Array.isArray(op.gear) ? op.gear : []; const gear=arr.includes(g)?arr.filter(x=>x!==g):[...arr,g];
                    onUpdate(op.id,{gear});
                  }}/>
              ))}
            </div>
            {isBroadcastQualified(op) && <div className="mt-2 text-[10px] text-glow-cyan font-semibold">📡 LIVE BROADCAST QUALIFIED</div>}
          </div>

          <div className="border-t border-white/[0.06] pt-4 flex flex-col gap-4">
            {[
              {label:"Credential Status", field:"cred", opts:CRED_STATES},
              {label:"Credential Type",   field:"credType", opts:CRED_TYPES},
            ].map(({label,field,opts})=>(
              <GlassSelect key={field} label={label} value={op[field]} onChange={e=>onUpdate(op.id,{[field]:e.target.value})}>
                {opts.map(s=><option key={s} value={s}>{s}</option>)}
              </GlassSelect>
            ))}

            <div>
              <GlassSelect label="Zone" value={op.zone} onChange={e=>{
                const chk=canAssignToZone(op,e.target.value);
                if(!chk.ok){alert(`⚠ Deployment blocked: ${chk.reason}`);return;}
                onUpdate(op.id,{zone:e.target.value});
              }}>
                {(zones.length ? zones : []).map(z=><option key={z} value={z}>{z}</option>)}
              </GlassSelect>
              {!canAssignToZone(op,op.zone).ok && <div className="text-[10px] text-destructive font-semibold mt-1.5">⚠ {canAssignToZone(op,op.zone).reason}</div>}
            </div>

            <div>
              <GlassSelect label="Hire Stage" value={op.stage} onChange={e=>onUpdate(op.id,{stage:e.target.value})}>
                {HIRE_STAGES.map(s=><option key={s} value={s}>{s}</option>)}
              </GlassSelect>
              {op.stage !== "Confirmed" && (
                <button type="button" onClick={() => handleQuickConfirm(op)} className="w-full mt-2 py-2 rounded-xl text-xs font-semibold bg-glow-green text-primary-foreground hover:opacity-90 transition-opacity">Confirm now</button>
              )}
            </div>
            <div>
              <GlassInput label="Planned Days" type="number" min={0} value={op.planned_days ?? op.plannedDays ?? 0}
                onChange={(e) => {
                  const v = parseInt(e.target.value || "0", 10);
                  onUpdate(op.id, { planned_days: Number.isFinite(v) ? Math.max(0, v) : 0 });
                }} />
              <div className="text-[11px] text-muted-foreground mt-1">Used for committed cost calc</div>
            </div>
          </div>

          <div className="border-t border-white/[0.06] pt-4 flex flex-col gap-3">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Availability</div>
            <GlassSelect label="Availability Status" value={op.availabilityStatus ?? ''} onChange={e=>onUpdate(op.id,{availabilityStatus:e.target.value||null})}>
              <option value="">—</option>
              {AVAILABILITY_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
            </GlassSelect>
            {(op.availabilityStatus==='Partial'||op.availabilityStatus==='Unavailable') && (
              <GlassInput label="Available Through" type="date" value={op.availableThrough??''} onChange={e=>onUpdate(op.id,{availableThrough:e.target.value||null})} />
            )}
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">Availability Note</label>
              <textarea value={op.availabilityNote??''} onChange={e=>onUpdate(op.id,{availabilityNote:e.target.value||null})} placeholder="Optional note"
                className="w-full min-h-[72px] px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y" />
            </div>
          </div>

          <div className="border-t border-white/[0.06] pt-4">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">CHECKLIST</div>
            <div className="flex flex-col gap-2">
              {[["reel","Portfolio Reviewed"],["refs","References Verified"],["loa","LOA Signed"],["w9","W9 Collected"]].map(([k,l])=>(
                <label key={k} className="flex gap-2 items-center cursor-pointer">
                  <input type="checkbox" checked={op[k]||false} onChange={e=>onUpdate(op.id,{[k]:e.target.checked})} className="accent-primary w-4 h-4 rounded"/>
                  <span className={`text-xs font-semibold ${op[k]?"text-glow-green":"text-muted-foreground"}`}>{l}</span>
                </label>
              ))}
            </div>
          </div>

          {(op.perfScore!==null||op.stage==="Passed") && (
            <div className="border-t border-white/[0.06] pt-4">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">POST-EVENT</div>
              <Stars value={op.perfScore||0} onChange={v=>onUpdate(op.id,{perfScore:v})}/>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={()=>onUpdate(op.id,{rehireEligible:true})} className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${op.rehireEligible===true?"bg-glow-green text-primary-foreground":"glass-subtle text-muted-foreground border border-transparent hover:text-foreground"}`}>✓ Rehire</button>
                <button type="button" onClick={()=>onUpdate(op.id,{rehireEligible:false})} className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${op.rehireEligible===false?"bg-destructive/20 text-destructive border border-destructive/30":"glass-subtle text-muted-foreground border border-transparent hover:text-foreground"}`}>✗ No Rehire</button>
              </div>
            </div>
          )}

          <div className="border-t border-white/[0.06] pt-4">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">ARCHIVE</div>
            <button
              type="button"
              onClick={() => { onUpdate(op.id, { isArchived: true }); setSelected(null); }}
              className="w-full py-2.5 rounded-xl text-sm font-semibold border border-white/10 glass-subtle text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
            >
              Archive Operator
            </button>
            <div className="text-[10px] text-muted-foreground mt-2">Removes from Hiring Pipeline; keeps record.</div>
          </div>
        </div>
      )}
    </div>
      )}
    </div>
  );
}

// ─── DB SCHEMA ────────────────────────────────────────────────────────────────

function SchemaView() {
  const tables = [
    { name:"CREW_OPERATORS", color:"#6366f1", fields:[
      {n:"op_id",t:"PK",d:"OP-001…OP-062"},
      {n:"tier / stage / zone",t:"select",d:"T1–T4 / Outreach→Confirmed / 10 zones"},
      {n:"cred_status",t:"status",d:"Not Started → Approved / Denied"},
      {n:"cred_type",t:"select",d:"None / House-Only / Guest / Vendor / Artist / Festival Grounds"},
      {n:"day_rate",t:"number",d:"Max $600 — validated on input"},
      {n:"reliability",t:"1–5",d:"Manual score — primary risk driver"},
      {n:"worked_w_memehouse",t:"bool",d:"Reduces risk weight"},
      {n:"late_to_screen",t:"bool",d:"Auto-triggers HIGH risk"},
      {n:"rate_instability",t:"bool",d:"Auto-triggers HIGH risk"},
      {n:"gear_tags",t:"multi",d:"TVU / LiveU / IRL Backpack / FX6 / PTZ / Comms / Multi-cam"},
      {n:"risk",t:"computed",d:"AUTO: logic on reliability + flags + cred"},
      {n:"is_buffer",t:"bool",d:"20% over-request pool flag"},
      {n:"reel/refs/loa/w9",t:"bool×4",d:"Checklist progress"},
      {n:"perf_score",t:"1–5",d:"Post-event rating"},
      {n:"rehire_eligible",t:"bool",d:"Feeds FESTIVAL_ROSTER_DB"},
      {n:"post_notes",t:"text",d:"PM free-form notes"},
    ]},
    { name:"DEPLOYMENT_ZONES", color:"#22c55e", fields:[
      {n:"zone_id",t:"PK",d:"ZONE-01…10"},
      {n:"zone_name",t:"text",d:"House 1–8 / Festival / Floater"},
      {n:"restricted",t:"bool",d:"Festival = true, all others false"},
      {n:"allowed_cred_types",t:"multi",d:"Artist / Vendor / Festival Grounds (festival only)"},
      {n:"min_ops / target_ops",t:"number",d:"Staffing floor and ideal"},
      {n:"status",t:"computed",d:"READY / PARTIAL / UNASSIGNED"},
      {n:"violations",t:"computed",d:"Count of ops without valid access"},
    ]},
    { name:"CREDENTIALS", color:"#0ea5e9", fields:[
      {n:"cred_id",t:"PK",d:"CRED-001…"},
      {n:"op_id",t:"FK",d:"→ CREW_OPERATORS (1:1)"},
      {n:"cred_type",t:"select",d:"Badge category — gates zone assignment"},
      {n:"submit_date",t:"date",d:"Day 36 hard deadline"},
      {n:"approve_date",t:"date",d:"Expected Day 43–46"},
      {n:"status",t:"status",d:"Tracks through approval/denial"},
      {n:"backup_op_id",t:"FK",d:"→ CREW_OPERATORS (assigned on denial)"},
      {n:"risk",t:"computed",d:"Based on status + zone restriction"},
    ]},
    { name:"FESTIVAL_ROSTER_DB", color:"#f59e0b", fields:[
      {n:"record_id",t:"PK",d:"Persistent — survives event close"},
      {n:"op_id",t:"FK",d:"→ CREW_OPERATORS"},
      {n:"event_name",t:"text",d:"e.g. Coachella 2026 W1"},
      {n:"perf_score",t:"1–5",d:"Post-event performance"},
      {n:"rehire_eligible",t:"bool",d:"Y/N for future booking"},
      {n:"reliability_at_event",t:"1–5",d:"Snapshot — doesn't change"},
      {n:"gear_used",t:"multi",d:"Equipment actually operated"},
      {n:"zones_worked",t:"multi",d:"All zones covered during event"},
      {n:"cred_type_at_event",t:"text",d:"Badge type for record"},
      {n:"post_notes",t:"text",d:"PM post-mortem — visible future events"},
    ]},
  ];

  const tableBorderMap = { "#6366f1":"border-t-glow-violet/40", "#22c55e":"border-t-glow-green/40", "#0ea5e9":"border-t-glow-cyan/40", "#f59e0b":"border-t-glow-amber/40" };
  const typeColorMap = { PK:"text-amber-400", FK:"text-glow-violet", computed:"text-glow-cyan" };

  return (
    <div className="min-h-full grid-bg content-glow">
      <div className="px-6 lg:px-10 py-10 max-w-[1400px] mx-auto flex flex-col gap-6 animate-fade-in w-full">
        <h1 className="text-2xl font-bold tracking-tight text-heading-glow">DB Schema</h1>
        <p className="text-sm text-muted-foreground -mt-2 mb-1">Relational map and field reference</p>
        <GlassCard className="p-5 border-glow-cyan/20">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-glow-cyan mb-1">Schema v2 — Relational map</div>
          <p className="text-sm text-muted-foreground">CREW_OPERATORS ←→ CREDENTIALS (1:1) · CREW_OPERATORS → DEPLOYMENT_ZONES (many:1, protected) · On review: CREW_OPERATORS → FESTIVAL_ROSTER_DB (persistent, reusable)</p>
        </GlassCard>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {tables.map(table=>(
            <GlassCard key={table.name} className={`overflow-hidden !p-0 border-t-4 ${tableBorderMap[table.color]||""}`}>
              <div className="px-4 py-3 border-b border-white/[0.06] bg-white/[0.03]">
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{color:table.color}}>{table.name}</span>
              </div>
              <div>
                {table.fields.map(f=>(
                  <div key={f.n} className="grid grid-cols-[150px_65px_1fr] gap-3 px-4 py-2.5 border-b border-white/[0.04] items-center text-sm">
                    <span className={`font-mono font-semibold text-[10px] ${typeColorMap[f.t]||"text-muted-foreground"}`}>{f.n}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full glass-subtle text-muted-foreground font-semibold text-center">{f.t}</span>
                    <span className="text-[10px] text-muted-foreground">{f.d}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── PROJECT DASHBOARD (project-scoped; view from URL) ─────────────────────────

function ProjectDashboard() {
  const { projectId, view: viewParam } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { project, touchProject, updateProjectStatus, updateProject, addProject, setProjectId } = useProject();
  const view = viewParam || "executive";
  const zones = project?.zones ?? [];

  const [ops, setOps]       = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [shiftsForBurn, setShiftsForBurn] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const [saving, setSaving] = useState(false);
  const [statsInvalidateKey, setStatsInvalidateKey] = useState(0);
  const [stats, setStats] = useState(null);
  const [event, setEvent] = useState(null);
  const [statsError, setStatsError] = useState(null);
  const [showAddOpModal, setShowAddOpModal] = useState(false);

  useEffect(() => {
    if (location.state?.openAddOperator) {
      setShowAddOpModal(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state?.openAddOperator, location.pathname, navigate]);
  const [operatorFilter, setOperatorFilter] = useState('active'); // 'active' | 'archived' | 'all'
  const [navOpen, setNavOpen] = useState(false);
  const [countdownTick, setCountdownTick] = useState(() => Date.now());
  const [endProjectModalOpen, setEndProjectModalOpen] = useState(false);
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const isMobile = useIsMobile();
  const invalidateStats = useCallback(() => setStatsInvalidateKey(k => k + 1), []);

  // Countdown label: refresh hourly so "X DAY SPRINT" updates without reload
  useEffect(() => {
    const id = setInterval(() => setCountdownTick(Date.now()), 60 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const eventStart = project?.eventStartISO ?? event?.start_date;
  const sprintLabel = eventStart ? getSprintLabel(eventStart) : "—";

  // Refetch stats when projectId or invalidate key changes. Pass projectId so stats are project-scoped; clear stats on project switch to avoid showing previous project's data.
  useEffect(() => {
    let cancelled = false;
    setStatsError(null);
    setStats(null); // clear so we don't show previous project's metrics while loading
    (async () => {
      try {
        const [s, e] = await Promise.all([api.getStats(projectId), api.getEvent()]);
        if (!cancelled) { setStats(s); setEvent(e); }
      } catch (err) {
        console.error('Stats fetch failed:', err?.message ?? err);
        if (!cancelled) setStatsError(err?.message || 'Failed to refresh stats');
        if (!cancelled) setStats(null); // avoid showing stale project data on error
      }
    })();
    return () => { cancelled = true; };
  }, [projectId, statsInvalidateKey]);

  const handleAddOperator = useCallback(async (data) => {
    if (projectId && (data.operator_id != null || data.operatorId != null)) {
      // Assign existing operator to project
      const assigned = await api.assignOperatorToProject(projectId, {
        operator_id: data.operator_id ?? data.operatorId,
        project_day_rate: data.project_day_rate ?? data.day_rate,
        zone: data.zone,
        hire_stage: data.hire_stage ?? 'Outreach',
        cred_status: data.cred_status ?? 'Not Started',
        cred_type: data.cred_type ?? 'None',
        planned_days: data.planned_days ?? 1,
        tier: data.tier ?? 'T2',
      });
      const o = assigned;
      const         normalized = {
        id: o.id,
        projectOperatorId: o.project_operator_id ?? null,
        opId: o.op_id ?? `OP-${o.id}`,
        name: o.full_name ?? '',
        tier: o.tier ?? 'T2',
        zone: o.zone ?? 'Floater',
        stage: o.hire_stage ?? 'Outreach',
        cred: o.cred_status ?? 'Not Started',
        credType: o.cred_type ?? 'None',
        rate: Number(o.day_rate) || 0,
        plannedDays: o.planned_days ?? 1,
        source: o.source ?? '',
        isBuffer: !!o.is_buffer,
        phone: o.phone ?? '',
        reel: !!o.reel,
        refs: !!o.refs,
        loa: !!o.loa,
        w9: !!o.w9,
        reliability: Number(o.reliability) || 3,
        workedWithMemeHouse: !!o.worked_with_memehouse,
        lateToScreen: !!o.late_to_screen,
        rateInstability: !!o.rate_instability,
        gear: Array.isArray(o.gear) ? o.gear : [],
        perfScore: o.perf_score ?? null,
        rehireEligible: o.rehire_eligible ?? null,
        postNotes: o.post_notes ?? '',
        active: o.active !== false,
        isArchived: !!o.is_archived,
        risk: o.risk ?? 'LOW',
        availabilityStatus: o.availability_status ?? null,
        availableThrough: o.available_through ?? null,
        availabilityNote: o.availability_note ?? null,
        availabilityUpdatedBy: o.availability_updated_by ?? null,
        availabilityUpdatedAt: o.availability_updated_at ?? null,
      };
      setOps(prev => [...prev, normalized]);
      invalidateStats();
      if (projectId) touchProject(projectId);
      return;
    }
    const created = await api.addOperator(data);
    if (!projectId) {
      const o = created;
      const normalized = {
        id: o.id,
        projectOperatorId: null,
        opId: o.op_id ?? `OP-${o.id}`,
        name: o.full_name ?? '',
        tier: o.tier ?? 'T2',
        zone: o.zone ?? 'Floater',
        stage: o.hire_stage ?? 'Outreach',
        cred: o.cred_status ?? 'Not Started',
        credType: o.cred_type ?? 'None',
        rate: Number(o.day_rate) || 0,
        plannedDays: o.planned_days ?? 1,
        source: o.source ?? '',
        isBuffer: !!o.is_buffer,
        phone: o.phone ?? '',
        reel: !!o.reel,
        refs: !!o.refs,
        loa: !!o.loa,
        w9: !!o.w9,
        reliability: Number(o.reliability) || 3,
        workedWithMemeHouse: !!o.worked_with_memehouse,
        lateToScreen: !!o.late_to_screen,
        rateInstability: !!o.rate_instability,
        gear: Array.isArray(o.gear) ? o.gear : [],
        perfScore: o.perf_score ?? null,
        rehireEligible: o.rehire_eligible ?? null,
        postNotes: o.post_notes ?? '',
        active: o.active !== false,
        isArchived: !!o.is_archived,
        risk: o.risk ?? 'LOW',
        availabilityStatus: null,
        availableThrough: null,
        availabilityNote: null,
        availabilityUpdatedBy: null,
        availabilityUpdatedAt: null,
      };
      setOps(prev => [...prev, normalized]);
      invalidateStats();
      if (projectId) touchProject(projectId);
      return;
    }
    const assigned = await api.assignOperatorToProject(projectId, {
      operator_id: created.id,
      project_day_rate: data.day_rate ?? created.day_rate,
      zone: data.zone,
      hire_stage: data.hire_stage ?? 'Outreach',
      cred_status: data.cred_status ?? 'Not Started',
      cred_type: data.cred_type ?? 'None',
      planned_days: data.planned_days ?? 1,
      tier: data.tier ?? 'T2',
    });
    const o = assigned;
    const normalized = {
      id: o.id,
      projectOperatorId: o.project_operator_id ?? null,
      opId: o.op_id ?? `OP-${o.id}`,
      name: o.full_name ?? '',
      tier: o.tier ?? 'T2',
      zone: o.zone ?? 'Floater',
      stage: o.hire_stage ?? 'Outreach',
      cred: o.cred_status ?? 'Not Started',
      credType: o.cred_type ?? 'None',
      rate: Number(o.day_rate) || 0,
      plannedDays: o.planned_days ?? 1,
      source: o.source ?? '',
      isBuffer: !!o.is_buffer,
      phone: o.phone ?? '',
      reel: !!o.reel,
      refs: !!o.refs,
      loa: !!o.loa,
      w9: !!o.w9,
      reliability: Number(o.reliability) || 3,
      workedWithMemeHouse: !!o.worked_with_memehouse,
      lateToScreen: !!o.late_to_screen,
      rateInstability: !!o.rate_instability,
      gear: Array.isArray(o.gear) ? o.gear : [],
      perfScore: o.perf_score ?? null,
      rehireEligible: o.rehire_eligible ?? null,
      postNotes: o.post_notes ?? '',
      active: o.active !== false,
      isArchived: !!o.is_archived,
      risk: o.risk ?? 'LOW',
      availabilityStatus: o.availability_status ?? null,
      availableThrough: o.available_through ?? null,
      availabilityNote: o.availability_note ?? null,
      availabilityUpdatedBy: o.availability_updated_by ?? null,
      availabilityUpdatedAt: o.availability_updated_at ?? null,
    };
    setOps(prev => [...prev, normalized]);
    invalidateStats();
    if (projectId) touchProject(projectId);
  }, [invalidateStats, projectId, touchProject]);

  // Touch project when operators/shifts/creds change so list sorts by most recently edited
  const onShiftMutated = useCallback(() => {
    invalidateStats();
    if (projectId) touchProject(projectId);
  }, [invalidateStats, projectId, touchProject]);

  // ─── LOAD DATA ──────────────────────────────────────────────────────────────
  const loadOps = useCallback(async () => {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 10000);
      const includeArchived = operatorFilter !== 'active';
      const q = new URLSearchParams();
      if (projectId != null && projectId !== '') q.set('project_id', projectId);
      if (includeArchived) q.set('includeArchived', 'true');
      const data = await fetch(
        `${API}/api/operators${q.toString() ? '?' + q.toString() : ''}`,
        { signal: ctrl.signal, headers: { 'Content-Type': 'application/json' } }
      ).then(r => r.ok ? r.json() : Promise.reject(new Error(String(r.status))));
      clearTimeout(t);
      const arr = Array.isArray(data) ? data : (data?.operators || []);
      if (!Array.isArray(arr)) {
        console.error('[loadOps] Unexpected response shape:', typeof data, Object.keys(data || {}));
        setOps([]);
      } else {
        setOps(arr.map(o => ({
          id: o.id,
          projectOperatorId: o.project_operator_id ?? null,
          opId: o.op_id ?? `OP-${o.id}`,
          name: o.full_name ?? '',
          tier: o.tier ?? 'T2',
          zone: o.zone ?? 'Floater',
          stage: o.hire_stage ?? 'Outreach',
          cred: o.cred_status ?? 'Not Started',
          credType: o.cred_type ?? 'None',
          rate: Number(o.day_rate) || 0,
          plannedDays: o.planned_days ?? 1,
          source: o.source ?? '',
          isBuffer: !!o.is_buffer,
          phone: o.phone ?? '',
          reel: !!o.reel,
          refs: !!o.refs,
          loa: !!o.loa,
          w9: !!o.w9,
          reliability: Number(o.reliability) || 3,
          workedWithMemeHouse: !!o.worked_with_memehouse,
          lateToScreen: !!o.late_to_screen,
          rateInstability: !!o.rate_instability,
          gear: Array.isArray(o.gear) ? o.gear : (o.gear ? [].concat(o.gear) : []),
          perfScore: o.perf_score ?? null,
          rehireEligible: o.rehire_eligible ?? null,
          postNotes: o.post_notes ?? '',
          active: o.active !== false,
          isArchived: !!o.is_archived,
          risk: o.risk ?? computeAutoRisk({ cred: o.cred_status, reliability: o.reliability, worked_with_memehouse: o.worked_with_memehouse, refs: o.refs, reel: o.reel, late_to_screen: o.late_to_screen, rate_instability: o.rate_instability, zone: o.zone }),
          availabilityStatus: o.availability_status ?? null,
          availableThrough: o.available_through ?? null,
          availabilityNote: o.availability_note ?? null,
          availabilityUpdatedBy: o.availability_updated_by ?? null,
          availabilityUpdatedAt: o.availability_updated_at ?? null,
        })));
      }
    } catch (err) {
      console.error('[loadOps] API failed:', err?.message, err);
      setError(err?.message || 'Failed to connect to server. Check console for details.');
      setOps([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, operatorFilter]);

  useEffect(() => { loadOps(); }, [loadOps]);
  useEffect(() => { setExpenses(getExpenses(projectId || '')); }, [projectId]);
  useEffect(() => {
    if (!projectId) { setShiftsForBurn([]); return; }
    api.getShifts({ project_id: projectId })
      .then((data) => setShiftsForBurn(Array.isArray(data) ? data : []))
      .catch(() => setShiftsForBurn([]));
  }, [projectId, statsInvalidateKey]);

  useEffect(() => {
    if ((view === 'ops' || view === 'emergency') && projectId) navigate(`/p/${projectId}/executive`, { replace: true });
  }, [view, projectId, navigate]);

  const committedStages = project ? getCommittedStages(project) : ["Confirmed"];

  // Labor within project date window (for Daily Burn only): closed shifts whose date is in [eventStart, min(today, eventEnd)]
  const laborWithinProjectWindow = useMemo(() => {
    const start = (project?.eventStartISO || "").slice(0, 10);
    if (!start) return 0;
    const today = new Date().toISOString().slice(0, 10);
    const end = (project?.eventEndISO || "").slice(0, 10);
    const windowEnd = !end || end > today ? today : end;
    let sum = 0;
    for (const s of shiftsForBurn) {
      if (s.end_time == null) continue;
      const d = (s.date || (s.start_time && String(s.start_time).slice(0, 10)) || "").slice(0, 10);
      if (!d || d < start || d > windowEnd) continue;
      const pay = s.total_pay != null && !Number.isNaN(Number(s.total_pay)) ? Number(s.total_pay) : null;
      if (pay != null) sum += pay;
    }
    return Math.round(sum);
  }, [shiftsForBurn, project?.eventStartISO, project?.eventEndISO]);

  // Dev-only: verify committed labor is derived from state (no drift after stage changes)
  useEffect(() => {
    if (import.meta.env.DEV && Array.isArray(ops)) {
      const derived = calculateCommittedLabor(ops, event, committedStages);
      console.debug('[committedLabor] derived from ops:', derived);
    }
  }, [ops, event, committedStages]);

  const updateOp = async (id, updates) => {
    const op = ops.find(o => o.id === id);
    const projectOperatorId = op?.projectOperatorId;
    // Optimistic update
    setOps(prev => prev.map(o => {
      if (o.id !== id) return o;
      const updated = { ...o, ...updates };
      if (["reliability","workedWithMemeHouse","lateToScreen","rateInstability","refs","cred"].some(k=>k in updates)) {
        updated.risk = computeAutoRisk(updated);
      }
      return updated;
    }));
    const poKeyMap = { rate:'project_day_rate', stage:'hire_stage', cred:'cred_status', credType:'cred_type', plannedDays:'planned_days', zone:'zone', tier:'tier', availabilityStatus:'availability_status', availableThrough:'available_through', availabilityNote:'availability_note', availabilityUpdatedBy:'availability_updated_by' };
    const opKeyMap = {
      stage:'hire_stage', cred:'cred_status', credType:'cred_type', rate:'day_rate', plannedDays:'planned_days',
      reliability:'reliability', workedWithMemeHouse:'worked_with_memehouse', lateToScreen:'late_to_screen',
      rateInstability:'rate_instability', isBuffer:'is_buffer', postNotes:'post_notes',
      perfScore:'perf_score', rehireEligible:'rehire_eligible', name:'full_name', phone:'phone', zone:'zone', active:'active', isArchived:'is_archived',
    };
    const poUpdates = {};
    const opUpdates = {};
    Object.entries(updates).forEach(([k, v]) => {
      if (poKeyMap[k] !== undefined && projectId && projectOperatorId) poUpdates[poKeyMap[k]] = v;
      if (opKeyMap[k] !== undefined) opUpdates[opKeyMap[k]] = v;
    });
    try {
      if (projectId && projectOperatorId && Object.keys(poUpdates).length) {
        await api.updateProjectOperator(projectId, projectOperatorId, poUpdates);
      }
      if (Object.keys(opUpdates).length) {
        await api.updateOperator(id, opUpdates);
      }
      await loadOps();
      invalidateStats();
      if (projectId) touchProject(projectId);
    } catch (err) { console.error('Update failed:', err); }
  };

  const MAIN_VIEWS = [
    { id: "executive", label: "Executive", icon: LayoutDashboard },
    { id: "deploy", label: "Deployment", icon: FolderOpen },
    { id: "expenses", label: "Expenses", icon: Receipt },
    { id: "shifts", label: "Shifts", icon: Clock },
  ];
  const CREW_VIEWS = [
    { id: "operators", label: "Operators", icon: Users },
    { id: "creds", label: "Credentials", icon: FileCheck },
  ];
  const MORE_VIEWS = [
    { id: "kanban", label: "Hiring Pipeline", icon: Columns3 },
    { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
    { id: "postevent", label: "Post-Event", icon: FileText },
    { id: "schema", label: "DB Schema", icon: Database },
  ];

  const highRiskCount   = ops.filter(o=>o.risk==="HIGH").length;

  const lovableNavSections = useMemo(() => [
    { label: "Main", links: MAIN_VIEWS.map((v) => ({ to: `/p/${projectId}/${v.id}`, label: v.label, icon: v.icon })) },
    { label: "Crew", links: CREW_VIEWS.map((v) => ({ to: `/p/${projectId}/${v.id}`, label: v.label, icon: v.icon })) },
    { label: "More", links: MORE_VIEWS.map((v) => ({ to: `/p/${projectId}/${v.id}`, label: v.label, icon: v.icon })) },
  ], [projectId]);
  const lovableNavLinks = useMemo(() => [
    ...MAIN_VIEWS.map((v) => ({ to: `/p/${projectId}/${v.id}`, label: v.label, icon: v.icon })),
    ...CREW_VIEWS.map((v) => ({ to: `/p/${projectId}/${v.id}`, label: v.label, icon: v.icon })),
    ...MORE_VIEWS.map((v) => ({ to: `/p/${projectId}/${v.id}`, label: v.label, icon: v.icon })),
  ], [projectId]);

  if (!project) return <Navigate to="/projects" replace />;

  if (loading) return (
    <div className="dark min-h-screen text-foreground flex items-center justify-center">
      <div className="glass-panel rounded-2xl p-8 text-center max-w-sm">
        <div className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4">Loading…</div>
        <div className="w-24 h-1 bg-white/[0.08] rounded-full overflow-hidden mx-auto">
          <div className="h-full w-1/3 bg-primary rounded-full animate-pulse" style={{animationDuration:"1.5s"}}/>
        </div>
      </div>
    </div>
  );

  return (
    <div className="dark min-h-screen text-foreground">
      <div className="hidden md:block">
        <LovableSidebar navSections={lovableNavSections} logoSub={project?.name ? `${project.name} — ${sprintLabel}` : "Ops Studio"} />
      </div>
      <LovableMobileNav links={lovableNavLinks} />
      <main className="md:ml-[260px] min-h-screen flex flex-col">
      {error && (
        <div className="flex items-center justify-between flex-wrap gap-3 px-4 py-3 md:px-6 border-b border-destructive/30 bg-destructive/10">
          <span className="text-sm text-destructive/90">⚠ {error}</span>
          <div className="flex gap-2">
            <button type="button" onClick={()=>{setError(null);setLoading(true);loadOps();}} className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity">Retry</button>
            <button type="button" onClick={()=>setError(null)} className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-destructive/50 text-destructive/90 hover:bg-destructive/10 transition-colors">Dismiss</button>
          </div>
        </div>
      )}
      <style>{`
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:var(--hud-bg)}
        ::-webkit-scrollbar-thumb{background:var(--hud-border-strong);border-radius:3px}
        select option{background:var(--hud-input-bg);color:var(--hud-text)}
        .modal-panel{ max-width: 420px; width: 100%; max-height: 90vh; overflow-y: auto; }
        @media (max-width:480px){ .modal-panel{ max-width: none; margin: 12px; max-height: calc(100vh - 24px); } }
        .app-content-inner--fill{ display: flex !important; flex-direction: column !important; overflow: hidden !important; }
      `}</style>

      <div
        className={`flex-shrink-0 flex gap-3 items-center flex-wrap px-4 py-3 md:px-6 sidebar-glass ${view === "kanban" || view === "deploy" ? "strip-no-divider" : "border-b border-white/[0.08]"}`}
        style={view === "kanban" || view === "deploy" ? { border: "none", borderBottom: "none" } : undefined}
      >
        <span className="text-[10px] text-muted-foreground">Full access — all fields editable</span>
        {project?.status && <ProjectStatusBadge status={project.status} />}
        <span className="ml-auto text-[10px] text-muted-foreground">
          {ops.filter(o=>o.stage==="Confirmed").length} confirmed · {ops.filter(o=>o.cred==="Approved").length} credentialed · <span className="text-destructive font-bold">{highRiskCount} high-risk</span>
        </span>
        {project && project.status !== "completed" && project.status !== "archived" && (
          <>
            <button type="button" onClick={() => setShowEditProjectModal(true)} className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-white/20 bg-white/5 text-foreground hover:bg-white/10 transition-colors shrink-0">Edit Project</button>
            <button type="button" onClick={() => setEndProjectModalOpen(true)} className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-amber-500/40 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 transition-colors shrink-0">End Project</button>
          </>
        )}
        <button type="button" onClick={() => navigate("/projects")} className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-white/10 glass-subtle text-muted-foreground hover:text-foreground transition-colors">Switch Project</button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div
          style={{ flex: 1, minHeight: 0, overflow: "auto" }}
          className={
            "app-content-inner" +
            (view === "executive" || view === "operators" || view === "creds" || view === "shifts" || view === "expenses" ? " app-content-inner--full-width" : "")
          }
        >
          {view === "kanban" ? (
            <div className="min-h-full grid-bg content-glow border-0">
              <div className="px-6 lg:px-10 py-8 animate-fade-in max-w-[1400px]">
                <h1 className="text-2xl font-bold tracking-tight mb-6 text-heading-glow">Hiring Pipeline</h1>
                <Kanban ops={ops.filter(o => o.active !== false && o.stage !== "Passed")} onUpdate={updateOp} stages={getKanbanColumns(project)}/>
              </div>
            </div>
          ) : view === "executive" ? (
            <PageShell>
              <ExecutiveView
                stats={stats}
                event={event}
                statsError={statsError}
                onRetry={() => { setStatsError(null); setStatsInvalidateKey(k => k + 1); }}
                isMobile={isMobile}
                ops={ops}
                committedStages={committedStages}
                budgetCapFromProject={project?.budget?.laborCap}
                eventStartISO={project?.eventStartISO}
                eventEndISO={project?.eventEndISO}
                expenses={expenses}
                laborWithinProjectWindow={laborWithinProjectWindow}
                credentialsRequired={project?.credentialsRequired !== false}
              />
            </PageShell>
          ) : view === "operators" || view === "creds" || view === "shifts" || view === "expenses" ? (
            <PageShell>
              {view==="operators"  && <ErrorBoundary><OperatorsView zones={zones} ops={ops||[]} operatorFilter={operatorFilter} onOperatorFilterChange={setOperatorFilter} onUpdate={updateOp} onAddOperator={()=>setShowAddOpModal(true)} onUpdateDefaultRate={(opId, rate)=>api.updateOperator(opId, { day_rate: rate })} onRatingHistory={(id, body)=>api.addOperatorRatingHistory(id, body)} onOperatorDeleted={loadOps} isMobile={isMobile}/></ErrorBoundary>}
              {view==="creds"      && <ErrorBoundary><CredsTracker zones={zones} ops={ops||[]} onUpdate={updateOp} onAddOperator={()=>setShowAddOpModal(true)} onUpdateDefaultRate={(opId, rate)=>api.updateOperator(opId, { day_rate: rate })} onRatingHistory={(id, body)=>api.addOperatorRatingHistory(id, body)} onOperatorDeleted={loadOps} isMobile={isMobile} credentialsRequired={project?.credentialsRequired !== false}/></ErrorBoundary>}
              {view==="shifts"     && <ErrorBoundary><ShiftsView zones={zones} ops={ops||[]} projectId={projectId} onShiftMutated={onShiftMutated} isMobile={isMobile} /></ErrorBoundary>}
              {view==="expenses"   && <ErrorBoundary><ExpensesView projectId={projectId} expenses={expenses} onRefresh={()=>setExpenses(getExpenses(projectId))} isMobile={isMobile}/></ErrorBoundary>}
            </PageShell>
          ) : (
            <div className="flex-1 min-h-0 overflow-auto border-0">
              {view==="dashboard"  && <Dashboard zones={zones} ops={ops} isMobile={isMobile}/>}
              {view==="deploy"     && <ErrorBoundary><DeployMatrix zones={zones} ops={ops||[]} shifts={shiftsForBurn} onUpdate={updateOp}/></ErrorBoundary>}
              {view==="postevent"  && <PostEventReview ops={ops} onUpdate={updateOp}/>}
              {view==="schema"     && <SchemaView/>}
            </div>
          )}
        </div>
      </div>
      </main>
      {showAddOpModal && <AddOperatorModal zones={zones} onSave={handleAddOperator} onClose={()=>setShowAddOpModal(false)} projectId={projectId} />}

      <GlassModal open={endProjectModalOpen} onOpenChange={(open) => setEndProjectModalOpen(!!open)} title="End this project?" description="This will mark the project as completed and move it to the archive section. You can still view historical data." className="max-w-[400px]">
        <div className="flex gap-3 justify-end pt-4">
          <button type="button" onClick={() => setEndProjectModalOpen(false)} className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 transition-colors">Cancel</button>
          <button type="button" className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-amber-500/40 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 transition-colors" onClick={() => {
            if (!isCustomProject(projectId)) {
              addProject({ id: projectId, name: project?.name, startDate: project?.eventStartISO, endDate: project?.eventEndISO, budget: project?.budget, credentialsRequired: project?.credentialsRequired, zones: project?.zones, location: project?.location, clientName: project?.clientName });
            }
            updateProjectStatus(projectId, "completed");
            setProjectId(null);
            setEndProjectModalOpen(false);
            navigate("/projects", { replace: true });
          }}>End Project</button>
        </div>
      </GlassModal>
      {showEditProjectModal && project && (
        <EditProjectModal
          project={project}
          onSave={(patch) => {
            if (isCustomProject(projectId)) {
              updateProject(projectId, patch);
            } else {
              addProject({
                id: projectId,
                name: patch.name ?? project.name,
                startDate: (patch.startDate ?? project.eventStartISO) || "",
                endDate: (patch.endDate ?? project.eventEndISO) || "",
                budget: patch.budget ?? project.budget,
                credentialsRequired: patch.credentialsRequired ?? project.credentialsRequired,
                zones: patch.zones ?? project.zones,
                location: patch.location ?? project.location,
                clientName: patch.clientName ?? project.clientName,
                breakPolicy: patch.breakPolicy ?? project.breakPolicy,
                streamReportLink: patch.streamReportLink ?? project.streamReportLink,
                gearCheckoutLink: patch.gearCheckoutLink ?? project.gearCheckoutLink,
              });
            }
            setShowEditProjectModal(false);
          }}
          onClose={() => setShowEditProjectModal(false)}
        />
      )}
    </div>
  );
}

// ─── APP (router + project launcher) ───────────────────────────────────────────

function HomeRedirect() {
  const stored = getStoredProjectId();
  const target = stored ? `/p/${stored}/executive` : "/projects";
  return <Navigate to={target} replace />;
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/projects" element={<ProjectsLauncher />} />
        <Route path="/p/:projectId/:view?" element={<ProjectDashboard />} />
      </Routes>
    </Layout>
  );
}

