import { useState, useEffect } from "react";
import { GlassModal } from "./GlassModal";
import { GlassInput } from "./GlassInput";
import { GlassDateInput } from "./GlassDateInput";
import { GlassSelect } from "./GlassSelect";

const DEFAULT_STAGES = ["Outreach", "Responded", "Screened", "Interviewing", "Offered", "LOA Signed", "Confirmed"];

const ZONE_PRESET_OPTIONS = [
  { id: "studio", label: "Studio" },
  { id: "exterior", label: "Exterior" },
  { id: "interior", label: "Interior" },
  { id: "house", label: "House" },
  { id: "festival", label: "Festival" },
  { id: "floater", label: "Floater" },
];

const INITIAL_ZONE_PRESETS = Object.fromEntries(ZONE_PRESET_OPTIONS.map((o) => [o.id, false]));

function buildZonesFromSelections(zonePresets, houseCount, customZoneLabels) {
  const list = [];
  if (zonePresets.studio) list.push("Studio");
  if (zonePresets.exterior) list.push("Exterior");
  if (zonePresets.interior) list.push("Interior");
  if (zonePresets.festival) list.push("Festival");
  if (zonePresets.floater) list.push("Floater");
  if (zonePresets.house) {
    const n = Math.min(20, Math.max(1, Number(houseCount) || 1));
    for (let i = 1; i <= n; i++) list.push(`House ${i}`);
  }
  (customZoneLabels || []).forEach((label) => {
    const t = (label || "").trim();
    if (t && !list.includes(t)) list.push(t);
  });
  return [...new Set(list)];
}

const INITIAL_FORM = {
  name: "",
  startDate: "",
  endDate: "",
  location: "",
  clientName: "",
  laborCap: "", // empty by default; any number >= 0 allowed
  zonePresets: { ...INITIAL_ZONE_PRESETS },
  houseCount: 8,
  customZoneLabels: [],
  stages: DEFAULT_STAGES,
   credentialsRequired: true,
};

const fieldLabelClass = "text-[11px] font-semibold text-muted-foreground tracking-wide uppercase";
const stepLabelClass = "text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3";

