import { useState, useEffect, useCallback, useMemo, memo, Component } from "react";
import { useParams, useNavigate, Navigate, Routes, Route } from "react-router-dom";
import { useIsMobile } from "./hooks/useIsMobile";
import { getDaysUntil } from "./config/event";
import { getSprintLabel } from "./utils/dates";
import { useProject, getStoredProjectId } from "./state/projectStore";
import { isCustomProject } from "./data/projectStorage";
import { getKanbanColumns, getCommittedStages } from "./projects";
import ProjectStatusBadge from "./components/ProjectStatusBadge";
import Layout from "./components/Layout";
import ProjectsLauncher from "./pages/ProjectsLauncher";
import AppShell from "./components/AppShell";
import PageHeader from "./components/PageHeader";
import PageShell from "./components/PageShell";
import HudCard from "./components/HudCard";
import StatCard from "./components/StatCard";
import HudBadge from "./components/HudBadge";
import HudTable from "./components/HudTable";

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

const GearChip = ({label, active, onClick}) => (
  <span onClick={onClick} style={{
    display:"inline-block", padding:"2px 8px", borderRadius:4,
    fontSize:9, fontWeight:700, cursor:"pointer",
    background: active ? "rgba(99,102,241,0.2)" : "var(--hud-input-bg)",
    color: active ? "#818cf8":"#475569",
    border: `1px solid ${active?"#6366f144":"#334155"}`,
    transition:"all 0.15s", whiteSpace:"nowrap"
  }}>{label}</span>
);

