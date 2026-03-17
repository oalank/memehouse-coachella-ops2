import { useState, useEffect } from "react";
import { GlassModal } from "./GlassModal";
import { GlassInput } from "./GlassInput";
import { GlassDateInput } from "./GlassDateInput";

const fieldLabelClass = "text-[11px] font-semibold text-muted-foreground tracking-wide uppercase block mb-1.5";

export default function EditProjectModal({ project, onSave, onClose }) {
  const budgetCap = project?.budget?.laborCap ?? 0;
  const breakPolicy = project?.breakPolicy ?? {};
  const zones = Array.isArray(project?.zones) ? project.zones : [];
  const [form, setForm] = useState({
    name: "",
    laborCap: "",
    startDate: "",
    endDate: "",
    location: "",
    clientName: "",
    credentialsRequired: true,
    mealBreakRequiredAfterHours: "",
    mealBreakDurationMinutes: "",
    zonesText: "",
    streamReportLink: "",
    gearCheckoutLink: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    // Log whenever we (re)initialize the form from project props
    console.log("[EditProjectModal] init from project", {
      id: project?.id,
      name: project?.name,
      budgetCap,
    });
    if (project) {
      setForm({
        name: project.name || "",
        laborCap: budgetCap === 0 ? "" : String(budgetCap),
        startDate: (project.eventStartISO || project.startDate || "").slice(0, 10),
        endDate: (project.eventEndISO || project.endDate || "").slice(0, 10),
        location: project.location ?? "",
        clientName: project.clientName ?? "",
        credentialsRequired: project.credentialsRequired !== false,
        mealBreakRequiredAfterHours: breakPolicy.mealBreakRequiredAfterHours != null ? String(breakPolicy.mealBreakRequiredAfterHours) : "",
        mealBreakDurationMinutes: breakPolicy.mealBreakDurationMinutes != null ? String(breakPolicy.mealBreakDurationMinutes) : "",
        zonesText: zones.join("\n"),
        streamReportLink: project.streamReportLink ?? "",
        gearCheckoutLink: project.gearCheckoutLink ?? "",
      });
    }
  // Only re-init when the project identity changes (e.g. switching projects),
  // not on every render of derived objects like zones/breakPolicy.
  }, [project?.id]);

  // Log field values on every render for debugging
  console.log("[EditProjectModal] render values", {
    name: form.name,
    laborCap: form.laborCap,
  });

  const update = (key, value) => {
    if (key === "laborCap") {
      console.log("[EditProjectModal] Budget Cap change", { raw: value });
    }
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr(null);
    console.log("[EditProjectModal] handleSubmit called with form:", form);
    const name = (form.name || "").trim();
    if (!name) {
      setErr("Project name is required.");
      return;
    }
    const laborCap = form.laborCap === "" || form.laborCap == null ? 0 : Number(form.laborCap);
    if (!Number.isFinite(laborCap) || laborCap < 0) {
      setErr("Budget cap must be a number ≥ 0.");
      return;
    }
    setSaving(true);
    try {
      const startDate = (form.startDate || "").slice(0, 10);
      const endDate = (form.endDate || "").slice(0, 10);
      const zonesText = (form.zonesText || "").trim();
      const zonesArray = zonesText ? zonesText.split(/\n/).map((s) => s.trim()).filter(Boolean) : zones;

      const breakPolicyUpdate = {};
      if (form.mealBreakRequiredAfterHours !== "" && form.mealBreakRequiredAfterHours != null) {
        const h = Number(form.mealBreakRequiredAfterHours);
        if (Number.isFinite(h) && h >= 0) breakPolicyUpdate.mealBreakRequiredAfterHours = h;
      }
      if (form.mealBreakDurationMinutes !== "" && form.mealBreakDurationMinutes != null) {
        const m = Number(form.mealBreakDurationMinutes);
        if (Number.isFinite(m) && m >= 0) breakPolicyUpdate.mealBreakDurationMinutes = m;
      }

      const payload = {
        name,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        eventStartISO: startDate || undefined,
        eventEndISO: endDate || undefined,
        location: (form.location || "").trim() || undefined,
        clientName: (form.clientName || "").trim() || undefined,
        budget: { laborCap },
        credentialsRequired: form.credentialsRequired,
        zones: zonesArray.length ? zonesArray : undefined,
        breakPolicy: Object.keys(breakPolicyUpdate).length ? { ...breakPolicy, ...breakPolicyUpdate } : undefined,
        streamReportLink: (form.streamReportLink || "").trim() || undefined,
        gearCheckoutLink: (form.gearCheckoutLink || "").trim() || undefined,
      };
      console.log("[EditProjectModal] onSave payload", payload);
      await Promise.resolve(onSave(payload));
    } catch (e) {
      setErr(e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (!project) return null;

  return (
    <GlassModal
      open={true}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title="Edit project"
      description="Update project configuration. Operators, shifts, expenses, and deployment are not changed."
      className="max-w-[480px] max-h-[90vh] overflow-y-auto"
    >
      {err && <div className="text-sm text-destructive mb-3">{err}</div>}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
        <div>
          <label className={fieldLabelClass}>Project name</label>
          <GlassInput
            type="text"
            value={form.name}
            onFocus={(e) => {
              console.log("[EditProjectModal] Project name onFocus", { value: e.target.value });
            }}
            onKeyDown={(e) => {
              console.log("[EditProjectModal] Project name onKeyDown", { key: e.key, value: e.target.value });
            }}
            onInput={(e) => {
              console.log("[EditProjectModal] Project name onInput", { value: e.target.value });
            }}
            onChange={(e) => {
              console.log("[EditProjectModal] Project name onChange", { value: e.target.value });
              update("name", e.target.value);
            }}
            placeholder="e.g. Coachella 2026"
            required
          />
        </div>
        <div>
          <label className={fieldLabelClass}>Budget cap ($)</label>
          <GlassInput
            type="text"
            value={form.laborCap}
            onMouseDown={(e) => {
              console.log("[EditProjectModal] Budget Cap onMouseDown", { button: e.button, value: e.target.value });
            }}
            onClick={(e) => {
              console.log("[EditProjectModal] Budget Cap onClick", { value: e.target.value });
            }}
            onFocus={(e) => {
              console.log("[EditProjectModal] Budget Cap onFocus", { value: e.target.value });
            }}
            onKeyDown={(e) => {
              console.log("[EditProjectModal] Budget Cap onKeyDown", { key: e.key, value: e.target.value });
            }}
            onInput={(e) => {
              console.log("[EditProjectModal] Budget Cap onInput", { value: e.target.value });
            }}
            onChange={(e) => {
              console.log("[EditProjectModal] Budget Cap onChange", { value: e.target.value });
              update("laborCap", e.target.value);
            }}
            placeholder="Labor budget cap"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <GlassDateInput label="Start date" value={form.startDate} onChange={(e) => update("startDate", e.target.value)} />
          <GlassDateInput label="End date" value={form.endDate} onChange={(e) => update("endDate", e.target.value)} />
        </div>
        <div>
          <label className={fieldLabelClass}>Location</label>
          <GlassInput type="text" value={form.location} onChange={(e) => update("location", e.target.value)} placeholder="e.g. Indio, CA" />
        </div>
        <div>
          <label className={fieldLabelClass}>Client / production name</label>
          <GlassInput type="text" value={form.clientName} onChange={(e) => update("clientName", e.target.value)} placeholder="e.g. Goldenvoice" />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="edit-cred-required"
            checked={form.credentialsRequired}
            onChange={(e) => update("credentialsRequired", e.target.checked)}
            className="accent-primary w-4 h-4 rounded"
          />
          <label htmlFor="edit-cred-required" className="text-xs font-semibold text-foreground cursor-pointer">
            Credentials required for this project
          </label>
        </div>
        <div className="border-t border-white/[0.06] pt-3">
          <span className={fieldLabelClass}>Break policy</span>
          <p className="text-[10px] text-muted-foreground mb-2">Meal break required after (hours) and duration (minutes). Leave empty to leave unchanged.</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <GlassInput
                type="number"
                min={0}
                step={0.5}
                value={form.mealBreakRequiredAfterHours}
                onChange={(e) => update("mealBreakRequiredAfterHours", e.target.value)}
                placeholder="e.g. 6"
              />
              <span className="text-[10px] text-muted-foreground">Hours before break required</span>
            </div>
            <div>
              <GlassInput
                type="number"
                min={0}
                value={form.mealBreakDurationMinutes}
                onChange={(e) => update("mealBreakDurationMinutes", e.target.value)}
                placeholder="e.g. 30"
              />
              <span className="text-[10px] text-muted-foreground">Break duration (min)</span>
            </div>
          </div>
        </div>
        <div>
          <label className={fieldLabelClass}>Zones / houses</label>
          <textarea
            value={form.zonesText}
            onChange={(e) => update("zonesText", e.target.value)}
            placeholder="One per line"
            rows={3}
            className="w-full px-3 py-2 rounded-xl border border-white/10 bg-white/[0.04] text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y"
          />
        </div>
        <div>
          <label className={fieldLabelClass}>Stream report link (optional)</label>
          <GlassInput
            type="url"
            value={form.streamReportLink}
            onChange={(e) => update("streamReportLink", e.target.value)}
            placeholder="https://..."
          />
        </div>
        <div>
          <label className={fieldLabelClass}>Gear checkout link (optional)</label>
          <GlassInput
            type="url"
            value={form.gearCheckoutLink}
            onChange={(e) => update("gearCheckoutLink", e.target.value)}
            placeholder="https://..."
          />
        </div>
        <div className="flex gap-3 justify-end pt-4 border-t border-white/[0.06]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary-glow flex-1 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </GlassModal>
  );
}
