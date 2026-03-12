/**
 * Project list persistence (localStorage). Structure ready to swap to DB later.
 */
import { PROJECTS as STATIC_PROJECTS } from "../projects";

const STORAGE_KEY = "memehouse-ops-custom-projects";
const DELETED_IDS_KEY = "memehouse-ops-deleted-project-ids";

const DEFAULT_KANBAN_COLUMNS = [
  { id: "Outreach", label: "Outreach", order: 0 },
  { id: "Responded", label: "Responded", order: 1 },
  { id: "Screened", label: "Screened", order: 2 },
  { id: "Interviewing", label: "Interviewing", order: 3 },
  { id: "Offered", label: "Offered", order: 4 },
  { id: "LOA Signed", label: "LOA Signed", order: 5 },
  { id: "Confirmed", label: "Confirmed", order: 6 },
];

const DEFAULT_ZONES_FALLBACK = ["House 1", "House 2", "House 3", "House 4", "House 5", "House 6", "House 7", "House 8", "Festival", "Floater"];

function loadCustom() {
  try {
    const raw = typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCustom(list) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

/** Permanently deleted project ids (so they do not reappear from static list). */
function loadDeletedIds() {
  try {
    const raw = typeof window !== "undefined" && window.localStorage.getItem(DELETED_IDS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveDeletedIds(ids) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DELETED_IDS_KEY, JSON.stringify([...ids]));
}

/** Normalize saved project to full project shape (eventStartISO, etc.) for dashboard. */
function toProjectConfig(row) {
  const start = row.startDate || row.eventStartISO || "";
  const end = row.endDate || row.eventEndISO || "";
  const breakPolicy = row.breakPolicy != null ? row.breakPolicy : null;
  return {
    id: row.id,
    name: row.name || "Unnamed",
    eventStartISO: start.slice(0, 10),
    eventEndISO: end.slice(0, 10),
    budget: row.budget ?? { laborCap: 0 },
    credentialsRequired: row.credentialsRequired !== false,
    kanban: row.kanban ?? { columns: DEFAULT_KANBAN_COLUMNS, committedStages: ["Confirmed"] },
    zones: Array.isArray(row.zones) ? row.zones : DEFAULT_ZONES_FALLBACK,
    theme: row.theme ?? { accentColor: "#e94560", logoLetter: (row.name || "M").charAt(0).toUpperCase() },
    location: row.location,
    clientName: row.clientName,
    status: normalizeStatus(row.status),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    breakPolicy: breakPolicy,
    streamReportLink: row.streamReportLink ?? "",
    gearCheckoutLink: row.gearCheckoutLink ?? "",
  };
}

/** Normalize legacy "current" to "active"; default to "active". */
function normalizeStatus(s) {
  if (s === "completed" || s === "archived") return s;
  return "active";
}

/** All projects: custom first (so they take precedence), then static for ids not in custom. Permanently deleted ids are excluded so they never reappear. Sorted by updatedAt DESC (most recent first). */
export function getAllProjects() {
  const deletedIds = loadDeletedIds();
  const custom = loadCustom()
    .map(toProjectConfig)
    .filter((p) => !deletedIds.has(p.id));
  const seen = new Set(custom.map((p) => p.id));
  const merged = [...custom];
  STATIC_PROJECTS.forEach((p) => {
    if (!seen.has(p.id) && !deletedIds.has(p.id)) {
      seen.add(p.id);
      merged.push(toProjectConfig({ ...p, status: p.status ?? "active" }));
    }
  });
  const sortKey = (p) => p.updatedAt || p.createdAt || "1970-01-01T00:00:00.000Z";
  merged.sort((a, b) => (sortKey(b) > sortKey(a) ? 1 : sortKey(b) < sortKey(a) ? -1 : 0));
  return merged;
}

export function getProjectById(id) {
  const all = getAllProjects();
  return all.find((p) => p.id === id) ?? null;
}

/** True if project is stored in custom (localStorage) and can be ended/archived. */
export function isCustomProject(id) {
  if (!id) return false;
  return loadCustom().some((r) => r.id === id);
}

/** Active projects (status = active). Shown on Menu. */
export function getActiveProjects() {
  return getAllProjects().filter((p) => normalizeStatus(p.status) === "active");
}

/** Archive: completed + archived. Shown on Archive tab. */
export function getArchiveProjects() {
  return getAllProjects().filter((p) => {
    const s = normalizeStatus(p.status);
    return s === "completed" || s === "archived";
  });
}

/** @deprecated Use getActiveProjects. Kept for compatibility. */
export function getCurrentProjects() {
  return getActiveProjects();
}

/** @deprecated Use getArchiveProjects. Kept for compatibility. */
export function getPastProjects() {
  return getArchiveProjects();
}

const now = () => new Date().toISOString();

/** Add a new project (from Add Project modal). Persist to localStorage. */
export function addProject(data) {
  const id = data.id || `project-${Date.now()}`;
  const custom = loadCustom();
  const row = {
    id,
    name: data.name || "Unnamed",
    startDate: (data.startDate || "").slice(0, 10),
    endDate: (data.endDate || "").slice(0, 10),
    eventStartISO: (data.startDate || data.eventStartISO || "").slice(0, 10),
    eventEndISO: (data.endDate || data.eventEndISO || "").slice(0, 10),
    location: data.location,
    clientName: data.clientName,
    budget: data.budget ?? { laborCap: 0 },
    credentialsRequired: data.credentialsRequired !== false,
    kanban: data.kanban ?? { columns: DEFAULT_KANBAN_COLUMNS, committedStages: ["Confirmed"] },
    zones: Array.isArray(data.zones) ? data.zones : [],
    theme: data.theme,
    status: "active",
    createdAt: now(),
    updatedAt: now(),
  };
  custom.push(row);
  saveCustom(custom);
  return toProjectConfig(row);
}

/** Bump updatedAt for a project (e.g. when opened or edited) so it sorts to the top. */
export function touchProject(id) {
  if (!id) return;
  const custom = loadCustom();
  const idx = custom.findIndex((r) => r.id === id);
  if (idx === -1) return;
  custom[idx] = { ...custom[idx], updatedAt: now() };
  saveCustom(custom);
}

/** Update project status (active | completed | archived). Only custom projects are updated. */
export function updateProjectStatus(id, status) {
  if (!id || !["active", "completed", "archived"].includes(status)) return null;
  const custom = loadCustom();
  const idx = custom.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  custom[idx] = { ...custom[idx], status, updatedAt: now() };
  saveCustom(custom);
  return toProjectConfig(custom[idx]);
}

/** Allowed keys when updating a project (config only; does not touch operators, shifts, expenses). */
const PROJECT_UPDATE_KEYS = [
  "name", "startDate", "endDate", "eventStartISO", "eventEndISO",
  "budget", "credentialsRequired", "zones", "location", "clientName",
  "breakPolicy", "streamReportLink", "gearCheckoutLink",
];

/** Update project configuration. Only custom projects; only allowed keys. Sets updatedAt. Does not modify operators, shifts, expenses, or deployment. */
export function updateProject(id, updates) {
  if (!id) return null;
  const custom = loadCustom();
  const idx = custom.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  const row = custom[idx];
  const next = { ...row, updatedAt: now() };
  PROJECT_UPDATE_KEYS.forEach((key) => {
    if (updates[key] !== undefined) next[key] = updates[key];
  });
  if (updates.budget != null && typeof updates.budget === "object" && updates.budget.laborCap !== undefined) {
    next.budget = { ...(row.budget ?? {}), laborCap: updates.budget.laborCap };
  }
  custom[idx] = next;
  saveCustom(custom);
  return toProjectConfig(next);
}

/** Permanently remove a custom project from the list. Also records id as deleted so it never reappears from static. Returns true if removed from custom, false if not found. */
export function removeProject(id) {
  if (!id) return false;
  const custom = loadCustom();
  const idx = custom.findIndex((r) => r.id === id);
  if (idx !== -1) {
    custom.splice(idx, 1);
    saveCustom(custom);
  }
  const deletedIds = loadDeletedIds();
  deletedIds.add(id);
  saveDeletedIds(deletedIds);
  return idx !== -1;
}

/** Demo/seed only: replace the entire custom projects list with the given rows. Each row: id, name, startDate, endDate, budget, credentialsRequired, zones, location, clientName, status, breakPolicy, streamReportLink, gearCheckoutLink, etc. */
export function replaceCustomProjectsForDemo(rows) {
  if (typeof window === "undefined") return;
  const list = Array.isArray(rows) ? rows.map((r) => ({ ...r })) : [];
  saveCustom(list);
}

/** Demo/seed only: remove the given project ids from the deleted set so they can appear in lists again. */
export function removeDemoIdsFromDeleted(ids) {
  if (typeof window === "undefined" || !Array.isArray(ids)) return;
  const deletedIds = loadDeletedIds();
  ids.forEach((id) => deletedIds.delete(id));
  saveDeletedIds(deletedIds);
}

/** Demo/seed only: remove the given project ids from the custom list (does not add them to deleted). */
export function removeProjectsFromCustom(ids) {
  if (typeof window === "undefined" || !Array.isArray(ids)) return;
  const set = new Set(ids);
  const custom = loadCustom().filter((r) => !set.has(r.id));
  saveCustom(custom);
}
