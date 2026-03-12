/**
 * Project-level expenses (localStorage). One list per project.
 * Structure: { [projectId]: [ { id, projectId, category, description, amount, date, submittedBy, note }, ... ] }
 */
const STORAGE_KEY = "memehouse-ops-expenses";

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

/** Get expenses for a project (sorted by date desc, then id). */
export function getExpenses(projectId) {
  if (!projectId) return [];
  const data = loadAll();
  const list = Array.isArray(data[projectId]) ? data[projectId] : [];
  return [...list].sort((a, b) => {
    const d = (b.date || "").localeCompare(a.date || "");
    if (d !== 0) return d;
    return String(b.id || "").localeCompare(String(a.id || ""));
  });
}

/** Add an expense. Returns the created expense with id. */
export function addExpense(projectId, payload) {
  if (!projectId) return null;
  const id = `exp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const expense = {
    id,
    projectId,
    category: payload.category || "Misc Production",
    description: payload.description || "",
    amount: Number(payload.amount) || 0,
    date: (payload.date || "").slice(0, 10),
    submittedBy: payload.submittedBy || "",
    note: payload.note ?? "",
  };
  const data = loadAll();
  const list = Array.isArray(data[projectId]) ? data[projectId] : [];
  data[projectId] = [...list, expense];
  saveAll(data);
  return expense;
}

/** Remove an expense by id. */
export function removeExpense(projectId, expenseId) {
  if (!projectId || !expenseId) return;
  const data = loadAll();
  const list = Array.isArray(data[projectId]) ? data[projectId] : [];
  data[projectId] = list.filter((e) => e.id !== expenseId);
  saveAll(data);
}

/** Total amount for a project. */
export function getExpensesTotal(projectId) {
  return getExpenses(projectId).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
}

/** Remove all expenses for a project (e.g. when project is permanently deleted). */
export function removeAllExpensesForProject(projectId) {
  if (!projectId) return;
  const data = loadAll();
  delete data[projectId];
  saveAll(data);
}

/** Demo/seed only: replace expenses for a project with the given list. Each item: { id?, category, description, amount, date, submittedBy, note? }. */
export function setExpensesForProject(projectId, expenses) {
  if (!projectId || typeof window === "undefined") return;
  const list = Array.isArray(expenses)
    ? expenses.map((e) => ({
        id: e.id || `exp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        projectId,
        category: e.category || "Misc Production",
        description: e.description || "",
        amount: Number(e.amount) || 0,
        date: (e.date || "").slice(0, 10),
        submittedBy: e.submittedBy || "",
        note: e.note ?? "",
      }))
    : [];
  const data = loadAll();
  data[projectId] = list;
  saveAll(data);
}
