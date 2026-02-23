import { useState, useEffect, useCallback } from "react";

// ─── API LAYER ────────────────────────────────────────────────────────────────
const API = process.env.REACT_APP_API_URL || '';

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  return res.json();
}

const api = {
  getOperators:  ()      => apiFetch('/api/operators'),
  addOperator:   (data)  => apiFetch('/api/operators', { method: 'POST', body: data }),
  updateOperator:(id, d) => apiFetch(`/api/operators/${id}`, { method: 'PATCH', body: d }),
  deleteOperator:(id)    => apiFetch(`/api/operators/${id}`, { method: 'DELETE' }),
  getShifts:     ()      => apiFetch('/api/shifts'),
  addShift:      (data)  => apiFetch('/api/shifts', { method: 'POST', body: data }),
  getStats:      ()      => apiFetch('/api/stats'),
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
const HIRE_STAGES = ["Outreach","Responded","Screened","Interviewing","Offered","LOA Signed","Confirmed","Passed"];
const CRED_STATES  = ["Not Started","Info Collected","Submitted","Approved","Denied","Backup Assigned"];
const CRED_TYPES   = ["None","House-Only","Guest","Vendor","Artist","Festival Grounds"];
const ROLES = ["Production Lead","Credential Manager","Hiring Coordinator"];
const GEAR_TAGS = ["TVU","LiveU","IRL Backpack","Sony FX6/FX3","PTZ","Comms/Party Line","Multi-cam Switching"];

const CRED_COLORS = {
  "Not Started":"#475569","Info Collected":"#0ea5e9","Submitted":"#f59e0b",
  "Approved":"#22c55e","Denied":"#ef4444","Backup Assigned":"#a855f7"
};
const STAGE_COLORS = {
  "Outreach":"#334155","Responded":"#0ea5e9","Screened":"#6366f1",
  "Interviewing":"#f59e0b","Offered":"#fb923c","LOA Signed":"#22d3ee",
  "Confirmed":"#22c55e","Passed":"#ef4444"
};
const RISK_COLORS = { HIGH:"#ef4444", MED:"#f59e0b", LOW:"#22c55e" };
const CRED_TYPE_COLORS = {
  "None":"#475569","House-Only":"#6366f1","Guest":"#0ea5e9",
  "Vendor":"#f59e0b","Artist":"#f43f5e","Festival Grounds":"#22c55e"
};

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
  return broadcastGear.some(g => op.gear.includes(g));
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

const Tag = ({label, color, small}) => (
  <span style={{
    display:"inline-block", padding: small?"1px 7px":"3px 10px",
    borderRadius:99, fontSize:small?10:11, fontWeight:700,
    color, background:color+"22", border:`1px solid ${color}44`,
    letterSpacing:"0.04em", whiteSpace:"nowrap"
  }}>{label}</span>
);

const StatCard = ({label, value, sub, accent}) => (
  <div style={{background:"#0f172a", border:`1px solid ${accent}33`, borderTop:`3px solid ${accent}`, borderRadius:8, padding:"16px 20px", flex:1, minWidth:130}}>
    <div style={{fontSize:28, fontWeight:900, color:accent, fontFamily:"'Space Mono',monospace"}}>{value}</div>
    <div style={{fontSize:11, color:"#94a3b8", marginTop:2, fontWeight:600}}>{label}</div>
    {sub && <div style={{fontSize:10, color:"#64748b", marginTop:3}}>{sub}</div>}
  </div>
);

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
    background: active ? "#6366f122":"#1e293b",
    color: active ? "#818cf8":"#475569",
    border: `1px solid ${active?"#6366f144":"#334155"}`,
    transition:"all 0.15s", whiteSpace:"nowrap"
  }}>{label}</span>
);

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