function CustomZoneInput({ onAdd, added = [], onRemove }) {
  const [value, setValue] = useState("");
  const handleAdd = () => {
    if ((value || "").trim()) {
      onAdd(value.trim());
      setValue("");
    }
  };
  return (
    <div className="mt-4">
      <div className="flex gap-2 items-center flex-wrap">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAdd())}
          placeholder="Custom zone name"
          className="w-full max-w-[140px] px-3 py-2 rounded-xl text-sm glass text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
        <button type="button" onClick={handleAdd} className="px-3 py-2 rounded-xl text-xs font-semibold border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
          + Custom
        </button>
      </div>
      {added.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {added.map((label) => (
            <span key={label} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg glass-subtle text-xs border border-white/[0.06]">
              {label}
              <button type="button" onClick={() => onRemove(label)} aria-label={`Remove ${label}`} className="bg-transparent border-none cursor-pointer p-0 text-sm leading-none text-muted-foreground hover:text-foreground">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AddProjectModal({ onClose, onCreated }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ ...INITIAL_FORM });

  // Reset form when modal opens so new projects never inherit previous modal state
  useEffect(() => {
    setStep(1);
    setForm({ ...INITIAL_FORM });
  }, []);

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const setZonePreset = (id, checked) =>
    setForm((f) => ({ ...f, zonePresets: { ...f.zonePresets, [id]: checked } }));

  const setHouseCount = (delta) =>
    setForm((f) => {
      const n = Math.min(20, Math.max(1, (f.houseCount || 1) + delta));
      return { ...f, houseCount: n };
    });

  const addCustomZone = (label) => {
    const t = (label || "").trim();
    if (!t) return;
    setForm((f) => ({
      ...f,
      customZoneLabels: f.customZoneLabels.includes(t) ? f.customZoneLabels : [...f.customZoneLabels, t],
    }));
  };

  const removeCustomZone = (label) =>
    setForm((f) => ({ ...f, customZoneLabels: f.customZoneLabels.filter((l) => l !== label) }));

  const builtZones = buildZonesFromSelections(form.zonePresets || INITIAL_ZONE_PRESETS, form.houseCount ?? 8, form.customZoneLabels || []);

  const resetForm = () => {
    setStep(1);
    setForm({ ...INITIAL_FORM });
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (step === 1) {
      if (!form.name.trim()) return;
      setStep(2);
      return;
    }
    if (step === 2) {
      setStep(3);
      return;
    }
    if (step === 3) {
      const zones = buildZonesFromSelections(form.zonePresets || INITIAL_ZONE_PRESETS, form.houseCount ?? 8, form.customZoneLabels || []);
      const data = {
        name: form.name.trim(),
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        eventStartISO: form.startDate?.slice(0, 10),
        eventEndISO: form.endDate?.slice(0, 10),
        location: form.location || undefined,
        clientName: form.clientName || undefined,
        budget: { laborCap: (form.laborCap !== "" && form.laborCap != null && !Number.isNaN(Number(form.laborCap))) ? Number(form.laborCap) : 0 },
        credentialsRequired: form.credentialsRequired,
        kanban: { columns: (form.stages || DEFAULT_STAGES).map((id, i) => ({ id, label: id, order: i })), committedStages: ["Confirmed"] },
        zones,
      };
      onCreated(data);
      resetForm();
      onClose();
    }
  };

  const stepDescription = step === 1 ? "Project details." : step === 2 ? "Labor budget and zones." : "Review and create.";

  return (
    <GlassModal open={true} onOpenChange={(open) => { if (!open) handleClose(); }} title="Add project" description={stepDescription} className="max-w-[480px] max-h-[90vh] overflow-y-auto">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
        {step === 1 && (
          <div className="flex flex-col gap-4">
            <p className={stepLabelClass}>Step 1 — Details</p>
            <GlassInput label="Project name" type="text" value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="e.g. Coachella 2026" required autoFocus />
            <GlassDateInput label="Start date" value={form.startDate} onChange={(e) => update("startDate", e.target.value)} />
            <GlassDateInput label="End date" value={form.endDate} onChange={(e) => update("endDate", e.target.value)} />
            <GlassInput label="Location" type="text" value={form.location} onChange={(e) => update("location", e.target.value)} placeholder="e.g. Indio, CA" />
            <GlassInput label="Client / production name" type="text" value={form.clientName} onChange={(e) => update("clientName", e.target.value)} placeholder="e.g. Goldenvoice" />
          </div>
        )}
        {step === 2 && (
          <div className="flex flex-col gap-4">
            <p className={stepLabelClass}>Step 2 — Ops defaults</p>
            <GlassInput
              label="Labor budget cap ($)"
              type="number"
              min={0}
              inputMode="decimal"
              placeholder="Enter labor budget cap"
              value={form.laborCap === "" || form.laborCap == null ? "" : form.laborCap}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "") { update("laborCap", ""); return; }
                const n = Number(v);
                if (!Number.isNaN(n) && n >= 0) update("laborCap", v);
              }}
            />
            <div className="flex flex-col gap-2">
              <span className={fieldLabelClass}>Credentials</span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.credentialsRequired}
                  onChange={(e) => update("credentialsRequired", e.target.checked)}
                  className="accent-primary w-4 h-4 rounded"
                />
                <span className="text-xs text-foreground font-semibold">Credentials required for this project</span>
              </label>
              <p className="text-[11px] text-muted-foreground">
                When enabled, missing or denied credentials are treated as required and show stronger warnings.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <span className={fieldLabelClass}>Environments / Zones</span>
              <p className="text-xs text-muted-foreground mb-1">Select presets or add custom labels. Leave empty to add zones later in Project Settings.</p>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, zonePresets: { ...INITIAL_ZONE_PRESETS, house: true, festival: true, floater: true }, houseCount: 8 }))}
                className="text-[11px] text-muted-foreground bg-transparent border-none cursor-pointer underline mb-2"
              >
                Use standard template (8 Houses + Festival + Floater)
              </button>
              <div className="flex flex-wrap gap-2 mb-3">
                {ZONE_PRESET_OPTIONS.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setZonePreset(id, !form.zonePresets[id])}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${form.zonePresets[id] ? "glass text-primary border-primary/20 pill-glow-amber" : "glass-subtle text-muted-foreground border-transparent hover:text-foreground"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {form.zonePresets.house && (
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">How many houses?</span>
                  <div className="flex items-center gap-1">
                    <button type="button" aria-label="Decrease" onClick={() => setHouseCount(-1)} className="w-8 h-8 rounded-lg border border-white/10 glass-subtle text-sm cursor-pointer leading-none">−</button>
                    <input type="number" min={1} max={20} value={form.houseCount ?? 1} onChange={(e) => update("houseCount", Math.min(20, Math.max(1, parseInt(e.target.value, 10) || 1)))} className="w-12 text-center py-1.5 rounded-lg text-sm font-semibold glass border border-white/[0.06]" />
                    <button type="button" aria-label="Increase" onClick={() => setHouseCount(1)} className="w-8 h-8 rounded-lg border border-white/10 glass-subtle text-sm cursor-pointer leading-none">+</button>
                  </div>
                </div>
              )}
              <CustomZoneInput onAdd={addCustomZone} added={form.customZoneLabels} onRemove={removeCustomZone} />
            </div>
            <p className="text-xs text-muted-foreground">You can change stages and zones later in the dashboard.</p>
          </div>
        )}
        {step === 3 && (
          <div className="flex flex-col gap-3">
            <p className={stepLabelClass}>Step 3 — Confirm</p>
            <dl className="grid gap-2 text-sm [&_dt]:text-muted-foreground [&_dt]:font-medium [&_dd]:text-foreground">
              <dt>Name</dt><dd>{form.name || "—"}</dd>
              <dt>Dates</dt><dd>{form.startDate && form.endDate ? `${form.startDate} – ${form.endDate}` : form.startDate || "—"}</dd>
              <dt>Location</dt><dd>{form.location || "—"}</dd>
              <dt>Client</dt><dd>{form.clientName || "—"}</dd>
              <dt>Budget cap</dt><dd>{(form.laborCap !== "" && form.laborCap != null) ? "$" + Number(form.laborCap).toLocaleString() : "—"}</dd>
              <dt>Credentials required</dt><dd>{form.credentialsRequired ? "Yes" : "No (optional)"}</dd>
              <dt>Zones</dt><dd>{builtZones.length === 0 ? "None (add in Project Settings)" : builtZones.join(", ")}</dd>
            </dl>
          </div>
        )}
        <div className="flex gap-3 justify-end pt-4 border-t border-white/[0.06]">
          {step > 1 && (
            <button type="button" onClick={() => setStep(step - 1)} className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 transition-colors">Back</button>
          )}
          <button type="submit" className="btn-primary-glow px-4 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            {step === 3 ? "Create project" : "Next"}
          </button>
        </div>
      </form>
    </GlassModal>
  );
}
