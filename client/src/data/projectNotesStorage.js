/**
 * Project-level production notes (localStorage). One string per project.
 * Key: projectId -> notes text.
 */
const STORAGE_KEY = "memehouse-ops-project-notes";

function loadAll() {
  try {
    const raw = typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAll(data) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getProjectNotes(projectId) {
  if (!projectId) return "";
  const data = loadAll();
  const v = data[projectId];
  return typeof v === "string" ? v : "";
}

export function setProjectNotes(projectId, text) {
  if (!projectId || typeof window === "undefined") return;
  const data = loadAll();
  data[projectId] = typeof text === "string" ? text : "";
  saveAll(data);
}