function Dashboard({ ops }) {
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
  const pct = v => Math.round(v/total*100);

  const stageData       = HIRE_STAGES.map(s=>({stage:s, count:ops.filter(o=>o.stage===s).length}));
  const zoneData        = ZONES.map(z=>({zone:z, confirmed:ops.filter(o=>o.zone===z&&o.stage==="Confirmed").length, total:ops.filter(o=>o.zone===z).length}));
  const tierData        = Object.entries(TIERS).map(([k,v])=>({key:k,...v, count:ops.filter(o=>o.tier===k).length}));
  const reliabilityDist = [5,4,3,2,1].map(r=>({ r, count:ops.filter(o=>o.reliability===r).length }));

  return (
    <div style={{display:"flex", flexDirection:"column", gap:20}}>
      <div style={{display:"flex", gap:10, flexWrap:"wrap"}}>
        <StatCard label="Total Pipeline"   value={total}        sub={`50 primary + ${buffer} buffer`} accent="#6366f1"/>
        <StatCard label="Confirmed"        value={confirmed}    sub={`${pct(confirmed)}% of pipeline`} accent="#22c55e"/>
        <StatCard label="Credentialed"     value={credApproved} sub="Festival access approved"         accent="#0ea5e9"/>
        <StatCard label="LOAs Signed"      value={loaSigned}    sub="Agreements locked"                accent="#f59e0b"/>
        <StatCard label="Cred Denied"      value={denied}       sub="Needs backup swap"                accent="#ef4444"/>
        <StatCard label="Broadcast Ready"  value={broadcastQ}   sub="TVU / LiveU / FX6 / Multi-cam"   accent="#22d3ee"/>
      </div>

      {/* Risk summary */}
      <div style={{background:"#0f172a", border:"1px solid #1e293b", borderRadius:8, padding:"14px 20px", display:"flex", gap:24, alignItems:"center", flexWrap:"wrap"}}>
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
        <div style={{background:"#0f172a", border:"1px solid #1e293b", borderRadius:8, padding:"16px 20px"}}>
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
        <div style={{background:"#0f172a", border:"1px solid #1e293b", borderRadius:8, padding:"16px 20px"}}>
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
        <div style={{background:"#0f172a", border:"1px solid #1e293b", borderRadius:8, padding:"16px 20px"}}>
          <div style={{fontSize:11,fontWeight:800,color:"#64748b",letterSpacing:"0.1em",marginBottom:14}}>RATE TIER DISTRIBUTION</div>
          {tierData.map(({key,label,color,count})=>(
            <div key={key} style={{display:"flex",alignItems:"center",gap:8,marginBottom:9}}>
              <div style={{width:8,height:8,borderRadius:99,background:color,flexShrink:0}}/>
              <span style={{fontSize:10,color:"#94a3b8",flex:1,fontWeight:600}}>{label}</span>
              <span style={{fontSize:11,color,fontWeight:800}}>{count}</span>
            </div>
          ))}
        </div>
        <div style={{background:"#0f172a", border:"1px solid #1e293b", borderRadius:8, padding:"16px 20px"}}>
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
        <div style={{background:"#0f172a", border:"1px solid #1e293b", borderRadius:8, padding:"16px 20px"}}>
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

function Kanban({ ops, onUpdate }) {
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);
  const drop = (stage) => { if(drag){onUpdate(drag,{stage});setDrag(null);setOver(null);} };

  return (
    <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:12,minHeight:500}}>
      {HIRE_STAGES.map(stage=>{
        const stageOps=ops.filter(o=>o.stage===stage);
        const isOver=over===stage;
        return (
          <div key={stage}
            onDragOver={e=>{e.preventDefault();setOver(stage);}}
            onDrop={()=>drop(stage)} onDragLeave={()=>setOver(null)}
            style={{minWidth:175,background:isOver?"#1e293b":"#0f172a",border:`1px solid ${isOver?STAGE_COLORS[stage]:"#1e293b"}`,borderTop:`3px solid ${STAGE_COLORS[stage]}`,borderRadius:8,padding:"12px 10px",display:"flex",flexDirection:"column",gap:8}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <span style={{fontSize:10,fontWeight:800,color:STAGE_COLORS[stage],letterSpacing:"0.08em"}}>{stage.toUpperCase()}</span>
              <span style={{fontSize:11,fontWeight:800,color:"#64748b",background:"#1e293b",borderRadius:99,padding:"1px 8px"}}>{stageOps.length}</span>
            </div>
            {stageOps.map(op=>(
              <div key={op.id} draggable onDragStart={()=>setDrag(op.id)}
                style={{background:"#1e293b",borderRadius:6,padding:"10px 10px",cursor:"grab",border:"1px solid #334155",borderLeft:`3px solid ${TIERS[op.tier].color}`}}>
                <div style={{fontSize:11,fontWeight:700,color:"#e2e8f0",marginBottom:3}}>{op.name}</div>
                <div style={{fontSize:9,color:"#64748b",marginBottom:6}}>{op.id} · {op.source}</div>
                <div style={{display:"flex",gap:3,flexWrap:"wrap",marginBottom:5}}>
                  <Tag label={op.tier} color={TIERS[op.tier].color} small/>
                  <Tag label={op.zone} color="#6366f1" small/>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <Stars value={op.reliability}/>
                  <Tag label={op.risk} color={RISK_COLORS[op.risk]} small/>
                </div>
                <div style={{marginTop:4,display:"flex",gap:4,flexWrap:"wrap"}}>
                  {op.workedWithMemeHouse && <span style={{fontSize:9,color:"#22c55e",fontWeight:700}}>✓ Alumni</span>}
                  {isBroadcastQualified(op) && <span style={{fontSize:9,color:"#22d3ee",fontWeight:700}}>📡</span>}
                  {op.isBuffer && <span style={{fontSize:9,color:"#a855f7",fontWeight:700}}>⬡ BUF</span>}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ─── CREDENTIALS TRACKER ──────────────────────────────────────────────────────

function CredsTracker({ ops, onUpdate }) {
  const [filter, setFilter] = useState("All");
  const filtered = filter==="All" ? ops : ops.filter(o=>o.cred===filter);
  const riskyOps = ops.filter(o=>o.risk==="HIGH");

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {riskyOps.length>0 && (
        <div style={{background:"#1a0000",border:"1px solid #ef4444",borderRadius:8,padding:"12px 16px"}}>
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
        </div>
      )}

      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
        {["All",...CRED_STATES].map(s=>(
          <button key={s} onClick={()=>setFilter(s)} style={{padding:"4px 12px",borderRadius:99,border:"none",cursor:"pointer",fontSize:10,fontWeight:700,background:filter===s?(CRED_COLORS[s]||"#6366f1"):"#1e293b",color:filter===s?"#fff":"#64748b"}}>{s} ({s==="All"?ops.length:ops.filter(o=>o.cred===s).length})</button>
        ))}
      </div>

      <div style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:8,overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:"80px 1fr 65px 95px 110px 125px 75px 60px",background:"#0a0f1a",borderBottom:"1px solid #1e293b",padding:"9px 14px",gap:8}}>
          {["ID","Name","Tier","Zone","Cred Status","Cred Type","Rate","Risk"].map(h=>(
            <span key={h} style={{fontSize:9,fontWeight:800,color:"#475569",letterSpacing:"0.07em"}}>{h}</span>
          ))}
        </div>
        <div style={{maxHeight:440,overflowY:"auto"}}>
          {filtered.map(op=>(
            <div key={op.id} style={{display:"grid",gridTemplateColumns:"80px 1fr 65px 95px 110px 125px 75px 60px",padding:"9px 14px",gap:8,borderBottom:"1px solid #0f172a",alignItems:"center",
              background:op.cred==="Denied"?"#1a0000":op.risk==="HIGH"?"#1a0a00":"transparent"}}>
              <span style={{fontSize:10,color:"#64748b",fontFamily:"monospace"}}>{op.id}</span>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:"#e2e8f0"}}>{op.name}</div>
                <div style={{fontSize:9,color:"#475569"}}>{op.workedWithMemeHouse?"✓ MH Alumni":op.source}</div>
              </div>
              <Tag label={op.tier} color={TIERS[op.tier].color} small/>
              <span style={{fontSize:10,color:"#94a3b8",fontWeight:600}}>{op.zone}</span>
              <select value={op.cred} onChange={e=>onUpdate(op.id,{cred:e.target.value})} style={{background:"transparent",border:"none",color:CRED_COLORS[op.cred],fontSize:10,fontWeight:700,cursor:"pointer",outline:"none",width:"100%"}}>
                {CRED_STATES.map(s=><option key={s} value={s} style={{background:"#1e293b"}}>{s}</option>)}
              </select>
              <select value={op.credType} onChange={e=>onUpdate(op.id,{credType:e.target.value})} style={{background:"transparent",border:"none",color:CRED_TYPE_COLORS[op.credType],fontSize:10,fontWeight:700,cursor:"pointer",outline:"none",width:"100%"}}>
                {CRED_TYPES.map(t=><option key={t} value={t} style={{background:"#1e293b"}}>{t}</option>)}
              </select>
              <span style={{fontSize:10,color:"#22c55e",fontWeight:700}}>${op.rate}</span>
              <Tag label={op.risk} color={RISK_COLORS[op.risk]} small/>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── DEPLOYMENT MATRIX ────────────────────────────────────────────────────────

function DeployMatrix({ ops }) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{background:"#0a1628",border:"1px solid #1e3a5f",borderRadius:8,padding:"10px 16px",fontSize:10,color:"#64748b"}}>
        🔒 <strong style={{color:"#0ea5e9"}}>Deployment Protection Active</strong> — Festival zone requires Approved credential + Artist / Vendor / Festival Grounds badge. Violations flagged in red.
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10}}>
        {ZONES.map(zone=>{
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
              <div style={{fontSize:13,fontWeight:900,color:"#e2e8f0",marginBottom:6}}>{zone}</div>
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
      <div style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:8,padding:"12px 16px",display:"flex",gap:18,alignItems:"center",flexWrap:"wrap"}}>
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
                <div style={{fontSize:12,fontWeight:800,color:"#e2e8f0"}}>{op.name}</div>
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
      <div style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:8,overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:"80px 1fr 60px 85px 100px 85px 1fr",background:"#0a0f1a",borderBottom:"1px solid #1e293b",padding:"9px 14px",gap:8}}>
          {["ID","Name","Tier","Zone","Perf Score","Rehire?","Notes"].map(h=>(
            <span key={h} style={{fontSize:9,fontWeight:800,color:"#475569",letterSpacing:"0.07em"}}>{h}</span>
          ))}
        </div>
        <div style={{maxHeight:480,overflowY:"auto"}}>
          {filtered.map(op=>(
            <div key={op.id} style={{display:"grid",gridTemplateColumns:"80px 1fr 60px 85px 100px 85px 1fr",padding:"10px 14px",gap:8,borderBottom:"1px solid #0f172a",alignItems:"center",
              background:op.rehireEligible===false?"#1a0000":op.rehireEligible===true?"#001a05":"transparent"}}>
              <span style={{fontSize:10,color:"#64748b",fontFamily:"monospace"}}>{op.id}</span>
              <div>
                <div style={{fontSize:11,fontWeight:700,color:"#e2e8f0"}}>{op.name}</div>
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

// ─── ALL OPERATORS ────────────────────────────────────────────────────────────

function OpsTable({ ops, onUpdate, currentRole }) {
  const [sort, setSort]         = useState("id");
  const [search, setSearch]     = useState("");
  const [tierF, setTierF]       = useState("All");
  const [stageF, setStageF]     = useState("All");
  const [gearF, setGearF]       = useState("All");
  const [broadcastF, setBroadcastF] = useState(false);
  const [selected, setSelected] = useState(null);

  const canEdit = f => {
    if (currentRole==="Production Lead") return true;
    if (currentRole==="Credential Manager") return ["cred","credType","zone"].includes(f);
    if (currentRole==="Hiring Coordinator") return ["stage","tier","rate","reliability","workedWithMemeHouse","lateToScreen","rateInstability","gear"].includes(f);
    return false;
  };

  const filtered = [...ops]
    .filter(o=>{
      const q=search.toLowerCase();
      const ms=!q||o.name.toLowerCase().includes(q)||o.id.includes(q)||o.zone.toLowerCase().includes(q);
      const mt=tierF==="All"||o.tier===tierF;
      const mst=stageF==="All"||o.stage===stageF;
      const mg=gearF==="All"||o.gear.includes(gearF);
      const mb=!broadcastF||isBroadcastQualified(o);
      return ms&&mt&&mst&&mg&&mb;
    })
    .sort((a,b)=>{
      if(sort==="id")   return a.id.localeCompare(b.id);
      if(sort==="name") return a.name.localeCompare(b.name);
      if(sort==="rate") return b.rate-a.rate;
      if(sort==="rel")  return b.reliability-a.reliability;
      return 0;
    });

  const op = ops.find(o=>o.id===selected);

  return (
    <div style={{display:"flex",gap:14}}>
      <div style={{flex:1,display:"flex",flexDirection:"column",gap:10}}>
        <div style={{display:"flex",gap:7,flexWrap:"wrap",alignItems:"center"}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, ID, zone..."
            style={{background:"#1e293b",border:"1px solid #334155",borderRadius:6,padding:"6px 12px",color:"#e2e8f0",fontSize:11,outline:"none",flex:1,minWidth:160}}/>
          <select value={tierF} onChange={e=>setTierF(e.target.value)} style={{background:"#1e293b",border:"1px solid #334155",borderRadius:6,padding:"6px 10px",color:"#94a3b8",fontSize:10,outline:"none"}}>
            <option>All</option>{Object.keys(TIERS).map(t=><option key={t}>{t}</option>)}
          </select>
          <select value={stageF} onChange={e=>setStageF(e.target.value)} style={{background:"#1e293b",border:"1px solid #334155",borderRadius:6,padding:"6px 10px",color:"#94a3b8",fontSize:10,outline:"none"}}>
            <option value="All">All Stages</option>{HIRE_STAGES.map(s=><option key={s}>{s}</option>)}
          </select>
          <select value={gearF} onChange={e=>setGearF(e.target.value)} style={{background:"#1e293b",border:"1px solid #334155",borderRadius:6,padding:"6px 10px",color:"#94a3b8",fontSize:10,outline:"none"}}>
            <option value="All">All Gear</option>{GEAR_TAGS.map(g=><option key={g}>{g}</option>)}
          </select>
          <button onClick={()=>setBroadcastF(v=>!v)} style={{padding:"6px 12px",borderRadius:6,border:"none",cursor:"pointer",fontSize:10,fontWeight:700,background:broadcastF?"#22d3ee":"#1e293b",color:broadcastF?"#0a0f1a":"#64748b"}}>📡 Broadcast Only</button>
          {["id","name","rate","rel"].map(s=>(
            <button key={s} onClick={()=>setSort(s)} style={{padding:"5px 9px",borderRadius:5,border:"none",cursor:"pointer",fontSize:9,fontWeight:700,background:sort===s?"#6366f1":"#1e293b",color:sort===s?"#fff":"#64748b"}}>↕ {s==="rel"?"REL":s.toUpperCase()}</button>
          ))}
        </div>

        <div style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:8,overflow:"hidden"}}>
          <div style={{display:"grid",gridTemplateColumns:"80px 1fr 55px 80px 100px 115px 60px 70px 55px",background:"#0a0f1a",borderBottom:"1px solid #1e293b",padding:"9px 14px",gap:7}}>
            {["ID","Name","Tier","Stage","Cred","Cred Type","Rate","Rel.","Risk"].map(h=>(
              <span key={h} style={{fontSize:9,fontWeight:800,color:"#475569",letterSpacing:"0.06em"}}>{h}</span>
            ))}
          </div>
          <div style={{maxHeight:490,overflowY:"auto"}}>
            {filtered.map(o=>(
              <div key={o.id} onClick={()=>setSelected(selected===o.id?null:o.id)}
                style={{display:"grid",gridTemplateColumns:"80px 1fr 55px 80px 100px 115px 60px 70px 55px",padding:"9px 14px",gap:7,borderBottom:"1px solid #0f172a",alignItems:"center",
                  cursor:"pointer",background:selected===o.id?"#1e293b":o.cred==="Denied"?"#1a0000":o.isBuffer?"#0d0d1a":"transparent",transition:"background 0.1s"}}>
                <span style={{fontSize:10,color:"#64748b",fontFamily:"monospace"}}>{o.id}</span>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:"#e2e8f0"}}>{o.name}</div>
                  <div style={{fontSize:9,color:"#475569"}}>{o.workedWithMemeHouse?"✓ Alumni":o.source}{isBroadcastQualified(o)?" · 📡":""}</div>
                </div>
                <Tag label={o.tier} color={TIERS[o.tier].color} small/>
                <span style={{fontSize:9,color:STAGE_COLORS[o.stage],fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.stage}</span>
                <span style={{fontSize:9,color:CRED_COLORS[o.cred],fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.cred}</span>
                <span style={{fontSize:9,color:CRED_TYPE_COLORS[o.credType],fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.credType}</span>
                <span style={{fontSize:10,color:"#22c55e",fontWeight:700}}>${o.rate}</span>
                <Stars value={o.reliability}/>
                <Tag label={o.risk} color={RISK_COLORS[o.risk]} small/>
              </div>
            ))}
          </div>
          <div style={{padding:"7px 14px",background:"#0a0f1a",borderTop:"1px solid #1e293b",fontSize:10,color:"#475569"}}>
            {filtered.length} of {ops.length} ops · {filtered.filter(isBroadcastQualified).length} broadcast-qualified
          </div>
        </div>
      </div>

      {op && (
        <div style={{width:268,background:"#0f172a",border:"1px solid #1e293b",borderRadius:8,padding:"16px 14px",flexShrink:0,display:"flex",flexDirection:"column",gap:12,maxHeight:"82vh",overflowY:"auto"}}>
          <div>
            <div style={{fontSize:9,color:"#475569",fontFamily:"monospace",marginBottom:3}}>{op.id}</div>
            <div style={{fontSize:14,fontWeight:900,color:"#e2e8f0",marginBottom:6}}>{op.name}</div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              <Tag label={TIERS[op.tier].label} color={TIERS[op.tier].color}/>
              {op.workedWithMemeHouse && <Tag label="MH Alumni" color="#22c55e"/>}
              {op.isBuffer && <Tag label="BUFFER" color="#a855f7"/>}
            </div>
          </div>

          <div style={{borderTop:"1px solid #1e293b",paddingTop:10}}>
            <div style={{fontSize:9,color:"#475569",fontWeight:800,letterSpacing:"0.08em",marginBottom:6}}>RELIABILITY · AUTO-RISK</div>
            <Stars value={op.reliability} onChange={canEdit("reliability")?v=>{const u={...op,reliability:v};onUpdate(op.id,{reliability:v,risk:computeAutoRisk(u)});}:null} disabled={!canEdit("reliability")}/>
            <div style={{marginTop:7,display:"flex",gap:5,alignItems:"center"}}>
              <Tag label={`RISK: ${op.risk}`} color={RISK_COLORS[op.risk]}/>
            </div>
            <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:5}}>
              {[["lateToScreen","Late to Screening"],["rateInstability","Rate Instability"],["workedWithMemeHouse","Worked w/ MemeHouse"]].map(([k,l])=>(
                <label key={k} style={{display:"flex",gap:6,alignItems:"center",cursor:canEdit(k)?"pointer":"default"}}>
                  <input type="checkbox" checked={op[k]||false} disabled={!canEdit(k)}
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
                <GearChip key={g} label={g} active={op.gear.includes(g)}
                  onClick={()=>{
                    if(!canEdit("gear")) return;
                    const gear=op.gear.includes(g)?op.gear.filter(x=>x!==g):[...op.gear,g];
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
                <select value={op[field]} disabled={!canEdit(field)} onChange={e=>onUpdate(op.id,{[field]:e.target.value})}
                  style={{width:"100%",background:"#1e293b",border:`1px solid ${colors[op[field]]||"#334155"}44`,borderRadius:5,padding:"6px 8px",color:colors[op[field]]||"#94a3b8",fontSize:10,fontWeight:700,outline:"none"}}>
                  {opts.map(s=><option key={s} value={s} style={{background:"#1e293b"}}>{s}</option>)}
                </select>
              </div>
            ))}

            <div>
              <div style={{fontSize:9,color:"#475569",fontWeight:800,letterSpacing:"0.08em",marginBottom:5}}>ZONE</div>
              <select value={op.zone} disabled={!canEdit("zone")} onChange={e=>{
                const chk=canAssignToZone(op,e.target.value);
                if(!chk.ok){alert(`⚠ Deployment blocked: ${chk.reason}`);return;}
                onUpdate(op.id,{zone:e.target.value});
              }} style={{width:"100%",background:"#1e293b",border:"1px solid #334155",borderRadius:5,padding:"6px 8px",color:"#94a3b8",fontSize:10,fontWeight:700,outline:"none"}}>
                {ZONES.map(z=><option key={z} value={z} style={{background:"#1e293b"}}>{z}</option>)}
              </select>
              {!canAssignToZone(op,op.zone).ok && <div style={{fontSize:9,color:"#ef4444",fontWeight:700,marginTop:3}}>⚠ {canAssignToZone(op,op.zone).reason}</div>}
            </div>

            <div>
              <div style={{fontSize:9,color:"#475569",fontWeight:800,letterSpacing:"0.08em",marginBottom:5}}>HIRE STAGE</div>
              <select value={op.stage} disabled={!canEdit("stage")} onChange={e=>onUpdate(op.id,{stage:e.target.value})}
                style={{width:"100%",background:"#1e293b",border:`1px solid ${STAGE_COLORS[op.stage]}44`,borderRadius:5,padding:"6px 8px",color:STAGE_COLORS[op.stage],fontSize:10,fontWeight:700,outline:"none"}}>
                {HIRE_STAGES.map(s=><option key={s} value={s} style={{background:"#1e293b"}}>{s}</option>)}
              </select>
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

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const [ops, setOps]       = useState([]);
  const [view, setView]     = useState("dashboard");
  const [role, setRole]     = useState("Production Lead");
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const [saving, setSaving] = useState(false);

  // ─── LOAD DATA ──────────────────────────────────────────────────────────────
  const loadOps = useCallback(async () => {
    try {
      const data = await api.getOperators();
      // Normalize DB snake_case → camelCase for UI compatibility
      setOps(data.map(o => ({
        id: o.id,
        opId: o.op_id,
        name: o.full_name,
        tier: o.tier,
        zone: o.zone || 'Floater',
        stage: o.hire_stage,
        cred: o.cred_status,
        credType: o.cred_type,
        rate: o.day_rate,
        source: o.source || '',
        isBuffer: o.is_buffer,
        phone: o.phone || '',
        reel: o.reel,
        refs: o.refs,
        loa: o.loa,
        w9: o.w9,
        reliability: o.reliability,
        workedWithMemeHouse: o.worked_with_memehouse,
        lateToScreen: o.late_to_screen,
        rateInstability: o.rate_instability,
        gear: o.gear || [],
        perfScore: o.perf_score,
        rehireEligible: o.rehire_eligible,
        postNotes: o.post_notes || '',
        risk: o.risk || computeAutoRisk(o),
      })));
      setLoading(false);
    } catch (err) {
      setError('Failed to connect to server. Running in offline mode.');
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadOps(); }, [loadOps]);

  const updateOp = async (id, updates) => {
    // Optimistic update
    setOps(prev => prev.map(o => {
      if (o.id !== id) return o;
      const updated = {...o, ...updates};
      if (["reliability","workedWithMemeHouse","lateToScreen","rateInstability","refs","cred"].some(k=>k in updates)) {
        updated.risk = computeAutoRisk(updated);
      }
      return updated;
    }));
    // Map camelCase → snake_case for API
    const dbUpdates = {};
    const keyMap = {
      stage:'hire_stage', cred:'cred_status', credType:'cred_type',
      rate:'day_rate', reliability:'reliability', workedWithMemeHouse:'worked_with_memehouse',
      lateToScreen:'late_to_screen', rateInstability:'rate_instability',
      isBuffer:'is_buffer', postNotes:'post_notes', perfScore:'perf_score',
      rehireEligible:'rehire_eligible', name:'full_name',
    };
    Object.entries(updates).forEach(([k, v]) => {
      dbUpdates[keyMap[k] || k] = v;
    });
    try { await api.updateOperator(id, dbUpdates); }
    catch (err) { console.error('Update failed:', err); }
  };


  if (loading) return (
    <div style={{minHeight:'100vh',background:'#060b14',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Space Mono',monospace"}}>
      <div style={{textAlign:'center',color:'#475569'}}>
        <div style={{fontSize:11,letterSpacing:'0.1em'}}>CONNECTING TO DATABASE...</div>
      </div>
    </div>
  );

  if (error) return (
    <div style={{minHeight:'100vh',background:'#060b14',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Space Mono',monospace"}}>
      <div style={{textAlign:'center',color:'#ef4444',maxWidth:400,padding:20}}>
        <div style={{fontSize:11,letterSpacing:'0.1em',marginBottom:8}}>CONNECTION ERROR</div>
        <div style={{fontSize:10,color:'#64748b'}}>{error}</div>
        <button onClick={()=>{setLoading(true);setError(null);loadOps();}} style={{marginTop:16,padding:'8px 20px',background:'#ef4444',border:'none',borderRadius:4,color:'#fff',fontSize:10,cursor:'pointer',fontWeight:700}}>RETRY</button>
      </div>
    </div>
  );

  const VIEWS = [
    {id:"dashboard", label:"Dashboard"},
    {id:"kanban",    label:"Kanban"},
    {id:"creds",     label:"Credentials"},
    {id:"deploy",    label:"Deployment"},
    {id:"emergency", label:"Emergency Pool"},
    {id:"ops",       label:"All Operators"},
    {id:"postevent", label:"Post-Event"},
    {id:"schema",    label:"DB Schema"},
  ];

  const roleColors = {"Production Lead":"#ef4444","Credential Manager":"#0ea5e9","Hiring Coordinator":"#22c55e"};
  const highRiskCount   = ops.filter(o=>o.risk==="HIGH").length;
  const emergencyCount  = ops.filter(o=>o.cred==="Approved"&&(o.zone==="Floater"||o.stage!=="Confirmed")&&o.reliability>=4&&o.stage!=="Passed"&&o.stage!=="Outreach").length;

  return (
    <div style={{minHeight:"100vh",background:"#060b14",fontFamily:"'Space Mono','Courier New',monospace",color:"#e2e8f0"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap');
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:#0f172a}
        ::-webkit-scrollbar-thumb{background:#334155;border-radius:3px}
        select option{background:#1e293b;color:#e2e8f0}
      `}</style>

      <div style={{background:"#0a0f1a",borderBottom:"1px solid #1e293b",padding:"0 24px",display:"flex",alignItems:"center",height:52,position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginRight:24,flexShrink:0}}>
          <div style={{width:26,height:26,borderRadius:6,background:"linear-gradient(135deg,#e94560,#6366f1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900,color:"#fff"}}>M</div>
          <div>
            <div style={{fontSize:11,fontWeight:900,color:"#e2e8f0",letterSpacing:"0.05em"}}>MEMEHOUSE OPS</div>
            <div style={{fontSize:8,color:"#475569",letterSpacing:"0.1em"}}>COACHELLA — 48 DAY SPRINT</div>
          </div>
        </div>

        <div style={{display:"flex",gap:0,flex:1,overflowX:"auto"}}>
          {VIEWS.map(v=>(
            <button key={v.id} onClick={()=>setView(v.id)} style={{
              padding:"0 13px",height:52,border:"none",cursor:"pointer",fontSize:9,fontWeight:800,letterSpacing:"0.06em",
              background:"transparent",color:view===v.id?"#e2e8f0":"#475569",
              borderBottom:view===v.id?"2px solid #e94560":"2px solid transparent",
              whiteSpace:"nowrap",position:"relative",flexShrink:0
            }}>
              {v.label.toUpperCase()}
              {v.id==="emergency"&&emergencyCount>0 && <span style={{position:"absolute",top:8,right:2,width:14,height:14,borderRadius:99,background:"#22c55e",fontSize:8,fontWeight:900,color:"#000",display:"flex",alignItems:"center",justifyContent:"center"}}>{emergencyCount}</span>}
              {v.id==="creds"&&highRiskCount>0 && <span style={{position:"absolute",top:8,right:2,width:14,height:14,borderRadius:99,background:"#ef4444",fontSize:8,fontWeight:900,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}>{highRiskCount}</span>}
            </button>
          ))}
        </div>

        <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
          <div style={{width:7,height:7,borderRadius:99,background:roleColors[role]}}/>
          <select value={role} onChange={e=>setRole(e.target.value)} style={{background:"#1e293b",border:"1px solid #334155",borderRadius:5,padding:"4px 8px",color:"#94a3b8",fontSize:9,fontWeight:700,outline:"none",cursor:"pointer"}}>
            {ROLES.map(r=><option key={r}>{r}</option>)}
          </select>
        </div>
      </div>

      <div style={{background:`${roleColors[role]}11`,borderBottom:`1px solid ${roleColors[role]}22`,padding:"5px 24px",display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
        <span style={{display:"inline-block",padding:"2px 9px",borderRadius:99,fontSize:10,fontWeight:700,color:roleColors[role],background:roleColors[role]+"22",border:`1px solid ${roleColors[role]}44`}}>{role.toUpperCase()}</span>
        <span style={{fontSize:9,color:"#64748b"}}>
          {role==="Production Lead" && "Full access — all fields editable"}
          {role==="Credential Manager" && "Cred status + type + zone editable · Hire stages read-only"}
          {role==="Hiring Coordinator" && "Stage + tier + rate + reliability + gear editable · Credentials read-only"}
        </span>
        <span style={{marginLeft:"auto",fontSize:9,color:"#475569"}}>
          {ops.filter(o=>o.stage==="Confirmed").length} confirmed ·{" "}
          {ops.filter(o=>o.cred==="Approved").length} credentialed ·{" "}
          <span style={{color:"#ef4444",fontWeight:700}}>{highRiskCount} high-risk</span> ·{" "}
          <span style={{color:"#22c55e",fontWeight:700}}>{emergencyCount} emergency pool</span>
        </span>
      </div>

      <div style={{padding:"20px 24px",maxWidth:1400,margin:"0 auto"}}>
        {view==="dashboard" && <Dashboard ops={ops}/>}
        {view==="kanban"    && <Kanban ops={ops} onUpdate={updateOp}/>}
        {view==="creds"     && <CredsTracker ops={ops} onUpdate={updateOp}/>}
        {view==="deploy"    && <DeployMatrix ops={ops}/>}
        {view==="emergency" && <EmergencyPool ops={ops}/>}
        {view==="ops"       && <OpsTable ops={ops} onUpdate={updateOp} currentRole={role}/>}
        {view==="postevent" && <PostEventReview ops={ops} onUpdate={updateOp}/>}
        {view==="schema"    && <SchemaView/>}
      </div>
    </div>
  );
}