// ─── EXECUTIVE (budget cap from active project; stats for actual/committed/remaining) ─
function ExecutiveView({ stats, event, statsError, onRetry, isMobile, ops, committedStages, budgetCapFromProject, eventStartISO }) {
  if (stats === null && !statsError) return <div style={{padding:40,textAlign:'center',color:'#64748b',fontSize:11}}>Loading executive data...</div>;
  if (statsError && stats === null) return (
    <div style={{padding:40,textAlign:'center',color:'#ef4444',display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
      <div>Failed to load: {statsError}</div>
      <button onClick={onRetry} style={{padding:'8px 16px',background:'#ef4444',border:'none',borderRadius:4,color:'#fff',fontSize:10,cursor:'pointer',fontWeight:700}}>Retry</button>
    </div>
  );
  const fmt$ = n => (n == null || Number.isNaN(n)) ? '$0' : '$' + Math.round(n).toLocaleString();
  // Use selected project's budget cap when available; otherwise stats from API; never hardcode 80000
  const budgetCap = (budgetCapFromProject != null && budgetCapFromProject !== '')
    ? Number(budgetCapFromProject)
    : (stats?.budget_cap ?? stats?.budgetCap ?? stats?.budget ?? 0);
  const actual = stats?.actual_labor ?? stats?.actualLabor ?? 0;
  const committed = ops != null ? calculateCommittedLabor(ops, event, committedStages) : (stats?.committed_labor ?? 0);
  const forecast = stats?.forecast_labor ?? 0;
  // Always derive remaining from project budgetCap and project-scoped actual/committed (zero-state for new projects)
  const remaining = Math.max(0, budgetCap - Math.max(actual, committed));
  const otSpend = stats?.otSpend ?? 0;
  const c = stats?.counts ?? {};
  const totalOps = c.total_operators ?? stats?.total ?? 0;
  const confirmedCount = c.confirmed ?? stats?.confirmed ?? 0;
  const credentialedCount = c.credentialed ?? stats?.credApproved ?? 0;
  const credDeniedCount = c.cred_denied ?? stats?.credDenied ?? 0;
  const highRiskCount = c.high_risk ?? stats?.highRisk ?? 0;

  // Budget intelligence: daily burn rate and runway (project-scoped; zero-state when no spend)
  const eventStart = eventStartISO ?? event?.start_date ?? event?.eventStart ?? null;
  const daysElapsed = eventStart
    ? Math.max(0, Math.floor((Date.now() - new Date(eventStart).getTime()) / 86400000))
    : 0;
  const burnRate = daysElapsed > 0 && actual > 0 ? actual / daysElapsed : 0;
  const dailyBurnLabel = daysElapsed <= 0 || actual <= 0 ? "—" : `${fmt$(burnRate)} / day`;
  const remainingDays = burnRate > 0 ? remaining / burnRate : null;
  const runwayLabel = burnRate <= 0 ? "—" : (remainingDays != null ? `${Math.round(remainingDays)} days remaining` : "—");

  return (
    <div className="executive-dashboard-inner" style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%" }}>
      {statsError && (
        <HudCard style={{ borderColor: "rgba(239,68,68,0.4)", background: "rgba(66,34,34,0.6)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, color: "#fca5a5" }}>Could not refresh. Showing last values.</span>
            <button onClick={onRetry} className="hud-btn" style={{ padding: "4px 10px", fontSize: 9 }}>Retry</button>
          </div>
        </HudCard>
      )}
      <HudCard header="// EXECUTIVE OVERVIEW">
        <div style={{ fontSize: isMobile ? 10 : 11, color: "var(--hud-muted)" }}>Budget updates based on committed ops + logged shifts</div>
      </HudCard>
      <div className="executive-cards">
        <StatCard label="Budget Cap" value={fmt$(budgetCap)} helper="Total labor budget" accentColor="#6366f1" bars={4} />
        <StatCard label="Actual Labor" value={fmt$(actual)} helper="From logged shifts" accentColor="#22c55e" bars={3} />
        <StatCard
          label="Committed Labor"
          value={fmt$(committed)}
          helper={typeof forecast === "number" ? `Confirmed ops only. Forecast: ${fmt$(forecast)}` : "Confirmed ops only (sum of day_rate)"}
          accentColor="#f59e0b"
          bars={5}
        />
        <StatCard label="Remaining" value={fmt$(remaining)} helper="Budget − MAX(actual, committed)" accentColor="#22c55e" bars={3} />
        <StatCard label="OT Spend" value={fmt$(otSpend)} helper="Overtime" accentColor="#a855f7" bars={2} />
        <StatCard label="Daily Burn" value={dailyBurnLabel} helper="Actual labor ÷ days elapsed" accentColor="#0ea5e9" bars={3} />
        <StatCard label="Runway" value={runwayLabel} helper="Remaining budget ÷ burn rate" accentColor="#06b6d4" bars={3} />
      </div>
      <HudCard header="// PIPELINE SUMMARY" noPadding>
        <div style={{ padding: isMobile ? "12px 14px" : "16px 20px" }}>
          <div style={{ display: "flex", gap: isMobile ? 12 : 24, flexWrap: "wrap", fontSize: isMobile ? 10 : 11, alignItems: "center" }}>
            <HudBadge label={`${totalOps} total`} color="#22c55e" small />
            <HudBadge label={`${confirmedCount} confirmed`} color="#22c55e" small />
            <HudBadge label={`${credentialedCount} credentialed`} color="#0ea5e9" small />
            <HudBadge label={`${credDeniedCount} cred denied`} color="#ef4444" small />
            <HudBadge label={`${highRiskCount} high-risk`} color="#ef4444" small />
          </div>
          {(event?.event_name || event?.start_date) && (
            <div style={{ marginTop: isMobile ? 10 : 14, fontSize: isMobile ? 9 : 10, color: "var(--hud-muted)" }}>
              Event: {event.event_name || "—"} · {event.start_date || "—"} – {event.end_date || "—"}
            </div>
          )}
        </div>
      </HudCard>
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
    <div className="hud-modal-overlay" onClick={onClose}>
      <div className="hud-modal-panel" style={{padding:24}} onClick={e=>e.stopPropagation()}>
        <div className="hud-page-label" style={{marginBottom:4}}>// LOG SHIFT</div>
        <div style={{fontSize:13,fontWeight:800,color:'var(--hud-text)',marginBottom:16}}>Log Shift</div>
        {err && <div style={{fontSize:10,color:'#ef4444',marginBottom:12}}>{err}</div>}
        <form onSubmit={handleSubmit} style={{display:'flex',flexDirection:'column',gap:12}}>
          <div>
            <label style={{fontSize:9,color:'#64748b',display:'block',marginBottom:4}}>Operator *</label>
            <select value={form.operator_id} onChange={e=>setForm(f=>({...f,operator_id:e.target.value,zone:''}))} required style={{width:'100%',background:'var(--hud-input-bg)',border:'1px solid var(--hud-input-border)',borderRadius:4,padding:8,color:'var(--hud-text)',fontSize:10}}>
              <option value="">— Select —</option>
              {(ops||[]).map(o=><option key={o.id} value={o.id}>{o.name || o.full_name} ({o.opId||o.id})</option>)}
            </select>
          </div>
          <div>
            <label style={{fontSize:9,color:'var(--hud-muted)',display:'block',marginBottom:4}}>Zone</label>
            <select className="hud-glass-input" value={form.zone} onChange={e=>setForm(f=>({...f,zone:e.target.value}))} disabled={!zones.length}>
              <option value="">{zones.length ? "—" : "No zones yet — add in Settings"}</option>
              {zones.map(z=><option key={z} value={z}>{z}</option>)}
            </select>
          </div>
          <div>
            <label style={{fontSize:9,color:'var(--hud-muted)',display:'block',marginBottom:4}}>Date</label>
            <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} style={{width:'100%',background:'var(--hud-input-bg)',border:'1px solid var(--hud-input-border)',borderRadius:4,padding:8,color:'var(--hud-text)',fontSize:10}}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div>
              <label style={{fontSize:9,color:'#64748b',display:'block',marginBottom:4}}>Clock In</label>
              <input type="datetime-local" value={form.clock_in} onChange={e=>setForm(f=>({...f,clock_in:e.target.value}))} required style={{width:'100%',background:'var(--hud-input-bg)',border:'1px solid var(--hud-input-border)',borderRadius:4,padding:8,color:'var(--hud-text)',fontSize:10}}/>
            </div>
            <div>
              <label style={{fontSize:9,color:'#64748b',display:'block',marginBottom:4}}>Clock Out</label>
              <input type="datetime-local" value={form.clock_out} onChange={e=>setForm(f=>({...f,clock_out:e.target.value}))} required style={{width:'100%',background:'var(--hud-input-bg)',border:'1px solid var(--hud-input-border)',borderRadius:4,padding:8,color:'var(--hud-text)',fontSize:10}}/>
            </div>
          </div>
          <div>
            <label style={{fontSize:9,color:'#64748b',display:'block',marginBottom:4}}>Break (minutes)</label>
            <input type="number" value={form.break_minutes} onChange={e=>setForm(f=>({...f,break_minutes:e.target.value}))} min={0} max={120} style={{width:'100%',background:'var(--hud-input-bg)',border:'1px solid var(--hud-input-border)',borderRadius:4,padding:8,color:'var(--hud-text)',fontSize:10}}/>
          </div>
          <div style={{display:'flex',gap:8,marginTop:4}}>
            <button type="button" onClick={onClose} style={{flex:1,padding:10,background:'#334155',border:'none',borderRadius:4,color:'#94a3b8',fontSize:10,cursor:'pointer'}}>Cancel</button>
            <button type="submit" disabled={saving} style={{flex:1,padding:10,background:'#6366f1',border:'none',borderRadius:4,color:'#fff',fontSize:10,cursor:saving?'wait':'pointer',fontWeight:700}}>{saving?'Saving...':'Log Shift'}</button>
          </div>
        </form>
      </div>
    </div>
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

  const filteredToday = todayFilter === 'Active' ? todayShifts.filter(s => !s.end_time)
    : todayFilter === 'Closed' ? todayShifts.filter(s => s.end_time)
    : todayShifts;

  const fmtTime = t => t ? new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '—';

  if (loading) return <div style={{padding:40,textAlign:'center',color:'#64748b',fontSize:11}}>Loading shifts...</div>;
  if (err) return <div style={{padding:40,textAlign:'center',color:'#ef4444'}}><div>{err}</div><button onClick={load} style={{marginTop:12,padding:'8px 16px',background:'#ef4444',border:'none',borderRadius:4,color:'#fff',fontSize:10,cursor:'pointer'}}>Retry</button></div>;

  if (isMobile) {
    return (
      <div style={{display:'flex',flexDirection:'column',gap:16}}>
        <PageHeader label="SHIFTS" title="Time & Attendance" actions={
          <div style={{display:'flex',gap:8,width:'100%'}}>
            <button type="button" onClick={()=>setShowLogShift(true)} className="hud-btn hud-btn-primary" style={{flex:1}}>LOG SHIFT</button>
            <button type="button" onClick={()=>{setShowClockIn(true);setClockInErr(null);}} className="hud-btn" style={{flex:1,background:'rgba(34,197,94,0.2)',borderColor:'rgba(34,197,94,0.5)',color:'#86efac'}}>Clock In</button>
          </div>
        } />
        <HudCard header="// ACTIVE — ON THE CLOCK">
          {activeShifts.length === 0 ? <div style={{padding:20,textAlign:'center',color:'var(--hud-muted)',fontSize:11}}>No one clocked in.</div> : activeShifts.map(s=>(
            <div key={s.id} className="hud-card" style={{padding:12,marginBottom:8}}>
              <div style={{fontSize:12,fontWeight:700,color:'var(--hud-text)'}}>{s.operator_name || `Op #${s.operator_id}` || '—'}</div>
              <div style={{fontSize:10,color:'#94a3b8',marginTop:4}}>{s.zone || '—'} · In at {fmtTime(s.start_time)}</div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:8}}>
                <span style={{fontSize:10,color:'#22c55e',fontWeight:700}}><Elapsed start={s.start_time}/></span>
                <button onClick={()=>handleClockOut(s.id)} disabled={clockingOut===s.id} style={{padding:'6px 12px',background:'#ef4444',border:'none',borderRadius:4,color:'#fff',fontSize:10,cursor:'pointer',fontWeight:700}}>{clockingOut===s.id?'...':'Clock Out'}</button>
              </div>
            </div>
          ))}
        </HudCard>
        <HudCard header="// LOGGED SHIFTS">
          {allShifts.length === 0 ? <div style={{padding:20,textAlign:'center',color:'#64748b',fontSize:10}}>No logged shifts yet.</div> : allShifts.slice(0, 20).map(s=>(
            <div key={s.id} style={{borderBottom:'1px solid #1e293b',padding:'10px 0'}}>
              <div style={{fontSize:11,fontWeight:700,color:'var(--hud-text)'}}>{s.operator_name || `Op #${s.operator_id}` || '—'}</div>
              <div style={{fontSize:10,color:'#94a3b8'}}>{s.date ? new Date(s.date).toLocaleDateString() : '—'} · {s.zone || '—'}</div>
              <div style={{fontSize:10,color:'#22c55e',fontWeight:700,marginTop:2}}>{s.total_pay != null ? '$'+Number(s.total_pay).toFixed(0) : '—'}</div>
            </div>
          ))}
          {allShifts.length > 20 && <div style={{fontSize:10,color:'var(--hud-muted)',marginTop:8}}>+{allShifts.length - 20} more</div>}
        </HudCard>
        <HudCard header="// TODAY">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <select value={todayFilter} onChange={e=>setTodayFilter(e.target.value)} style={{background:'var(--hud-input-bg)',border:'1px solid var(--hud-input-border)',borderRadius:4,padding:'4px 8px',color:'var(--hud-text)',fontSize:9,outline:'none'}}>
              <option value='All'>All</option><option value='Active'>Active</option><option value='Closed'>Closed</option>
            </select>
          </div>
          {filteredToday.length === 0 ? <div style={{padding:20,textAlign:'center',color:'#64748b',fontSize:10}}>No shifts today</div> : filteredToday.map(s=>(
            <div key={s.id} style={{borderBottom:'1px solid #1e293b',padding:'8px 0'}}>
              <div style={{fontSize:11,color:'var(--hud-text)'}}>{s.operator_name || `Op #${s.operator_id}` || '—'}</div>
              <div style={{fontSize:10,color:'#94a3b8'}}>{fmtTime(s.start_time)} – {fmtTime(s.end_time) || 'Active'}</div>
            </div>
          ))}
        </HudCard>
        {showLogShift && <LogShiftModal zones={zones} ops={ops||[]} projectId={projectId} onClose={()=>setShowLogShift(false)} onSaved={async ()=>{await load();onShiftMutated?.();setShowLogShift(false);}}/>}
        {showClockIn && (
          <div className="hud-modal-overlay" onClick={()=>setShowClockIn(false)}>
            <div className="hud-modal-panel" style={{padding:24}} onClick={e=>e.stopPropagation()}>
              <div className="hud-page-label" style={{marginBottom:4}}>// CLOCK IN</div>
              <div style={{fontSize:13,fontWeight:800,color:'var(--hud-text)',marginBottom:16}}>Clock In</div>
              {clockInErr && <div style={{fontSize:10,color:'#ef4444',marginBottom:12}}>{clockInErr}</div>}
              <form onSubmit={handleClockIn} style={{display:'flex',flexDirection:'column',gap:12}}>
                <div>
                  <label style={{fontSize:9,color:'var(--hud-muted)',display:'block',marginBottom:4}}>Operator *</label>
                  <select value={clockInForm.operator_id} onChange={e=>setClockInForm(f=>({...f,operator_id:e.target.value}))} required className="hud-glass-input">
                    <option value="">— Select —</option>
                    {(ops||[]).map(o=><option key={o.id} value={o.id}>{o.name || o.full_name} ({o.opId||o.id})</option>)}
                  </select>
                </div>
                <div>
                  <label style={{fontSize:9,color:'var(--hud-muted)',display:'block',marginBottom:4}}>Zone (optional)</label>
                  <select className="hud-glass-input" value={clockInForm.zone} onChange={e=>setClockInForm(f=>({...f,zone:e.target.value}))} disabled={!zones.length}>
                    <option value="">{zones.length ? "—" : "No zones yet"}</option>
                    {zones.map(z=><option key={z} value={z}>{z}</option>)}
                  </select>
                </div>
                <div style={{display:'flex',gap:8,marginTop:4}}>
                  <button type="button" onClick={()=>setShowClockIn(false)} style={{flex:1,padding:10,background:'#334155',border:'none',borderRadius:4,color:'#94a3b8',fontSize:10,cursor:'pointer'}}>Cancel</button>
                  <button type="submit" style={{flex:1,padding:10,background:'#22c55e',border:'none',borderRadius:4,color:'#fff',fontSize:10,cursor:'pointer',fontWeight:700}}>Clock In</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{display:'flex',flexDirection:'column',gap:20}}>
      <PageHeader label="SHIFTS" title="Time & Attendance" actions={
        <div style={{display:'flex',gap:8}}>
          <button type="button" onClick={()=>setShowLogShift(true)} className="hud-btn hud-btn-primary">LOG SHIFT</button>
          <button type="button" onClick={()=>{setShowClockIn(true);setClockInErr(null);}} className="hud-btn" style={{background:'rgba(34,197,94,0.2)',borderColor:'rgba(34,197,94,0.5)',color:'#86efac'}}>Clock In</button>
        </div>
      } />

      {/* Active Shifts */}
      <div className="hud-table-wrap hud-table-wrap--scroll-mobile">
        <div className="glass-panel-table-header" style={{padding:'10px 14px',borderBottom:'1px solid rgba(255,255,255,0.08)',fontSize:10,fontWeight:800,color:'#475569'}}>ACTIVE — ON THE CLOCK</div>
        {activeShifts.length === 0 ? (
          <div style={{padding:32,textAlign:'center',color:'#64748b',fontSize:11}}>No one is currently clocked in.</div>
        ) : (
          <div className="glass-panel-table-header" style={{display:'grid',gridTemplateColumns:'1fr 90px 100px 100px 80px',borderBottom:'1px solid rgba(255,255,255,0.08)',padding:'9px 14px',gap:8}}>
            {['Operator','Zone','Clock-in','Elapsed',''].map(h=>(<span key={h} style={{fontSize:9,fontWeight:800,color:'#475569'}}>{h}</span>))}
          </div>
        )}
        {activeShifts.map(s=>(
          <div key={s.id} className="glass-panel-row" style={{display:'grid',gridTemplateColumns:'1fr 90px 100px 100px 80px',padding:'10px 14px',gap:8,alignItems:'center',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
            <div>
              <span style={{fontSize:11,fontWeight:700,color:'var(--hud-text)'}}>{s.operator_name || `Op #${s.operator_id}` || '—'}</span>
              <span style={{marginLeft:8}}><OTBadge start={s.start_time} breakM={s.break_minutes}/></span>
            </div>
            <span style={{fontSize:10,color:'#94a3b8'}}>{s.zone || '—'}</span>
            <span style={{fontSize:10,color:'#94a3b8',fontFamily:'monospace'}}>{fmtTime(s.start_time)}</span>
            <span style={{fontSize:10,color:'#22c55e',fontWeight:700}}><Elapsed start={s.start_time}/></span>
            <button onClick={()=>handleClockOut(s.id)} disabled={clockingOut===s.id} style={{padding:'4px 10px',background:'#ef4444',border:'none',borderRadius:4,color:'#fff',fontSize:9,cursor:clockingOut===s.id?'wait':'pointer',fontWeight:700}}>{clockingOut===s.id?'...':'Clock Out'}</button>
          </div>
        ))}
      </div>

      {/* Logged Shifts (worked, OT, pay) */}
      <div className="glass-panel" style={{overflow:'hidden'}}>
        <div className="glass-panel-table-header" style={{padding:'10px 14px',borderBottom:'1px solid rgba(255,255,255,0.08)',fontSize:10,fontWeight:800,color:'#475569'}}>LOGGED SHIFTS — PAY SUMMARY</div>
        {allShifts.length === 0 ? (
          <div style={{padding:24,textAlign:'center',color:'#64748b',fontSize:10}}>No logged shifts yet. Use &quot;LOG SHIFT&quot; to add completed shifts.</div>
        ) : (
          <div style={{maxHeight:300,overflowY:'auto'}}>
            <div className="glass-panel-table-header" style={{display:'grid',gridTemplateColumns:'60px 1fr 90px 90px 55px 70px 80px 85px',padding:'9px 14px',gap:8}}>
              {['ID','Operator','Zone','Date','Worked','OT hrs','OT pay','Total'].map(h=>(<span key={h} style={{fontSize:9,fontWeight:800,color:'#475569'}}>{h}</span>))}
            </div>
            {allShifts.map(s=>(
              <div key={s.id} className="glass-panel-row" style={{display:'grid',gridTemplateColumns:'60px 1fr 90px 90px 55px 70px 80px 85px',padding:'8px 14px',gap:8,alignItems:'center',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
                <span style={{fontSize:10,color:'#64748b',fontFamily:'monospace'}}>#{String(s.id).slice(-4)}</span>
                <span style={{fontSize:10,color:'#94a3b8',fontWeight:600}}>{s.operator_name||`Op #${s.operator_id}`||'—'}</span>
                <span style={{fontSize:10,color:'#94a3b8'}}>{s.zone||'—'}</span>
                <span style={{fontSize:10,fontFamily:'monospace'}}>{s.date ? new Date(s.date).toLocaleDateString() : (s.start_time ? new Date(s.start_time).toLocaleDateString() : '—')}</span>
                <span style={{fontSize:10,color:'#e2e8f0'}}>{s.worked_hours != null ? Number(s.worked_hours).toFixed(1) : '—'}</span>
                <span style={{fontSize:10,color:(s.overtime_hours||0)>0?'#f59e0b':'#64748b'}}>{s.overtime_hours != null ? Number(s.overtime_hours).toFixed(1) : '0'}</span>
                <span style={{fontSize:10,color:'#a855f7',fontWeight:700}}>{s.overtime_pay != null ? '$'+Number(s.overtime_pay).toFixed(0) : '$0'}</span>
                <span style={{fontSize:10,color:'#22c55e',fontWeight:700}}>{s.total_pay != null ? '$'+Number(s.total_pay).toFixed(0) : '—'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Today's Shifts */}
      <div className="glass-panel" style={{overflow:'hidden'}}>
        <div className="glass-panel-table-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 14px',borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
          <span style={{fontSize:10,fontWeight:800,color:'#475569'}}>TODAY&apos;S SHIFTS</span>
          <select value={todayFilter} onChange={e=>setTodayFilter(e.target.value)} style={{background:'rgba(30,41,59,0.8)',border:'1px solid #334155',borderRadius:4,padding:'4px 8px',color:'#94a3b8',fontSize:9,outline:'none'}}>
            <option value='All'>All</option>
            <option value='Active'>Active</option>
            <option value='Closed'>Closed</option>
          </select>
        </div>
        {filteredToday.length === 0 ? (
          <div style={{padding:24,textAlign:'center',color:'#64748b',fontSize:10}}>No shifts today</div>
        ) : (
          <div style={{maxHeight:320,overflowY:'auto'}}>
            <div className="glass-panel-table-header" style={{display:'grid',gridTemplateColumns:'1fr 80px 90px 90px 90px',padding:'9px 14px',gap:8}}>
              {['Operator','Zone','In','Out',''].map(h=>(<span key={h} style={{fontSize:9,fontWeight:800,color:'#475569'}}>{h}</span>))}
            </div>
            {filteredToday.map(s=>(
              <div key={s.id} className="glass-panel-row" style={{display:'grid',gridTemplateColumns:'1fr 80px 90px 90px 90px',padding:'8px 14px',gap:8,alignItems:'center',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
                <span style={{fontSize:10,color:'#94a3b8',fontWeight:600}}>{s.operator_name || `Op #${s.operator_id}` || '—'}</span>
                <span style={{fontSize:10,color:'#94a3b8'}}>{s.zone || '—'}</span>
                <span style={{fontSize:10,fontFamily:'monospace'}}>{fmtTime(s.start_time)}</span>
                <span style={{fontSize:10,fontFamily:'monospace',color:s.end_time?'#94a3b8':'#22c55e'}}>{fmtTime(s.end_time) || 'Active'}</span>
                {!s.end_time && <button onClick={()=>handleClockOut(s.id)} disabled={clockingOut===s.id} style={{padding:'2px 8px',background:'#ef4444',border:'none',borderRadius:4,color:'#fff',fontSize:9,cursor:'pointer'}}>Out</button>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Log Shift Modal */}
      {showLogShift && <LogShiftModal zones={zones} ops={ops||[]} projectId={projectId} onClose={()=>setShowLogShift(false)} onSaved={async ()=>{await load();onShiftMutated?.();setShowLogShift(false);}}/>}

      {/* Clock In Modal */}
      {showClockIn && (
        <div className="hud-modal-overlay" onClick={()=>setShowClockIn(false)}>
          <div className="hud-modal-panel" style={{padding:24}} onClick={e=>e.stopPropagation()}>
            <div className="hud-page-label" style={{marginBottom:4}}>// CLOCK IN</div>
            <div style={{fontSize:13,fontWeight:800,color:'var(--hud-text)',marginBottom:16}}>Clock In</div>
            {clockInErr && <div style={{fontSize:10,color:'#ef4444',marginBottom:12}}>{clockInErr}</div>}
            <form onSubmit={handleClockIn} style={{display:'flex',flexDirection:'column',gap:12}}>
              <div>
                <label style={{fontSize:9,color:'var(--hud-muted)',display:'block',marginBottom:4}}>Operator *</label>
                <select value={clockInForm.operator_id} onChange={e=>setClockInForm(f=>({...f,operator_id:e.target.value}))} required className="hud-glass-input">
                  <option value="">— Select —</option>
                  {(ops||[]).map(o=><option key={o.id} value={o.id}>{o.name || o.full_name} ({o.opId||o.id})</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:9,color:'var(--hud-muted)',display:'block',marginBottom:4}}>Zone (optional)</label>
                <select className="hud-glass-input" value={clockInForm.zone} onChange={e=>setClockInForm(f=>({...f,zone:e.target.value}))} disabled={!zones.length}>
                  <option value="">{zones.length ? "—" : "No zones yet"}</option>
                  {zones.map(z=><option key={z} value={z}>{z}</option>)}
                </select>
              </div>
              <div style={{display:'flex',gap:8,marginTop:4}}>
                <button type="button" onClick={()=>setShowClockIn(false)} style={{flex:1,padding:10,background:'#334155',border:'none',borderRadius:4,color:'#94a3b8',fontSize:10,cursor:'pointer'}}>Cancel</button>
                <button type="submit" style={{flex:1,padding:10,background:'#22c55e',border:'none',borderRadius:4,color:'#fff',fontSize:10,cursor:'pointer',fontWeight:700}}>Clock In</button>
              </div>
            </form>
          </div>
        </div>
      )}
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
  const buffer       = ops.filter(o=>o.isBuffer).length;
  const broadcastQ   = ops.filter(isBroadcastQualified).length;
  const pct = v => total ? Math.round(v/total*100) : 0;

  const stageData       = HIRE_STAGES.map(s=>({stage:s, count:ops.filter(o=>o.stage===s).length}));
  const zoneData        = (zones.length ? zones : []).map(z=>({zone:z, confirmed:ops.filter(o=>o.zone===z&&o.stage==="Confirmed").length, total:ops.filter(o=>o.zone===z).length}));
  const tierData        = Object.entries(TIERS).map(([k,v])=>({key:k,...v, count:ops.filter(o=>o.tier===k).length}));
  const reliabilityDist = [5,4,3,2,1].map(r=>({ r, count:ops.filter(o=>o.reliability===r).length }));

  return (
    <div style={{display:"flex", flexDirection:"column", gap:20}}>
      <div style={{display:"flex", gap:10, flexWrap:"wrap"}}>
        <StatCard label="Total Pipeline"   value={total}        sub={total ? `${total - buffer} primary + ${buffer} buffer` : 'No operators yet'} accent="#6366f1"/>
        <StatCard label="Confirmed"        value={confirmed}    sub={`${pct(confirmed)}% of pipeline`} accent="#22c55e"/>
        <StatCard label="Credentialed"     value={credApproved} sub="Festival access approved"         accent="#0ea5e9"/>
        <StatCard label="LOAs Signed"      value={loaSigned}    sub="Agreements locked"                accent="#f59e0b"/>
        <StatCard label="Cred Denied"      value={denied}       sub="Needs backup swap"                accent="#ef4444"/>
        <StatCard label="Broadcast Ready"  value={broadcastQ}   sub="TVU / LiveU / FX6 / Multi-cam"   accent="#22d3ee"/>
      </div>

      {/* Risk summary */}
      <div className="glass-panel" style={{ padding:"14px 20px", display:"flex", gap:24, alignItems:"center", flexWrap:"wrap"}}>
        <span style={{fontSize:10, fontWeight:800, color:"#475569", letterSpacing:"0.1em"}}>RELIABILITY RISK SUMMARY</span>
        {[["HIGH",highRisk,"#ef4444"],["MED",medRisk,"#f59e0b"],["LOW",lowRisk,"#22c55e"]].map(([lvl,n,c])=>(
          <div key={lvl} style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:8,height:8,borderRadius:99,background:c}}/>
            <span style={{fontSize:13,color:c,fontWeight:900}}>{n}</span>
            <span style={{fontSize:10,color:"#64748b"}}>{lvl}</span>
          </div>
        ))}
        <div style={{height:20, width:1, background:"#1e293b"}}/>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <span style={{fontSize:10,color:"#64748b"}}>MH Alumni:</span>
          <span style={{fontSize:11,color:"#22c55e",fontWeight:800}}>{ops.filter(o=>o.workedWithMemeHouse).length}</span>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <span style={{fontSize:10,color:"#64748b"}}>Late-to-screen flags:</span>
          <span style={{fontSize:11,color:"#f59e0b",fontWeight:800}}>{ops.filter(o=>o.lateToScreen).length}</span>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <span style={{fontSize:10,color:"#64748b"}}>Rate instability flags:</span>
          <span style={{fontSize:11,color:"#f59e0b",fontWeight:800}}>{ops.filter(o=>o.rateInstability).length}</span>
        </div>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16}}>
        <div className="glass-panel" style={{ padding:"16px 20px"}}>
          <div style={{fontSize:11,fontWeight:800,color:"#64748b",letterSpacing:"0.1em",marginBottom:14}}>HIRING PIPELINE FLOW</div>
          {stageData.map(({stage,count})=>(
            <div key={stage} style={{marginBottom:9}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                <span style={{fontSize:11,color:"#94a3b8",fontWeight:600}}>{stage}</span>
                <span style={{fontSize:11,color:STAGE_COLORS[stage],fontWeight:800}}>{count}</span>
              </div>
              <div style={{height:4,background:"#1e293b",borderRadius:99}}>
                <div style={{height:4,width:`${Math.max(pct(count),2)}%`,background:STAGE_COLORS[stage],borderRadius:99,transition:"width 0.5s"}}/>
              </div>
            </div>
          ))}
        </div>
        <div className="glass-panel" style={{ padding:"16px 20px"}}>
          <div style={{fontSize:11,fontWeight:800,color:"#64748b",letterSpacing:"0.1em",marginBottom:14}}>CREDENTIAL STATUS</div>
          {CRED_STATES.map(s=>{
            const c=ops.filter(o=>o.cred===s).length;
            return (
              <div key={s} style={{marginBottom:9}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                  <span style={{fontSize:11,color:"#94a3b8",fontWeight:600}}>{s}</span>
                  <span style={{fontSize:11,color:CRED_COLORS[s],fontWeight:800}}>{c}</span>
                </div>
                <div style={{height:4,background:"#1e293b",borderRadius:99}}>
                  <div style={{height:4,width:`${Math.max(pct(c),2)}%`,background:CRED_COLORS[s],borderRadius:99}}/>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16}}>
        <div className="glass-panel" style={{ padding:"16px 20px"}}>
          <div style={{fontSize:11,fontWeight:800,color:"#64748b",letterSpacing:"0.1em",marginBottom:14}}>RATE TIER DISTRIBUTION</div>
          {tierData.map(({key,label,color,count})=>(
            <div key={key} style={{display:"flex",alignItems:"center",gap:8,marginBottom:9}}>
              <div style={{width:8,height:8,borderRadius:99,background:color,flexShrink:0}}/>
              <span style={{fontSize:10,color:"#94a3b8",flex:1,fontWeight:600}}>{label}</span>
              <span style={{fontSize:11,color,fontWeight:800}}>{count}</span>
            </div>
          ))}
        </div>
        <div className="glass-panel" style={{ padding:"16px 20px"}}>
          <div style={{fontSize:11,fontWeight:800,color:"#64748b",letterSpacing:"0.1em",marginBottom:14}}>RELIABILITY SCORES</div>
          {reliabilityDist.map(({r,count})=>(
            <div key={r} style={{marginBottom:9}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                <span style={{fontSize:11,color:r>=4?"#22c55e":r===3?"#f59e0b":"#ef4444",fontWeight:700}}>{"★".repeat(r)}{"☆".repeat(5-r)}</span>
                <span style={{fontSize:11,color:"#64748b",fontWeight:800}}>{count}</span>
              </div>
              <div style={{height:4,background:"#1e293b",borderRadius:99}}>
                <div style={{height:4,width:`${Math.max(pct(count),2)}%`,background:r>=4?"#22c55e":r===3?"#f59e0b":"#ef4444",borderRadius:99}}/>
              </div>
            </div>
          ))}
        </div>
        <div className="glass-panel" style={{ padding:"16px 20px"}}>
          <div style={{fontSize:11,fontWeight:800,color:"#64748b",letterSpacing:"0.1em",marginBottom:14}}>ZONE STAFFING</div>
          {zoneData.map(({zone,confirmed:c,total:t})=>(
            <div key={zone} style={{marginBottom:7}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
                <span style={{fontSize:10,color:"#94a3b8",fontWeight:600}}>{zone}</span>
                <span style={{fontSize:10,color:c>0?"#22c55e":"#ef4444",fontWeight:800}}>{c}/{t}</span>
              </div>
              <div style={{height:3,background:"#1e293b",borderRadius:99}}>
                <div style={{height:3,width:t>0?`${(c/t)*100}%`:"0%",background:c===t?"#22c55e":c>0?"#f59e0b":"#ef4444",borderRadius:99}}/>
              </div>
            </div>
          ))}
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

const KANBAN_COLUMN_WIDTH = 280;

// Single card: HUD style with // TASK micro-label and micro-bars.
const KanbanCard = memo(function KanbanCard({ op, isDragging, onDragStart, onDragEnd, onMouseDown, onMouseLeave, draggable, onClick, onQuickConfirm }) {
  const [hover, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);
  const tierColor = TIERS[op.tier]?.color || "#6366f1";
  const showQuickConfirm = onQuickConfirm && (op?.stage ?? "") !== "Confirmed";
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onMouseDown={e => { if (draggable) e.currentTarget.style.cursor = "grabbing"; onMouseDown?.(e); }}
      onMouseLeave={e => { if (draggable) e.currentTarget.style.cursor = "grab"; setHover(false); onMouseLeave?.(e); }}
      onMouseEnter={() => setHover(true)}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      className="hud-card"
      style={{
        padding: "10px 12px",
        cursor: draggable ? "grab" : onClick ? "pointer" : "default",
        borderLeft: `3px solid ${tierColor}`,
        background: hover && !isDragging ? "rgba(255,255,255,0.5)" : pressed ? "rgba(11,18,32,0.08)" : undefined,
        boxShadow: isDragging ? "0 8px 24px rgba(0,0,0,0.4)" : undefined,
        transition: "background 0.15s ease, box-shadow 0.15s ease",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: "0.1em", color: "var(--hud-muted)", fontFamily: "var(--hud-font-mono)" }}>// TASK</span>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {showQuickConfirm && (
            <button type="button" onClick={e => { e.stopPropagation(); onQuickConfirm(op); }} className="hud-btn" style={{ padding: "3px 6px", fontSize: 8, fontWeight: 700, background: "rgba(34,197,94,0.2)", border: "1px solid rgba(34,197,94,0.5)", color: "#22c55e", borderRadius: 6, cursor: "pointer", whiteSpace: "nowrap" }} title="Mark confirmed">Confirm</button>
          )}
          {[6, 10, 8].map((h, i) => <span key={i} style={{ width: 3, height: h, borderRadius: 1, background: tierColor, opacity: 0.6 }} />)}
        </div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--hud-text)", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={op.name}>{op.name}</div>
      <div style={{ fontSize: 9, color: "var(--hud-muted)", marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{op.id} · {op.source || "—"}</div>
      <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 5 }}>
        <Tag label={op.tier} color={tierColor} small />
        <Tag label={op.zone} color="#6366f1" small />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Stars value={op.reliability} />
        <Tag label={op.risk} color={RISK_COLORS[op.risk]} small />
      </div>
      <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
        {op.workedWithMemeHouse && <span style={{ fontSize: 9, color: "#22c55e", fontWeight: 700 }}>✓ Alumni</span>}
        {isBroadcastQualified(op) && <span style={{ fontSize: 9, color: "#22d3ee", fontWeight: 700 }}>📡</span>}
        {op.isBuffer && <span style={{ fontSize: 9, color: "#a855f7", fontWeight: 700 }}>⬡ BUF</span>}
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
        <div className="hud-card" style={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
          <div style={{ flexShrink: 0, padding: "10px 12px", borderBottom: "1px solid var(--hud-border)" }}>
            <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "0 4px", WebkitOverflowScrolling: "touch" }}>
              {stages.map((stage) => (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => setMobileStage(stage.id)}
                  className="hud-badge"
                  style={{
                    flexShrink: 0,
                    padding: "8px 14px",
                    border: "none",
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: "pointer",
                    background: mobileStage === stage.id ? (STAGE_COLORS[stage.id] || "#6366f1") : "rgba(255,255,255,0.06)",
                    color: mobileStage === stage.id ? "#fff" : "var(--hud-muted-strong)",
                    borderColor: mobileStage === stage.id ? (STAGE_COLORS[stage.id] || "#6366f1") : "var(--hud-border)",
                  }}
                >
                  {stage.label} ({stageCounts[stage.id] ?? 0})
                </button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 12 }}>
            {stageOps.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--hud-muted)", fontSize: 11, padding: 24 }}>No operators in {mobileStageLabel}</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {stageOps.map((op) => (
                  <div key={op.id} style={{ position: "relative" }}>
                    <KanbanCard op={op} draggable={false} onClick={() => setMobileCardMenu(mobileCardMenu?.id === op.id ? null : { id: op.id, op })} onQuickConfirm={handleQuickConfirm} />
                    {mobileCardMenu?.id === op.id && (
                      <div className="hud-card" style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, padding: 8, zIndex: 10 }}>
                        <div style={{ fontSize: 9, color: "var(--hud-muted)", marginBottom: 6 }}>Move to stage</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {stages.filter((s) => s.id !== op.stage).map((s) => (
                            <button key={s.id} type="button" onClick={() => moveToStage(op.id, s.id)} className="hud-btn" style={{ padding: "6px 10px", fontSize: 10 }}>{s.label}</button>
                          ))}
                        </div>
                        {op.stage !== "Confirmed" && (
                          <button type="button" onClick={() => { setPendingQuickConfirm(op); setMobileCardMenu(null); }} className="hud-btn" style={{ marginTop: 6, padding: "6px 10px", fontSize: 10, background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.5)", color: "#22c55e", fontWeight: 700, borderRadius: 6 }}>Confirm now</button>
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

  // Desktop/tablet (>= 1024px): all columns fit, no horizontal scroll; only column body scrolls
  return (
    <>
      {pendingQuickConfirm && (
        <QuickConfirmDialog op={pendingQuickConfirm} onConfirm={commitQuickConfirm} onCancel={() => setPendingQuickConfirm(null)} />
      )}
      <div className="hud-card kanban-desktop" style={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
      <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
        <div className="kanban-board-row" style={{ flex: 1, minHeight: 0, width: "100%", overflowX: "hidden", overflowY: "hidden", display: "flex", gap: 16, padding: 12, alignItems: "stretch", ["--kanban-cols"]: stages.length }}>
          {stages.map((stage) => {
            const stageOps = stageOpsByStage[stage.id] || [];
            const isOver = over === stage.id;
            const canDrop = dragOp && canMoveToStage(dragOp.stage, stage.id);
            const isHighlight = dropHighlight === stage.id;
            const stageColor = STAGE_COLORS[stage.id] || "#6366f1";
            return (
              <div
                key={stage.id}
                onDragOver={(e) => { e.preventDefault(); if (canDrop) setOver(stage.id); }}
                onDrop={() => drop(stage.id)}
                onDragLeave={() => setOver(null)}
                className="hud-card kanban-column"
                style={{
                  flex: "1 1 0",
                  minWidth: 0,
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  borderTop: "3px solid " + stageColor,
                  background: isHighlight ? "rgba(34,197,94,0.08)" : isOver && canDrop ? "rgba(255,255,255,0.04)" : undefined,
                  borderColor: isOver && canDrop ? stageColor + "60" : isHighlight ? "rgba(34,197,94,0.4)" : undefined,
                  transition: "background 0.2s, border-color 0.2s",
                }}
              >
                <div style={{ flexShrink: 0, padding: "10px 12px", borderBottom: "1px solid var(--hud-border)", background: "rgba(255,255,255,0.5)", position: "sticky", top: 0, zIndex: 2 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: stageColor, letterSpacing: "0.08em", fontFamily: "var(--hud-font-mono)" }}>// {stage.label.toUpperCase()} ({stageOps.length})</span>
                </div>
                <div style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", padding: "8px 8px 12px 8px", display: "flex", flexDirection: "column", gap: 8 }}>
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
            );
          })}
        </div>
      </div>
    </div>
    </>
  );
}

// ─── CREDENTIALS TRACKER ──────────────────────────────────────────────────────

function CredsTracker({ zones = [], ops = [], onUpdate, onAddOperator, onUpdateDefaultRate, isMobile }) {
  const [filter, setFilter] = useState("All");
  const [editingOp, setEditingOp] = useState(null);
  const filtered = filter==="All" ? ops : ops.filter(o=>o.cred===filter);
  const riskyOps = ops.filter(o=>o.risk==="HIGH");

  const filterRow = (
    <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
      {["All",...CRED_STATES].map(s=>(
        <button key={s} type="button" onClick={()=>setFilter(s)} className="hud-badge" style={{padding: isMobile ? "6px 12px" : "4px 12px",cursor:"pointer",fontSize:10,background:filter===s?(CRED_COLORS[s]||"#6366f1")+"33":undefined,borderColor:filter===s?(CRED_COLORS[s]||"#6366f1")+"88":undefined,color:filter===s?"#fff":"var(--hud-muted-strong)"}}>{s} ({s==="All"?ops.length:ops.filter(o=>o.cred===s).length})</button>
      ))}
      {onAddOperator && <button type="button" onClick={onAddOperator} className="hud-btn hud-btn-primary" style={{marginLeft: isMobile ? 0 : "auto",padding: isMobile ? "8px 14px" : "6px 12px",fontSize: isMobile ? 10 : 9}}>+ Add Operator</button>}
    </div>
  );

  if (isMobile) {
    return (
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <PageHeader label="CREDENTIALS" title="Credential Tracker" actions={null} />
        {riskyOps.length>0 && (
          <HudCard style={{ borderColor: "rgba(239,68,68,0.4)", background: "rgba(42,0,0,0.4)" }}>
            <div style={{fontSize:10,fontWeight:800,color:"#ef4444",letterSpacing:"0.08em",marginBottom:8}}>⚠ HIGH RISK</div>
            {riskyOps.slice(0, 5).map(op=>(
              <div key={op.id} style={{display:"flex",gap:6,alignItems:"center",fontSize:10,color:"#fca5a5",marginBottom:4,flexWrap:"wrap"}}>
                <Tag label="HIGH" color="#ef4444" small/>
                <span style={{fontWeight:700}}>{op.name}</span>
                <span style={{color:CRED_COLORS[op.cred]}}>{op.cred}</span>
              </div>
            ))}
            {riskyOps.length > 5 && <div style={{fontSize:9,color:"var(--hud-muted)"}}>+{riskyOps.length - 5} more</div>}
          </HudCard>
        )}
        {filterRow}
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {filtered.length===0 ? <div className="hud-card" style={{padding:24,textAlign:"center",color:"var(--hud-muted)",fontSize:11}}>No operators</div> : filtered.map(op=>(
            <HudCard key={op.id} style={{ background: op.cred==="Denied" ? "rgba(42,0,0,0.3)" : op.risk==="HIGH" ? "rgba(42,10,0,0.2)" : undefined }}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div><div style={{fontSize:12,fontWeight:700,color:"var(--hud-text)"}}>{op.name}</div><div style={{fontSize:10,color:"#64748b"}}>{op.opId||op.id}</div></div>
                <Tag label={op.cred} color={CRED_COLORS[op.cred]} small/>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
                <Tag label={op.credType} color={CRED_TYPE_COLORS[op.credType]} small/>
                <Tag label={op.zone} color="#6366f1" small/>
                <span style={{fontSize:10,color:"#22c55e",fontWeight:700}}>${op.rate??0}</span>
              </div>
              <select value={op.cred} onChange={e=>onUpdate(op.id,{cred:e.target.value})} className="hud-input" style={{marginBottom:6,color:CRED_COLORS[op.cred],fontWeight:700}}>
                {CRED_STATES.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              <button type="button" onClick={()=>setEditingOp(op)} className="hud-btn hud-btn-primary" style={{width:"100%",padding:8,fontSize:10}}>Edit</button>
            </HudCard>
          ))}
        </div>
        {editingOp && <EditOperatorModal zones={zones} op={editingOp} onSave={onUpdate} onClose={()=>setEditingOp(null)} onUpdateDefaultRate={onUpdateDefaultRate}/>}
      </div>
    );
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <PageHeader label="CREDENTIALS" title="Credential Tracker" actions={null} />
      {riskyOps.length>0 && (
        <HudCard style={{ borderColor: "rgba(239,68,68,0.4)", background: "rgba(42,0,0,0.4)" }}>
          <div style={{fontSize:10,fontWeight:800,color:"#ef4444",letterSpacing:"0.08em",marginBottom:8}}>⚠ HIGH RISK FLAGS — IMMEDIATE ACTION</div>
          {riskyOps.map(op=>(
            <div key={op.id} style={{display:"flex",gap:8,alignItems:"center",fontSize:11,color:"#fca5a5",marginBottom:5,flexWrap:"wrap"}}>
              <Tag label="HIGH" color="#ef4444" small/>
              <span style={{fontWeight:700}}>{op.name}</span>
              <span style={{color:"#64748b"}}>{op.id}</span>
              <span>·</span>
              <span style={{color:CRED_COLORS[op.cred]}}>{op.cred}</span>
              <span>·</span>
              <Tag label={op.credType} color={CRED_TYPE_COLORS[op.credType]} small/>
              {op.lateToScreen && <Tag label="Late Screen" color="#f59e0b" small/>}
              {op.rateInstability && <Tag label="Rate Instability" color="#f59e0b" small/>}
              {!op.workedWithMemeHouse && !op.refs && <Tag label="New+No Refs" color="#f59e0b" small/>}
            </div>
          ))}
        </HudCard>
      )}
      {filterRow}
      <div className="hud-table-wrap hud-table-wrap--scroll-mobile">
        <div className="glass-panel-table-header" style={{display:"grid",gridTemplateColumns:"80px 1fr 65px 95px 110px 125px 75px 60px 50px",borderBottom:"1px solid var(--hud-border)",padding:"10px 14px",gap:8}}>
          {["ID","Name","Tier","Zone","Cred Status","Cred Type","Rate","Risk",""].map(h=>(
            <span key={h} style={{fontSize:9,fontWeight:800,color:"var(--hud-muted)",letterSpacing:"0.07em",fontFamily:"var(--hud-font-mono)"}}>{h}</span>
          ))}
        </div>
        <div style={{maxHeight:440,overflowY:"auto"}}>
          {filtered.length===0 ? <div style={{padding:24,textAlign:"center",color:"var(--hud-muted)",fontSize:11}}>No operators yet</div> : filtered.map(op=>(
            <div key={op.id} className="glass-panel-row" style={{display:"grid",gridTemplateColumns:"80px 1fr 65px 95px 110px 125px 75px 60px 50px",padding:"10px 14px",gap:8,borderBottom:"1px solid rgba(255,255,255,0.05)",alignItems:"center",
              background:op.cred==="Denied"?"rgba(42,0,0,0.3)":op.risk==="HIGH"?"rgba(42,10,0,0.2)":undefined}}>
              <span style={{fontSize:10,color:"var(--hud-muted)",fontFamily:"var(--hud-font-mono)"}}>{op.opId||op.id}</span>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:"var(--hud-text)"}}>{op.name}</div>
                <div style={{fontSize:9,color:"var(--hud-muted)"}}>{op.workedWithMemeHouse?"✓ MH Alumni":op.source||''}</div>
              </div>
              <Tag label={op.tier} color={(TIERS[op.tier]||TIERS.T2).color} small/>
              <span style={{fontSize:10,color:"var(--hud-muted-strong)",fontWeight:600}}>{op.zone||'—'}</span>
              <select value={op.cred} onChange={e=>onUpdate(op.id,{cred:e.target.value})} className="hud-input" style={{background:"transparent",border:"none",color:CRED_COLORS[op.cred],fontSize:10,fontWeight:700,cursor:"pointer",padding:4}}>
                {CRED_STATES.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              <select value={op.credType} onChange={e=>onUpdate(op.id,{credType:e.target.value})} className="hud-input" style={{background:"transparent",border:"none",color:CRED_TYPE_COLORS[op.credType],fontSize:10,fontWeight:700,cursor:"pointer",padding:4}}>
                {CRED_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
              <span style={{fontSize:10,color:"#22c55e",fontWeight:700}}>${op.rate??0}</span>
              <Tag label={op.risk} color={RISK_COLORS[op.risk]||"#64748b"} small/>
              <button type="button" onClick={()=>setEditingOp(op)} className="hud-btn hud-btn-primary" style={{padding:"4px 10px",fontSize:9}}>Edit</button>
            </div>
          ))}
        </div>
      </div>
      {editingOp && <EditOperatorModal zones={zones} op={editingOp} onSave={onUpdate} onClose={()=>setEditingOp(null)} onUpdateDefaultRate={onUpdateDefaultRate}/>}
    </div>
  );
}

// ─── OPERATORS (editable roster) ──────────────────────────────────────────────

function OperatorsView({ zones = [], ops = [], onUpdate, onAddOperator, onUpdateDefaultRate, isMobile }) {
  const [editingOp, setEditingOp] = useState(null);
  const [search, setSearch] = useState("");
  const q = (search || "").toLowerCase().trim();
  const filtered = (Array.isArray(ops) ? ops : []).filter(o =>
    !q || (o.name || "").toLowerCase().includes(q) || (o.opId || "").toLowerCase().includes(q) || (o.zone || "").toLowerCase().includes(q)
  );

  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <PageHeader label="OPERATORS" title="Operator Roster" actions={onAddOperator ? <button type="button" onClick={onAddOperator} className="hud-btn hud-btn-primary">+ Add Operator</button> : null} />
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, ID, zone..." className="hud-input" style={{ marginBottom: 8 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.length === 0 ? (
            <div className="hud-card" style={{ padding: 32, textAlign: "center", color: "var(--hud-muted)", fontSize: 11 }}>No operators yet.</div>
          ) : filtered.map(op => (
            <HudCard key={op.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--hud-text)" }}>{op.name || "—"}</div>
                  <div style={{ fontSize: 10, color: "#64748b" }}>{op.opId || op.id} · {op.zone || "—"}</div>
                </div>
                <span style={{ fontSize: 11, color: "#22c55e", fontWeight: 700 }}>${op.rate ?? 0}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                <Tag label={op.stage || "—"} color={STAGE_COLORS[op.stage] || "#64748b"} small />
                <Tag label={op.cred || "—"} color={CRED_COLORS[op.cred] || "#64748b"} small />
              </div>
              <button type="button" onClick={()=>setEditingOp(op)} className="hud-btn hud-btn-primary" style={{ width: "100%", padding: "8px 12px", fontSize: 10 }}>Edit</button>
            </HudCard>
          ))}
        </div>
        <div style={{ fontSize: 10, color: "var(--hud-muted)" }}>{filtered.length} of {ops.length} operators</div>
        {editingOp && <EditOperatorModal zones={zones} op={editingOp} onSave={onUpdate} onClose={()=>setEditingOp(null)} onUpdateDefaultRate={onUpdateDefaultRate}/>}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <PageHeader label="OPERATORS" title="Operator Roster" actions={onAddOperator ? <button type="button" onClick={onAddOperator} className="hud-btn hud-btn-primary">+ Add Operator</button> : null} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, ID, zone..." className="hud-input" style={{ flex: 1, minWidth: 200 }} />
      </div>
      <div className="hud-table-wrap hud-table-wrap--scroll-mobile">
        <div className="glass-panel-table-header" style={{display:"grid",gridTemplateColumns:"75px 1fr 110px 95px 95px 110px 75px 55px",borderBottom:"1px solid var(--hud-border)",padding:"10px 14px",gap:8}}>
          {["ID","Name","Phone","Zone","Stage","Cred Status","Day Rate",""].map(h=>(
            <span key={h} style={{fontSize:9,fontWeight:800,color:"var(--hud-muted)",letterSpacing:"0.07em",fontFamily:"var(--hud-font-mono)"}}>{h}</span>
          ))}
        </div>
        <div style={{maxHeight:520,overflowY:"auto"}}>
          {filtered.length===0 ? (
            <div style={{padding:32,textAlign:"center",color:"var(--hud-muted)",fontSize:11}}>No operators yet. Add your first operator to get started.</div>
          ) : filtered.map(op=>(
            <div key={op.id} className="glass-panel-row" style={{display:"grid",gridTemplateColumns:"75px 1fr 110px 95px 95px 110px 75px 55px",padding:"10px 14px",gap:8,borderBottom:"1px solid rgba(255,255,255,0.05)",alignItems:"center",
              background:op.cred==="Denied"?"rgba(42,0,0,0.3)":undefined}}>
              <span style={{fontSize:10,color:"var(--hud-muted)",fontFamily:"var(--hud-font-mono)"}}>{op.opId||op.id}</span>
              <span style={{fontSize:11,fontWeight:700,color:"var(--hud-text)"}}>{op.name||'—'}</span>
              <span style={{fontSize:10,color:"var(--hud-muted-strong)"}}>{op.phone||'—'}</span>
              <span style={{fontSize:10,color:"var(--hud-muted-strong)"}}>{op.zone||'—'}</span>
              <span style={{fontSize:10,color:(STAGE_COLORS[op.stage]||"#64748b"),fontWeight:600}}>{op.stage||'—'}</span>
              <span style={{fontSize:10,color:(CRED_COLORS[op.cred]||"#64748b"),fontWeight:600}}>{op.cred||'—'}</span>
              <span style={{fontSize:10,color:"#22c55e",fontWeight:700}}>${op.rate??0}</span>
              <button type="button" onClick={()=>setEditingOp(op)} className="hud-btn hud-btn-primary" style={{padding:"4px 10px",fontSize:9}}>Edit</button>
            </div>
          ))}
        </div>
        <div className="glass-panel-table-header" style={{padding:"8px 14px",borderTop:"1px solid var(--hud-border)",fontSize:10,color:"var(--hud-muted)"}}>
          {filtered.length} of {ops.length} operators
        </div>
      </div>
      {editingOp && <EditOperatorModal zones={zones} op={editingOp} onSave={onUpdate} onClose={()=>setEditingOp(null)} onUpdateDefaultRate={onUpdateDefaultRate}/>}
    </div>
  );
}

// ─── DEPLOYMENT MATRIX ────────────────────────────────────────────────────────

function DeployMatrix({ zones = [], ops }) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{background:"#0a1628",border:"1px solid #1e3a5f",borderRadius:8,padding:"10px 16px",fontSize:10,color:"#64748b"}}>
        🔒 <strong style={{color:"#0ea5e9"}}>Deployment Protection Active</strong> — Festival zone requires Approved credential + Artist / Vendor / Festival Grounds badge. Violations flagged in red.
      </div>
      {!zones.length ? (
        <div className="glass-panel" style={{padding:24,textAlign:"center",color:"var(--hud-muted)",fontSize:12}}>No zones configured. Add zones in project settings to see deployment matrix.</div>
      ) : (
      <>
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10}}>
        {zones.map(zone=>{
          const zoneOps   = ops.filter(o=>o.zone===zone);
          const confirmed = zoneOps.filter(o=>o.stage==="Confirmed");
          const violations= confirmed.filter(o=>!canAssignToZone(o,zone).ok);
          const credOk    = confirmed.filter(o=>canAssignToZone(o,zone).ok);
          const status    = credOk.length>=2?"READY":confirmed.length>0?"PARTIAL":"UNASSIGNED";
          const sc        = status==="READY"?"#22c55e":status==="PARTIAL"?"#f59e0b":"#ef4444";
          const isFest    = RESTRICTED_ZONES.includes(zone);

          return (
            <div key={zone} style={{background:"#0f172a",border:`1px solid ${violations.length>0?"#ef4444":sc+"44"}`,borderTop:`3px solid ${sc}`,borderRadius:8,padding:"12px 12px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                <div style={{fontSize:9,fontWeight:800,color:sc,letterSpacing:"0.07em"}}>{status}</div>
                {isFest && <div style={{fontSize:9,color:"#f59e0b",fontWeight:700}}>🔒 CRED</div>}
              </div>
              <div style={{fontSize:13,fontWeight:900,color:"var(--hud-text)",marginBottom:6}}>{zone}</div>
              <div style={{fontSize:10,color:"#94a3b8",marginBottom:8}}>{confirmed.length} conf · {credOk.length} valid</div>
              {violations.length>0 && (
                <div style={{background:"#1a0000",border:"1px solid #ef4444",borderRadius:4,padding:"4px 7px",marginBottom:8}}>
                  <div style={{fontSize:9,color:"#ef4444",fontWeight:700}}>⚠ {violations.length} ACCESS VIOLATION{violations.length>1?"S":""}</div>
                  {violations.map(o=><div key={o.id} style={{fontSize:9,color:"#fca5a5"}}>{o.name}: {canAssignToZone(o,zone).reason}</div>)}
                </div>
              )}
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                {confirmed.slice(0,4).map(op=>{
                  const chk=canAssignToZone(op,zone);
                  return (
                    <div key={op.id} style={{display:"flex",gap:5,alignItems:"center"}}>
                      <div style={{width:5,height:5,borderRadius:99,background:chk.ok?"#22c55e":"#ef4444",flexShrink:0}}/>
                      <span style={{fontSize:9,color:"#94a3b8",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{op.name}</span>
                      <Stars value={op.reliability}/>
                    </div>
                  );
                })}
                {confirmed.length>4 && <div style={{fontSize:9,color:"#475569"}}>+{confirmed.length-4} more</div>}
                {confirmed.length===0 && <div style={{fontSize:9,color:"#ef4444",fontWeight:700}}>No ops assigned</div>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="glass-panel" style={{padding:"12px 16px",display:"flex",gap:18,alignItems:"center",flexWrap:"wrap"}}>
        <span style={{fontSize:10,color:"#475569",fontWeight:800,letterSpacing:"0.08em"}}>LEGEND</span>
        {[["READY","#22c55e","2+ valid ops"],["PARTIAL","#f59e0b","Some pending"],["UNASSIGNED","#ef4444","No confirmed ops"]].map(([s,c,d])=>(
          <div key={s} style={{display:"flex",gap:5,alignItems:"center"}}>
            <div style={{width:7,height:7,borderRadius:99,background:c}}/>
            <span style={{fontSize:10,color:c,fontWeight:700}}>{s}</span>
            <span style={{fontSize:10,color:"#475569"}}>{d}</span>
          </div>
        ))}
        <div style={{display:"flex",gap:5,alignItems:"center"}}>
          <div style={{width:5,height:5,borderRadius:99,background:"#22c55e"}}/>
          <span style={{fontSize:10,color:"#94a3b8"}}>Valid access</span>
          <div style={{width:5,height:5,borderRadius:99,background:"#ef4444",marginLeft:6}}/>
          <span style={{fontSize:10,color:"#94a3b8"}}>Access violation</span>
        </div>
      </div>
      </>
      )}
    </div>
  );
}

// ─── EMERGENCY POOL ───────────────────────────────────────────────────────────

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
              <Tag label={op.tier} color={TIERS[op.tier].color} small/>
            </div>
            <div style={{display:"flex",gap:5,marginBottom:8,flexWrap:"wrap",alignItems:"center"}}>
              <Stars value={op.reliability}/>
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
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        <StatCard label="Ops Reviewed"   value={reviewed.length}  sub={`of ${ops.length} total`}    accent="#6366f1"/>
        <StatCard label="Avg Perf Score" value={avgScore}          sub="Out of 5.0"                  accent="#f59e0b"/>
        <StatCard label="Rehire Eligible" value={rehireYes.length} sub="Available for next event"    accent="#22c55e"/>
        <StatCard label="Do Not Rehire"  value={rehireNo.length}   sub="Flagged in roster DB"        accent="#ef4444"/>
      </div>
      <div style={{background:"#0a1628",border:"1px solid #1e3a5f",borderRadius:8,padding:"10px 16px",fontSize:10,color:"#64748b"}}>
        📁 <strong style={{color:"#f59e0b"}}>FESTIVAL_ROSTER_DB</strong> — All reviewed ops are automatically written to the reusable festival database for future event hiring.
      </div>
      <div style={{display:"flex",gap:6}}>
        {[["all","All Ops","#64748b"],["reviewed","Reviewed","#6366f1"],["rehire","Rehire ✓","#22c55e"],["no-rehire","No Rehire ✗","#ef4444"]].map(([v,l,c])=>(
          <button key={v} onClick={()=>setFilter(v)} style={{padding:"4px 12px",borderRadius:99,border:"none",cursor:"pointer",fontSize:10,fontWeight:700,background:filter===v?c:"#1e293b",color:filter===v?"#fff":"#64748b"}}>{l}</button>
        ))}
      </div>
      <div className="glass-panel" style={{overflow:"hidden"}}>
        <div className="glass-panel-table-header" style={{display:"grid",gridTemplateColumns:"80px 1fr 60px 85px 100px 85px 1fr",borderBottom:"1px solid rgba(255,255,255,0.08)",padding:"9px 14px",gap:8}}>
          {["ID","Name","Tier","Zone","Perf Score","Rehire?","Notes"].map(h=>(
            <span key={h} style={{fontSize:9,fontWeight:800,color:"#475569",letterSpacing:"0.07em"}}>{h}</span>
          ))}
        </div>
        <div style={{maxHeight:480,overflowY:"auto"}}>
          {filtered.map(op=>(
            <div key={op.id} className="glass-panel-row" style={{display:"grid",gridTemplateColumns:"80px 1fr 60px 85px 100px 85px 1fr",padding:"10px 14px",gap:8,borderBottom:"1px solid rgba(255,255,255,0.05)",alignItems:"center",
              background:op.rehireEligible===false?"rgba(42,0,0,0.4)":op.rehireEligible===true?"rgba(0,42,10,0.4)":undefined}}>
              <span style={{fontSize:10,color:"#64748b",fontFamily:"monospace"}}>{op.id}</span>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:"var(--hud-text)"}}>{op.name}</div>
                <div style={{fontSize:9,color:"#475569"}}>{op.workedWithMemeHouse?"✓ MH Alumni":op.source}</div>
              </div>
              <Tag label={op.tier} color={TIERS[op.tier].color} small/>
              <span style={{fontSize:10,color:"#94a3b8",fontWeight:600}}>{op.zone}</span>
              <Stars value={op.perfScore||0} onChange={v=>onUpdate(op.id,{perfScore:v})}/>
              <div style={{display:"flex",gap:3}}>
                <button onClick={()=>onUpdate(op.id,{rehireEligible:true})} style={{padding:"2px 7px",borderRadius:4,border:"none",cursor:"pointer",fontSize:9,fontWeight:700,background:op.rehireEligible===true?"#22c55e":"#1e293b",color:op.rehireEligible===true?"#fff":"#64748b"}}>Y</button>
                <button onClick={()=>onUpdate(op.id,{rehireEligible:false})} style={{padding:"2px 7px",borderRadius:4,border:"none",cursor:"pointer",fontSize:9,fontWeight:700,background:op.rehireEligible===false?"#ef4444":"#1e293b",color:op.rehireEligible===false?"#fff":"#64748b"}}>N</button>
              </div>
              <input value={op.postNotes||""} onChange={e=>onUpdate(op.id,{postNotes:e.target.value})}
                placeholder="Post-event note..."
                style={{background:"transparent",border:"none",borderBottom:"1px solid #1e293b",color:"#94a3b8",fontSize:10,outline:"none",width:"100%",padding:"2px 0"}}/>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── EDIT OPERATOR MODAL ──────────────────────────────────────────────────────
function EditOperatorModal({ op, zones = [], onSave, onClose, onUpdateDefaultRate }) {
  const defaultZone = zones.length ? (zones.includes(op?.zone) ? op.zone : zones[0]) : (op?.zone || '');
  const [form, setForm] = useState({ full_name: op?.name||'', phone: op?.phone||'', day_rate: op?.rate||0, zone: defaultZone, cred_status: op?.cred||'Not Started' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  useEffect(() => { if (op) setForm({ full_name: op.name||'', phone: op.phone||'', day_rate: op.rate||0, zone: zones.length ? (zones.includes(op.zone) ? op.zone : zones[0]) : (op.zone||''), cred_status: op.cred||'Not Started' }); }, [op, zones]);
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr(null); setSaving(true);
    try {
      await onSave(op.id, { name: form.full_name, phone: form.phone, rate: Number(form.day_rate)||0, zone: form.zone, cred: form.cred_status });
      onClose();
    } catch (e) { setErr(e?.message || 'Failed'); }
    finally { setSaving(false); }
  };
  if (!op) return null;
  return (
    <div className="hud-modal-overlay" onClick={onClose}>
      <div className="hud-modal-panel" style={{padding:24}} onClick={e=>e.stopPropagation()}>
        <div className="hud-page-label" style={{marginBottom:4}}>// EDIT OPERATOR</div>
        <div style={{fontSize:13,fontWeight:800,color:"var(--hud-text)",marginBottom:16}}>Edit Operator</div>
        {err && <div style={{fontSize:10,color:"#ef4444",marginBottom:12}}>{err}</div>}
        <form onSubmit={handleSubmit} style={{display:"flex",flexDirection:"column",gap:12}}>
          <div>
            <label style={{fontSize:9,color:"var(--hud-muted)",display:"block",marginBottom:4}}>Full Name</label>
            <input className="hud-glass-input" value={form.full_name} onChange={e=>setForm(f=>({...f,full_name:e.target.value}))} required />
          </div>
          <div>
            <label style={{fontSize:9,color:"var(--hud-muted)",display:"block",marginBottom:4}}>Phone</label>
            <input className="hud-glass-input" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} />
          </div>
          <div>
            <label style={{fontSize:9,color:"var(--hud-muted)",display:"block",marginBottom:4}}>Day Rate (this project)</label>
            <input className="hud-glass-input" type="number" value={form.day_rate||''} onChange={e=>setForm(f=>({...f,day_rate:e.target.value}))} min={0} placeholder="500" />
          </div>
          {onUpdateDefaultRate && (
            <div>
              <button type="button" onClick={() => { onUpdateDefaultRate(op.id, Number(form.day_rate) || 0); }} style={{fontSize:10,color:"var(--hud-muted)",background:"none",border:"none",cursor:"pointer",textDecoration:"underline"}}>Update default rate in library</button>
            </div>
          )}
          <div>
            <label style={{fontSize:9,color:"var(--hud-muted)",display:"block",marginBottom:4}}>Zone</label>
            <select className="hud-glass-input" value={zones.length ? form.zone : ''} onChange={e=>setForm(f=>({...f,zone:e.target.value}))} disabled={!zones.length}>
              {!zones.length ? <option value="">No zones yet — add in Settings</option> : zones.map(z=><option key={z} value={z}>{z}</option>)}
            </select>
          </div>
          <div>
            <label style={{fontSize:9,color:"var(--hud-muted)",display:"block",marginBottom:4}}>Credential Status</label>
            <select className="hud-glass-input" value={form.cred_status} onChange={e=>setForm(f=>({...f,cred_status:e.target.value}))}>
              {CRED_STATES.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{display:"flex",gap:8,marginTop:4}}>
            <button type="button" onClick={onClose} className="hud-btn" style={{flex:1}}>Cancel</button>
            <button type="submit" disabled={saving} className="hud-btn hud-btn-primary" style={{flex:1}}>{saving?"Saving...":"Save"}</button>
          </div>
          <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid var(--hud-border)"}}>
            <button type="button" onClick={() => { onSave(op.id, { isArchived: true }); onClose(); }} className="hud-btn" style={{width:"100%",borderColor:"var(--hud-muted)"}}>Archive Operator</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── ADD OPERATOR MODAL (From Library | New Operator) ──────────────────────────
function AddOperatorModal({ zones = [], onSave, onClose, projectId }) {
  const defaultZone = zones.length ? zones[0] : '';
  const [tab, setTab] = useState(projectId ? 'library' : 'new');
  const [form, setForm] = useState({ full_name: '', tier: 'T2', zone: defaultZone, hire_stage: 'Outreach', cred_status: 'Not Started', cred_type: 'None', day_rate: '', planned_days: 1 });
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
      await onSave({ ...form, day_rate: rate, planned_days: plannedDays, hire_stage: hireStage });
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
    <div className="hud-modal-overlay" onClick={onClose}>
      <div className="hud-modal-panel" style={{padding:24, maxWidth: 440}} onClick={e=>e.stopPropagation()}>
        <div className="hud-page-label" style={{marginBottom:4}}>// ADD OPERATOR</div>
        <div style={{fontSize:13,fontWeight:800,color:"var(--hud-text)",marginBottom:12}}>Add Operator</div>
        {projectId && (
          <div style={{display:"flex",gap:4,marginBottom:16}}>
            <button type="button" onClick={()=>setTab('library')} style={{padding:"6px 12px",borderRadius:8,border:"1px solid var(--hud-border)",background:tab==='library'?'var(--hud-glow-accent)':'transparent',color:"var(--hud-text)",fontSize:10,fontWeight:700,cursor:"pointer"}}>From Library</button>
            <button type="button" onClick={()=>setTab('new')} style={{padding:"6px 12px",borderRadius:8,border:"1px solid var(--hud-border)",background:tab==='new'?'var(--hud-glow-accent)':'transparent',color:"var(--hud-text)",fontSize:10,fontWeight:700,cursor:"pointer"}}>New Operator</button>
          </div>
        )}
        {err && <div style={{fontSize:10,color:"#ef4444",marginBottom:12}}>{err}</div>}

        {tab === 'library' && projectId ? (
          <form onSubmit={handleAddFromLibrary} style={{display:"flex",flexDirection:"column",gap:10}}>
            <div>
              <label style={{fontSize:9,color:"var(--hud-muted)",display:"block",marginBottom:4}}>Search by name or ID</label>
              <input className="hud-glass-input" value={librarySearch} onChange={e=>setLibrarySearch(e.target.value)} placeholder="Type to filter..." />
            </div>
            <div style={{maxHeight:180,overflowY:"auto",border:"1px solid var(--hud-border)",borderRadius:8,padding:4}}>
              {libraryLoading ? <div style={{padding:12,fontSize:10,color:"var(--hud-muted)"}}>Loading...</div> : libraryFiltered.length === 0 ? <div style={{padding:12,fontSize:10,color:"var(--hud-muted)"}}>No operators in library. Use New Operator to add one.</div> : libraryFiltered.map((o) => (
                <button key={o.id} type="button" onClick={()=>{ setSelectedLibraryOp(o); setLibraryProjectRate(o.day_rate != null ? String(o.day_rate) : ''); }} style={{display:"block",width:"100%",textAlign:"left",padding:"8px 10px",borderRadius:6,border:"none",background:selectedLibraryOp?.id===o.id?'var(--hud-glow-accent)':'transparent',color:"var(--hud-text)",fontSize:11,cursor:"pointer",marginBottom:2}}>
                  {o.full_name || '—'} · {o.op_id || o.id} · ${o.day_rate ?? 0}
                </button>
              ))}
            </div>
            {selectedLibraryOp && (
              <>
                <div>
                  <label style={{fontSize:9,color:"var(--hud-muted)",display:"block",marginBottom:4}}>Project day rate (editable for this project)</label>
                  <input className="hud-glass-input" type="number" min={0} value={libraryProjectRate} onChange={e=>setLibraryProjectRate(e.target.value)} placeholder={String(selectedLibraryOp.day_rate ?? 0)} />
                </div>
                <div>
                  <label style={{fontSize:9,color:"var(--hud-muted)",display:"block",marginBottom:4}}>Zone</label>
                  <select className="hud-glass-input" value={zones.length ? libraryZone : ''} onChange={e=>setLibraryZone(e.target.value)} disabled={!zones.length}>
                    {!zones.length ? <option value="">No zones yet</option> : zones.map(z=><option key={z} value={z}>{z}</option>)}
                  </select>
                </div>
                <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
                  <input type="checkbox" checked={confirmImmediately} onChange={e=>setConfirmImmediately(e.target.checked)} style={{accentColor:"#22c55e",width:14,height:14}} />
                  <span style={{fontSize:10,color:"var(--hud-text)",fontWeight:600}}>Confirm immediately</span>
                </label>
              </>
            )}
            <div style={{display:"flex",gap:10,marginTop:8}}>
              <button type="button" onClick={onClose} style={{flex:1,padding:10,background:"rgba(51,65,85,0.6)",border:"1px solid var(--hud-border)",borderRadius:10,color:"var(--hud-muted)",fontSize:10,cursor:"pointer",fontWeight:700}}>Cancel</button>
              <button type="submit" disabled={!selectedLibraryOp || librarySubmitting} style={{flex:1,padding:10,background:"#6366f1",border:"none",borderRadius:10,color:"#fff",fontSize:10,cursor:selectedLibraryOp&&!librarySubmitting?"pointer":"not-allowed",fontWeight:700}}>{librarySubmitting ? 'Adding...' : 'Add to project'}</button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmitNew} style={{display:"flex",flexDirection:"column",gap:10}}>
            <div>
              <label style={{fontSize:9,color:"var(--hud-muted)",display:"block",marginBottom:4}}>Full Name *</label>
              <input className="hud-glass-input" value={form.full_name} onChange={e=>setForm(f=>({...f,full_name:e.target.value}))} required placeholder="Jane Doe" />
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div>
                <label style={{fontSize:9,color:"var(--hud-muted)",display:"block",marginBottom:4}}>Tier</label>
                <select className="hud-glass-input" value={form.tier} onChange={e=>setForm(f=>({...f,tier:e.target.value}))}>
                  {Object.keys(TIERS).map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:9,color:"var(--hud-muted)",display:"block",marginBottom:4}}>Day Rate</label>
                <input className="hud-glass-input" type="number" value={form.day_rate} onChange={e=>setForm(f=>({...f,day_rate:e.target.value}))} min={0} placeholder="500" />
              </div>
            </div>
            <div>
              <label style={{fontSize:9,color:"var(--hud-muted)",display:"block",marginBottom:4}}>Planned Days (≥ 0)</label>
              <input className="hud-glass-input" type="number" value={form.planned_days} onChange={e=>setForm(f=>({...f,planned_days:e.target.value}))} min={0} step={1} placeholder="1" />
            </div>
            <div>
              <label style={{fontSize:9,color:"var(--hud-muted)",display:"block",marginBottom:4}}>Zone</label>
              <select className="hud-glass-input" value={zones.length ? form.zone : ''} onChange={e=>setForm(f=>({...f,zone:e.target.value}))} disabled={!zones.length}>
                {!zones.length ? <option value="">No zones yet — add in Settings</option> : zones.map(z=><option key={z} value={z}>{z}</option>)}
              </select>
            </div>
            {projectId && (
              <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginTop:4}}>
                <input type="checkbox" checked={confirmImmediately} onChange={e=>setConfirmImmediately(e.target.checked)} style={{accentColor:"#22c55e",width:14,height:14}} />
                <span style={{fontSize:10,color:"var(--hud-text)",fontWeight:600}}>Confirm immediately</span>
              </label>
            )}
            <div style={{display:"flex",gap:10,marginTop:8}}>
              <button type="button" onClick={onClose} style={{flex:1,padding:10,background:"rgba(51,65,85,0.6)",border:"1px solid var(--hud-border)",borderRadius:10,color:"var(--hud-muted)",fontSize:10,cursor:"pointer",fontWeight:700}}>Cancel</button>
              <button type="submit" style={{flex:1,padding:10,background:"#6366f1",border:"none",borderRadius:10,color:"#fff",fontSize:10,cursor:"pointer",fontWeight:700}}>Add Operator</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── ALL OPERATORS ────────────────────────────────────────────────────────────
const STATUS_PRIORITY = { Confirmed: 0, Approved: 1, "LOA Signed": 2, Offered: 3, Interviewing: 4, Screened: 5, Responded: 6, Outreach: 7, Passed: 8 };

function QuickConfirmDialog({ op, onConfirm, onCancel }) {
  if (!op) return null;
  return (
    <div className="hud-modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={onCancel}>
      <div className="hud-modal-panel" style={{ padding: 20, maxWidth: 320, background: "var(--hud-panel)", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "var(--hud-text)", marginBottom: 8 }}>Confirm this operator now?</div>
        <div style={{ fontSize: 11, color: "var(--hud-muted)", marginBottom: 16 }}>{op.name || "—"} will be moved directly to Confirmed. Metrics will update immediately.</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button type="button" onClick={onCancel} className="hud-btn" style={{ padding: "8px 14px", fontSize: 10 }}>Cancel</button>
          <button type="button" onClick={onConfirm} className="hud-btn" style={{ padding: "8px 14px", fontSize: 10, background: "#22c55e", border: "none", color: "#fff", fontWeight: 700, borderRadius: 8 }}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

function OpsTable({ zones = [], ops = [], onUpdate, onAddOperator }) {
  const [sort, setSort]         = useState("status");
  const [search, setSearch]     = useState("");
  const [stageF, setStageF]     = useState("All");
  const [zoneF, setZoneF]       = useState("All");
  const [credF, setCredF]       = useState("All");
  const [availabilityF, setAvailabilityF] = useState("All");
  const [selected, setSelected] = useState(null);
  const [pendingQuickConfirm, setPendingQuickConfirm] = useState(null);

  const safe = o => {
    if (!o || typeof o !== 'object') return { id:0, opId:'—', name:'', tier:'T2', zone:'Floater', stage:'Outreach', cred:'Not Started', credType:'None', rate:0, reliability:3, risk:'LOW', loa:false, gear:[], source:'', workedWithMemeHouse:false, isBuffer:false, plannedDays:1, active:true };
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

  const cols = "80px 1fr 95px 90px 80px 100px 55px 55px 72px";
  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {pendingQuickConfirm && (
        <QuickConfirmDialog
          op={pendingQuickConfirm}
          onConfirm={commitQuickConfirm}
          onCancel={() => setPendingQuickConfirm(null)}
        />
      )}
      <div style={{display:"flex",gap:7,flexWrap:"wrap",alignItems:"center"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, ID, zone..."
          style={{background:"#1e293b",border:"1px solid #334155",borderRadius:6,padding:"6px 12px",color:"var(--hud-text)",fontSize:11,outline:"none",flex:1,minWidth:160}}/>
        <select value={stageF} onChange={e=>setStageF(e.target.value)} style={{background:"var(--hud-input-bg)",border:"1px solid var(--hud-input-border)",borderRadius:6,padding:"6px 10px",color:"var(--hud-text)",fontSize:10,outline:"none"}}>
          <option value="All">All Status</option>{HIRE_STAGES.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        <select value={zoneF} onChange={e=>setZoneF(e.target.value)} style={{background:"var(--hud-input-bg)",border:"1px solid var(--hud-input-border)",borderRadius:6,padding:"6px 10px",color:"var(--hud-text)",fontSize:10,outline:"none"}}>
          <option value="All">All Zones</option>{zones.map(z=><option key={z} value={z}>{z}</option>)}
        </select>
        <select value={credF} onChange={e=>setCredF(e.target.value)} style={{background:"var(--hud-input-bg)",border:"1px solid var(--hud-input-border)",borderRadius:6,padding:"6px 10px",color:"var(--hud-text)",fontSize:10,outline:"none"}}>
          <option value="All">All Cred</option>{CRED_STATES.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
        <select value={availabilityF} onChange={e=>setAvailabilityF(e.target.value)} style={{background:"var(--hud-input-bg)",border:"1px solid var(--hud-input-border)",borderRadius:6,padding:"6px 10px",color:"var(--hud-text)",fontSize:10,outline:"none"}}>
          <option value="All">All</option>
          <option value="Broadcast">📡 Broadcast</option>
        </select>
        {["status","name","rate","rel"].map(s=>(
          <button key={s} onClick={()=>setSort(s)} style={{padding:"5px 9px",borderRadius:5,border:"none",cursor:"pointer",fontSize:9,fontWeight:700,background:sort===s?"#6366f1":"#1e293b",color:sort===s?"#fff":"#64748b"}}>↕ {s==="rel"?"REL":s.toUpperCase()}</button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="glass-panel" style={{padding:48,textAlign:"center"}}>
          <div style={{fontSize:14,color:"#64748b",marginBottom:12}}>No operators yet</div>
          <div style={{fontSize:11,color:"#475569",marginBottom:16}}>Add your first operator to get started</div>
          {onAddOperator && <button onClick={onAddOperator} style={{padding:"10px 20px",background:"#6366f1",border:"none",borderRadius:6,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer"}}>+ Add Operator</button>}
        </div>
      ) : (
    <div style={{display:"flex",gap:14}}>
      <div style={{flex:1,display:"flex",flexDirection:"column",gap:10}}>
        <div className="glass-panel" style={{overflow:"hidden"}}>
          <div className="glass-panel-table-header" style={{display:"grid",gridTemplateColumns:cols,borderBottom:"1px solid rgba(255,255,255,0.08)",padding:"9px 14px",gap:7}}>
            {["ID","Full Name","Stage","Zone","Day Rate","Credential","LOA","Risk",""].map(h=>(
              <span key={h || "actions"} style={{fontSize:9,fontWeight:800,color:"#475569",letterSpacing:"0.06em"}}>{h}</span>
            ))}
          </div>
          <div style={{maxHeight:490,overflowY:"auto"}}>
            {filtered.map((o,i)=>(
              <div key={o.id ?? o.opId ?? `op-${i}`} onClick={()=>setSelected(selected===o.id?null:o.id)}
                className="glass-panel-row"
                style={{display:"grid",gridTemplateColumns:cols,padding:"9px 14px",gap:7,borderBottom:"1px solid rgba(255,255,255,0.05)",alignItems:"center",
                  cursor:"pointer",background:selected===o.id?"rgba(255,255,255,0.08)":o.cred==="Denied"?"rgba(42,0,0,0.4)":o.isBuffer?"rgba(20,20,40,0.5)":undefined,transition:"background 0.1s"}}>
                <span style={{fontSize:10,color:"#64748b",fontFamily:"monospace"}}>{o.opId ?? o.id}</span>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:"var(--hud-text)"}}>{o.name || '—'}</div>
                  <div style={{fontSize:9,color:"#475569"}}>{o.workedWithMemeHouse?"✓ Alumni":o.source||''}{isBroadcastQualified(o)?" · 📡":""}</div>
                </div>
                <span style={{fontSize:9,color:(STAGE_COLORS[o.stage]||"#64748b"),fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.stage}</span>
                <span style={{fontSize:9,color:"#94a3b8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.zone}</span>
                <span style={{fontSize:10,color:"#22c55e",fontWeight:700}}>${o.rate ?? 0}</span>
                <span style={{fontSize:9,color:(CRED_COLORS[o.cred]||"#64748b"),fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.cred}</span>
                <span style={{fontSize:9,color:o.loa?"#22c55e":"#475569"}}>{o.loa?"✓":""}</span>
                <Tag label={o.risk} color={(RISK_COLORS[o.risk]||"#64748b")} small/>
                <div style={{display:"flex",alignItems:"center"}}>
                  {o.stage !== "Confirmed" && (
                    <button type="button" onClick={e=>{ e.stopPropagation(); handleQuickConfirm(o); }} className="hud-btn" style={{padding:"4px 8px",fontSize:9,fontWeight:700,background:"rgba(34,197,94,0.15)",border:"1px solid rgba(34,197,94,0.5)",color:"#22c55e",borderRadius:6,cursor:"pointer",whiteSpace:"nowrap"}} title="Mark confirmed">Confirm</button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="glass-panel-table-header" style={{padding:"7px 14px",borderTop:"1px solid var(--hud-border)",fontSize:10,color:"#475569"}}>
            {filtered.length} of {list.length} operators
          </div>
        </div>
      </div>

      {op && (
        <div className="glass-panel" style={{width:268,padding:"16px 14px",flexShrink:0,display:"flex",flexDirection:"column",gap:12,maxHeight:"82vh",overflowY:"auto"}}>
          <div>
            <div style={{fontSize:9,color:"#475569",fontFamily:"monospace",marginBottom:3}}>{op.id}</div>
            <div style={{fontSize:14,fontWeight:900,color:"var(--hud-text)",marginBottom:6}}>{op.name}</div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              <Tag label={(TIERS[op.tier]||TIERS.T2).label} color={(TIERS[op.tier]||TIERS.T2).color}/>
              {op.workedWithMemeHouse && <Tag label="MH Alumni" color="#22c55e"/>}
              {op.isBuffer && <Tag label="BUFFER" color="#a855f7"/>}
            </div>
          </div>

          <div style={{borderTop:"1px solid #1e293b",paddingTop:10}}>
            <div style={{fontSize:9,color:"#475569",fontWeight:800,letterSpacing:"0.08em",marginBottom:6}}>RELIABILITY · AUTO-RISK</div>
            <Stars value={op.reliability} onChange={v=>{const u={...op,reliability:v};onUpdate(op.id,{reliability:v,risk:computeAutoRisk(u)});}} />
            <div style={{marginTop:7,display:"flex",gap:5,alignItems:"center"}}>
              <Tag label={`RISK: ${op.risk}`} color={RISK_COLORS[op.risk]}/>
            </div>
            <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:5}}>
              {[["lateToScreen","Late to Screening"],["rateInstability","Rate Instability"],["workedWithMemeHouse","Worked w/ MemeHouse"]].map(([k,l])=>(
                <label key={k} style={{display:"flex",gap:6,alignItems:"center",cursor:"pointer"}}>
                  <input type="checkbox" checked={op[k]||false}
                    onChange={e=>{const u={...op,[k]:e.target.checked};onUpdate(op.id,{[k]:e.target.checked,risk:computeAutoRisk(u)});}}
                    style={{accentColor:"#6366f1",width:12,height:12}}/>
                  <span style={{fontSize:10,color:op[k]?(k==="workedWithMemeHouse"?"#22c55e":"#f59e0b"):"#64748b",fontWeight:600}}>{l}</span>
                </label>
              ))}
            </div>
          </div>

          <div style={{borderTop:"1px solid #1e293b",paddingTop:10}}>
            <div style={{fontSize:9,color:"#475569",fontWeight:800,letterSpacing:"0.08em",marginBottom:6}}>GEAR FAMILIARITY</div>
            <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
              {GEAR_TAGS.map(g=>(
                <GearChip key={g} label={g} active={(Array.isArray(op.gear) ? op.gear : []).includes(g)}
                  onClick={()=>{
                    const arr = Array.isArray(op.gear) ? op.gear : []; const gear=arr.includes(g)?arr.filter(x=>x!==g):[...arr,g];
                    onUpdate(op.id,{gear});
                  }}/>
              ))}
            </div>
            {isBroadcastQualified(op) && <div style={{marginTop:5,fontSize:9,color:"#22d3ee",fontWeight:700}}>📡 LIVE BROADCAST QUALIFIED</div>}
          </div>

          <div style={{borderTop:"1px solid #1e293b",paddingTop:10,display:"flex",flexDirection:"column",gap:8}}>
            {[
              {label:"CREDENTIAL STATUS", field:"cred", opts:CRED_STATES, colors:CRED_COLORS},
              {label:"CREDENTIAL TYPE",   field:"credType", opts:CRED_TYPES, colors:CRED_TYPE_COLORS},
            ].map(({label,field,opts,colors})=>(
              <div key={field}>
                <div style={{fontSize:9,color:"#475569",fontWeight:800,letterSpacing:"0.08em",marginBottom:5}}>{label}</div>
                <select value={op[field]} onChange={e=>onUpdate(op.id,{[field]:e.target.value})}
                  style={{width:"100%",background:"#1e293b",border:`1px solid ${colors[op[field]]||"#334155"}44`,borderRadius:5,padding:"6px 8px",color:colors[op[field]]||"#94a3b8",fontSize:10,fontWeight:700,outline:"none"}}>
                  {opts.map(s=><option key={s} value={s} style={{background:"#1e293b"}}>{s}</option>)}
                </select>
              </div>
            ))}

            <div>
              <div style={{fontSize:9,color:"#475569",fontWeight:800,letterSpacing:"0.08em",marginBottom:5}}>ZONE</div>
              <select value={op.zone} onChange={e=>{
                const chk=canAssignToZone(op,e.target.value);
                if(!chk.ok){alert(`⚠ Deployment blocked: ${chk.reason}`);return;}
                onUpdate(op.id,{zone:e.target.value});
              }} style={{width:"100%",background:"#1e293b",border:"1px solid #334155",borderRadius:5,padding:"6px 8px",color:"#94a3b8",fontSize:10,fontWeight:700,outline:"none"}}>
                {(zones.length ? zones : []).map(z=><option key={z} value={z} style={{background:"#1e293b"}}>{z}</option>)}
              </select>
              {!canAssignToZone(op,op.zone).ok && <div style={{fontSize:9,color:"#ef4444",fontWeight:700,marginTop:3}}>⚠ {canAssignToZone(op,op.zone).reason}</div>}
            </div>

            <div>
              <div style={{fontSize:9,color:"#475569",fontWeight:800,letterSpacing:"0.08em",marginBottom:5}}>HIRE STAGE</div>
              <select value={op.stage} onChange={e=>onUpdate(op.id,{stage:e.target.value})}
                style={{width:"100%",background:"#1e293b",border:`1px solid ${(STAGE_COLORS[op.stage]||"#64748b")}44`,borderRadius:5,padding:"6px 8px",color:STAGE_COLORS[op.stage]||"#94a3b8",fontSize:10,fontWeight:700,outline:"none"}}>
                {HIRE_STAGES.map(s=><option key={s} value={s} style={{background:"#1e293b"}}>{s}</option>)}
              </select>
              {op.stage !== "Confirmed" && (
                <button type="button" onClick={() => handleQuickConfirm(op)} className="hud-btn" style={{width:"100%",marginTop:8,padding:"8px 12px",fontSize:10,fontWeight:700,background:"rgba(34,197,94,0.15)",border:"1px solid rgba(34,197,94,0.5)",color:"#22c55e",borderRadius:8,cursor:"pointer"}}>Confirm now</button>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, color: "#94a3b8" }}>Planned Days</label>
              <input
                type="number"
                min={0}
                value={op.planned_days ?? op.plannedDays ?? 0}
                onChange={(e) => {
                  const v = parseInt(e.target.value || "0", 10);
                  onUpdate(op.id, { planned_days: Number.isFinite(v) ? Math.max(0, v) : 0 });
                }}
                style={{
                  width: "100%",
                  background: "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  padding: "8px 10px",
                  color: "var(--hud-text)",
                }}
              />
              <div style={{ fontSize: 11, color: "#64748b" }}>
                Used for committed cost calc
              </div>
            </div>
          </div>

          <div style={{borderTop:"1px solid #1e293b",paddingTop:10}}>
            <div style={{fontSize:9,color:"#475569",fontWeight:800,letterSpacing:"0.08em",marginBottom:6}}>CHECKLIST</div>
            {[["reel","Portfolio Reviewed"],["refs","References Verified"],["loa","LOA Signed"],["w9","W9 Collected"]].map(([k,l])=>(
              <label key={k} style={{display:"flex",gap:6,alignItems:"center",cursor:"pointer",marginBottom:5}}>
                <input type="checkbox" checked={op[k]||false} onChange={e=>onUpdate(op.id,{[k]:e.target.checked})} style={{accentColor:"#6366f1",width:12,height:12}}/>
                <span style={{fontSize:10,color:op[k]?"#22c55e":"#64748b",fontWeight:600}}>{l}</span>
              </label>
            ))}
          </div>

          {(op.perfScore!==null||op.stage==="Passed") && (
            <div style={{borderTop:"1px solid #1e293b",paddingTop:10}}>
              <div style={{fontSize:9,color:"#475569",fontWeight:800,letterSpacing:"0.08em",marginBottom:6}}>POST-EVENT</div>
              <Stars value={op.perfScore||0} onChange={v=>onUpdate(op.id,{perfScore:v})}/>
              <div style={{marginTop:7,display:"flex",gap:4}}>
                <button onClick={()=>onUpdate(op.id,{rehireEligible:true})} style={{flex:1,padding:"4px",borderRadius:4,border:"none",cursor:"pointer",fontSize:9,fontWeight:700,background:op.rehireEligible===true?"#22c55e":"#1e293b",color:op.rehireEligible===true?"#fff":"#64748b"}}>✓ Rehire</button>
                <button onClick={()=>onUpdate(op.id,{rehireEligible:false})} style={{flex:1,padding:"4px",borderRadius:4,border:"none",cursor:"pointer",fontSize:9,fontWeight:700,background:op.rehireEligible===false?"#ef4444":"#1e293b",color:op.rehireEligible===false?"#fff":"#64748b"}}>✗ No Rehire</button>
              </div>
            </div>
          )}

          <div style={{borderTop:"1px solid #1e293b",paddingTop:10}}>
            <div style={{fontSize:9,color:"#475569",fontWeight:800,letterSpacing:"0.08em",marginBottom:6}}>ARCHIVE</div>
            <button
              onClick={() => { onUpdate(op.id, { isArchived: true }); setSelected(null); }}
              style={{width:"100%",padding:"8px 12px",borderRadius:6,border:"1px solid #64748b",cursor:"pointer",fontSize:10,fontWeight:700,background:"#1e293b",color:"#94a3b8"}}
            >
              Archive Operator
            </button>
            <div style={{fontSize:9,color:"#475569",marginTop:4}}>Removes from Kanban; keeps record.</div>
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

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{background:"#0a1628",border:"1px solid #1e3a5f",borderRadius:8,padding:"12px 16px"}}>
        <div style={{fontSize:10,fontWeight:800,color:"#0ea5e9",letterSpacing:"0.08em",marginBottom:4}}>SCHEMA v2 — RELATIONAL MAP</div>
        <div style={{fontSize:10,color:"#64748b"}}>CREW_OPERATORS ←→ CREDENTIALS (1:1) · CREW_OPERATORS → DEPLOYMENT_ZONES (many:1, protected) · On review: CREW_OPERATORS → FESTIVAL_ROSTER_DB (persistent, reusable)</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {tables.map(table=>(
          <div key={table.name} style={{background:"#0f172a",border:`1px solid ${table.color}33`,borderTop:`3px solid ${table.color}`,borderRadius:8,overflow:"hidden"}}>
            <div style={{padding:"10px 14px",background:`${table.color}11`,borderBottom:`1px solid ${table.color}22`}}>
              <span style={{fontSize:10,fontWeight:900,color:table.color,letterSpacing:"0.08em"}}>{table.name}</span>
            </div>
            <div>
              {table.fields.map(f=>(
                <div key={f.n} style={{display:"grid",gridTemplateColumns:"150px 65px 1fr",gap:6,padding:"5px 14px",borderBottom:"1px solid #0a0f1a",alignItems:"center"}}>
                  <span style={{fontSize:10,fontWeight:700,color:f.t==="PK"?"#f59e0b":f.t==="FK"?"#a855f7":f.t==="computed"?"#22d3ee":"#94a3b8",fontFamily:"monospace"}}>{f.n}</span>
                  <span style={{fontSize:9,padding:"1px 5px",borderRadius:99,background:"#1e293b",color:"#64748b",fontWeight:700,textAlign:"center"}}>{f.t}</span>
                  <span style={{fontSize:10,color:"#475569"}}>{f.d}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── PROJECT DASHBOARD (project-scoped; view from URL) ─────────────────────────

function ProjectDashboard() {
  const { projectId, view: viewParam } = useParams();
  const navigate = useNavigate();
  const { project, touchProject, updateProjectStatus } = useProject();
  const view = viewParam || "executive";
  const zones = project?.zones ?? [];

  const [ops, setOps]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const [saving, setSaving] = useState(false);
  const [statsInvalidateKey, setStatsInvalidateKey] = useState(0);
  const [stats, setStats] = useState(null);
  const [event, setEvent] = useState(null);
  const [statsError, setStatsError] = useState(null);
  const [showAddOpModal, setShowAddOpModal] = useState(false);
  const [operatorFilter, setOperatorFilter] = useState('active'); // 'active' | 'archived' | 'all'
  const [navOpen, setNavOpen] = useState(false);
  const [countdownTick, setCountdownTick] = useState(() => Date.now());
  const [endProjectModalOpen, setEndProjectModalOpen] = useState(false);
  const isMobile = useIsMobile();
  const invalidateStats = useCallback(() => setStatsInvalidateKey(k => k + 1), []);

  if (!project) return <Navigate to="/projects" replace />;

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

  useEffect(() => {
    if ((view === 'ops' || view === 'emergency') && projectId) navigate(`/p/${projectId}/executive`, { replace: true });
  }, [view, projectId, navigate]);

  const committedStages = project ? getCommittedStages(project) : ["Confirmed"];
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
    const poKeyMap = { rate:'project_day_rate', stage:'hire_stage', cred:'cred_status', credType:'cred_type', plannedDays:'planned_days', zone:'zone', tier:'tier' };
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


  if (loading) return (
    <div style={{minHeight:'100vh',background:'var(--hud-bg,#f6f5f2)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"system-ui,sans-serif"}}>
      <div style={{textAlign:'center',color:'var(--hud-text,#0b1220)'}}>
        <div style={{fontSize:14,letterSpacing:'0.1em',marginBottom:8,fontWeight:700}}>LOADING...</div>
        <div style={{width:40,height:4,background:"rgba(0,0,0,0.08)",borderRadius:2,margin:"0 auto",overflow:"hidden"}}>
          <div style={{width:"30%",height:"100%",background:"#6366f1",borderRadius:2,animation:"pulse 1.5s ease-in-out infinite"}}/>
        </div>
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}`}</style>
    </div>
  );

  const PRIMARY_VIEWS = [
    {id:"executive", label:"Executive"},
    {id:"kanban",    label:"Kanban"},
    {id:"operators", label:"Operators"},
    {id:"creds",     label:"Credentials"},
    {id:"shifts",    label:"Shifts"},
  ];
  const MORE_VIEWS = [
    {id:"deploy",    label:"Deployment"},
    {id:"dashboard", label:"Dashboard"},
    {id:"postevent", label:"Post-Event"},
    {id:"schema",    label:"DB Schema"},
  ];

  const highRiskCount   = ops.filter(o=>o.risk==="HIGH").length;

  return (
    <AppShell>
      {error && (
        <div style={{background:"#7f1d1d",borderBottom:"1px solid #ef4444",padding:"8px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
          <span style={{fontSize:10,color:"#fca5a5"}}>⚠ {error}</span>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>{setError(null);setLoading(true);loadOps();}} style={{padding:"4px 12px",background:"#ef4444",border:"none",borderRadius:4,color:"#fff",fontSize:9,cursor:"pointer",fontWeight:700}}>Retry</button>
            <button onClick={()=>setError(null)} style={{padding:"4px 12px",background:"transparent",border:"1px solid #fca5a5",borderRadius:4,color:"#fca5a5",fontSize:9,cursor:"pointer"}}>Dismiss</button>
          </div>
        </div>
      )}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Inter:wght@400;600;700;800&display=swap');
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:var(--hud-bg)}
        ::-webkit-scrollbar-thumb{background:var(--hud-border-strong);border-radius:3px}
        select option{background:var(--hud-input-bg);color:var(--hud-text)}
        .modal-panel{ max-width: 420px; width: 100%; max-height: 90vh; overflow-y: auto; }
        @media (max-width:480px){ .modal-panel{ max-width: none; margin: 12px; max-height: calc(100vh - 24px); } }
        .app-content-inner--fill{ display: flex !important; flex-direction: column !important; overflow: hidden !important; }
      `}</style>

      <header style={{ flexShrink: 0, background: "var(--hud-panel)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderBottom: "1px solid var(--hud-border)", zIndex: 100 }}>
        <div style={{ padding: isMobile ? "0 12px" : "0 24px", display: "flex", alignItems: "center", height: NAV_HEIGHT }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginRight: 16, flexShrink: 0 }}>
            <a href="/projects" onClick={(e)=>{ e.preventDefault(); navigate("/projects"); }} style={{ display: "flex", alignItems: "center", textDecoration: "none", color: "inherit" }} aria-label="MemeHouse Ops — Projects">
              <img src="/brand/memehouse-networks.png" alt="MemeHouse Networks" style={{ maxHeight: 26, width: "auto", objectFit: "contain", display: "block" }} onError={(e)=>{ const el = e.target; el.style.display = "none"; const fb = el.nextElementSibling; if (fb) fb.style.display = "flex"; }} />
              <span style={{ width: 26, height: 26, borderRadius: 6, background: `linear-gradient(135deg,${project.theme?.accentColor ?? "#e94560"},#6366f1)`, display: "none", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, color: "#fff" }}>{project.theme?.logoLetter ?? "M"}</span>
            </a>
            <div>
              <div style={{ fontSize: 11, fontWeight: 900, color: "var(--hud-text)", letterSpacing: "0.05em" }}>MEMEHOUSE OPS</div>
              <div style={{ fontSize: 8, color: "#475569", letterSpacing: "0.1em" }}>{project.name.toUpperCase()} — {sprintLabel}</div>
            </div>
          </div>

          {!isMobile && (
            <div style={{ display: "flex", gap: 0, flex: 1, alignItems: "center" }}>
              {PRIMARY_VIEWS.map(v=>(
                <button key={v.id} onClick={()=>navigate(`/p/${projectId}/${v.id}`)} style={{
                  padding: "0 13px", height: 52, border: "none", cursor: "pointer", fontSize: 9, fontWeight: 800, letterSpacing: "0.06em",
                  background: "transparent", color: view===v.id ? "var(--hud-text)" : "#475569",
                  borderBottom: view===v.id ? "2px solid #e94560" : "2px solid transparent",
                  whiteSpace: "nowrap", position: "relative", flexShrink: 0
                }}>
                  {v.label.toUpperCase()}
                  {v.id==="creds"&&highRiskCount>0 && <span style={{ position: "absolute", top: 8, right: 2, width: 14, height: 14, borderRadius: 99, background: "#ef4444", fontSize: 8, fontWeight: 900, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>{highRiskCount}</span>}
                </button>
              ))}
              <div style={{ marginLeft: 8 }}>
                <select value={MORE_VIEWS.some(v=>v.id===view)?view:"__more__"} onChange={e=>{ const v=e.target.value; if(v!=="__more__" && projectId) navigate(`/p/${projectId}/${v}`); }} style={{
                  padding: "6px 28px 6px 10px", height: 32, background: "#1e293b", border: "1px solid #334155", borderRadius: 4,
                  color: "#64748b", fontSize: 9, fontWeight: 700, outline: "none", cursor: "pointer", appearance: "none"
                }}>
                  <option value="__more__">More ▼</option>
                  {MORE_VIEWS.map(v=><option key={v.id} value={v.id}>{v.label}</option>)}
                </select>
              </div>
            </div>
          )}

          {isMobile && (
            <button type="button" onClick={()=>setNavOpen(o=>!o)} style={{ marginLeft: "auto", padding: 8, background: "transparent", border: "none", cursor: "pointer", color: "#94a3b8" }} aria-label="Menu">
              <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 6h18M3 12h18M3 18h18"/></svg>
            </button>
          )}

          {!isMobile && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
              {isCustomProject(projectId) && (project?.status === "active") && (
                <button type="button" onClick={() => setEndProjectModalOpen(true)} className="hud-btn" style={{ padding: "4px 10px", fontSize: 9, borderColor: "rgba(245,158,11,0.5)", color: "#b45309", background: "rgba(245,158,11,0.1)" }}>End Project</button>
              )}
              <button type="button" onClick={()=>navigate("/projects")} className="hud-btn" style={{ padding: "4px 10px", fontSize: 9 }}>Switch Project</button>
            </div>
          )}
        </div>

        {navOpen && isMobile && (
          <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.5)" }} onClick={()=>setNavOpen(false)}>
            <div style={{ background: "#0f172a", borderBottom: "1px solid #1e293b", padding: "12px 16px", maxHeight: "70vh", overflowY: "auto" }} onClick={e=>e.stopPropagation()}>
              <div style={{ fontSize: 9, fontWeight: 800, color: "#475569", letterSpacing: "0.1em", marginBottom: 8 }}>NAVIGATION</div>
              {PRIMARY_VIEWS.map(v=>(
                <button key={v.id} onClick={()=>{ navigate(`/p/${projectId}/${v.id}`); setNavOpen(false); }} style={{
                  display: "block", width: "100%", padding: "10px 12px", marginBottom: 4, textAlign: "left", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700,
                  background: view===v.id ? "#1e293b" : "transparent", color: view===v.id ? "#e94560" : "#e2e8f0"
                }}>
                  {v.label} {v.id==="creds"&&highRiskCount>0 && `(${highRiskCount})`}
                </button>
              ))}
              <div style={{ borderTop: "1px solid #1e293b", marginTop: 8, paddingTop: 8 }}>
                {MORE_VIEWS.map(v=>(
                  <button key={v.id} onClick={()=>{ navigate(`/p/${projectId}/${v.id}`); setNavOpen(false); }} style={{
                    display: "block", width: "100%", padding: "8px 12px", marginBottom: 4, textAlign: "left", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 10, color: "#94a3b8",
                    background: view===v.id ? "#1e293b" : "transparent"
                  }}>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </header>

      <div style={{ flexShrink: 0, background: "rgba(255,255,255,0.5)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderBottom: "1px solid var(--hud-border)", padding: isMobile ? "8px 14px" : "8px 24px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 9, color: "#64748b" }}>Full access — all fields editable</span>
        {project?.status && <ProjectStatusBadge status={project.status} />}
        <span style={{ marginLeft: "auto", fontSize: 9, color: "#475569" }}>
          {ops.filter(o=>o.stage==="Confirmed").length} confirmed · {ops.filter(o=>o.cred==="Approved").length} credentialed · <span style={{ color: "#ef4444", fontWeight: 700 }}>{highRiskCount} high-risk</span>
        </span>
      </div>

      <main style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div
          style={{ flex: 1, minHeight: 0, overflow: view === "kanban" ? "hidden" : "auto" }}
          className={
            "app-content-inner" +
            (view === "kanban" ? " app-content-inner--fill" : "") +
            (view === "executive" || view === "operators" || view === "creds" || view === "shifts" ? " app-content-inner--full-width" : "")
          }
        >
          {view === "kanban" ? (
            <div className="kanban-page-wrap">
              <Kanban ops={ops.filter(o => o.active !== false && o.stage !== "Passed")} onUpdate={updateOp} stages={getKanbanColumns(project)}/>
            </div>
          ) : view === "executive" ? (
            <PageShell>
              <ExecutiveView stats={stats} event={event} statsError={statsError} onRetry={() => { setStatsError(null); setStatsInvalidateKey(k => k + 1); }} isMobile={isMobile} ops={ops} committedStages={committedStages} budgetCapFromProject={project?.budget?.laborCap} eventStartISO={project?.eventStartISO}/>
            </PageShell>
          ) : view === "operators" || view === "creds" || view === "shifts" ? (
            <PageShell>
              {view==="operators"  && <ErrorBoundary><OperatorsView zones={zones} ops={ops||[]} operatorFilter={operatorFilter} onOperatorFilterChange={setOperatorFilter} onUpdate={updateOp} onAddOperator={()=>setShowAddOpModal(true)} onUpdateDefaultRate={(opId, rate)=>api.updateOperator(opId, { day_rate: rate })} isMobile={isMobile}/></ErrorBoundary>}
              {view==="creds"      && <ErrorBoundary><CredsTracker zones={zones} ops={ops||[]} onUpdate={updateOp} onAddOperator={()=>setShowAddOpModal(true)} onUpdateDefaultRate={(opId, rate)=>api.updateOperator(opId, { day_rate: rate })} isMobile={isMobile}/></ErrorBoundary>}
              {view==="shifts"     && <ErrorBoundary><ShiftsView zones={zones} ops={ops||[]} projectId={projectId} onShiftMutated={onShiftMutated} isMobile={isMobile}/></ErrorBoundary>}
            </PageShell>
          ) : (
            <div className="hud-container">
              {view==="dashboard"  && <Dashboard zones={zones} ops={ops} isMobile={isMobile}/>}
              {view==="deploy"     && <ErrorBoundary><DeployMatrix zones={zones} ops={ops||[]}/></ErrorBoundary>}
              {view==="postevent"  && <PostEventReview ops={ops} onUpdate={updateOp}/>}
              {view==="schema"     && <SchemaView/>}
            </div>
          )}
        </div>
      </main>
      {showAddOpModal && <AddOperatorModal zones={zones} onSave={handleAddOperator} onClose={()=>setShowAddOpModal(false)} projectId={projectId} />}

      {endProjectModalOpen && (
        <div className="hud-modal-overlay" onClick={() => setEndProjectModalOpen(false)}>
          <div className="hud-modal-panel" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="hud-page-label" style={{ marginBottom: 4 }}>// END PROJECT</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--hud-text)", marginBottom: 8 }}>End this project?</div>
            <p style={{ fontSize: 12, color: "var(--hud-muted)", margin: "0 0 20px", lineHeight: 1.5 }}>
              This will mark the project as completed and move it to the archive section. You can still view historical data.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="hud-btn" onClick={() => setEndProjectModalOpen(false)}>Cancel</button>
              <button type="button" className="hud-btn" style={{ borderColor: "rgba(245,158,11,0.5)", color: "#b45309", background: "rgba(245,158,11,0.15)" }} onClick={() => { updateProjectStatus(projectId, "completed"); setEndProjectModalOpen(false); navigate("/projects"); }}>End Project</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
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
