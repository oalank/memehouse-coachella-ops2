/**
 * Central project configs. Each production (Coachella, Rolling Loud, Tour, etc.) is one project.
 * Add new projects here; dashboard UI reads from this.
 */

/** @typedef {{ id: string, label: string, order?: number }} KanbanColumn */

/**
 * @typedef {Object} ProjectConfig
 * @property {string} id
 * @property {string} name
 * @property {string} [subtitle]
 * @property {string} eventStartISO
 * @property {string} [eventEndISO]
 * @property {{ laborCap: number }} [budget]
 * @property {{ columns: KanbanColumn[], committedStages?: string[] }} [kanban]
 * @property {string[]} [zones]
 * @property {Object} [theme] - e.g. { accentColor: string, logoLetter: string }
 */

/** @type {ProjectConfig[]} */
export const PROJECTS = [
  {
    id: "coachella-2026",
    name: "Coachella",
    eventStartISO: "2026-04-10",
    eventEndISO: "2026-04-19",
    budget: { laborCap: 80000 },
    kanban: {
      columns: [
        { id: "Outreach", label: "Outreach", order: 0 },
        { id: "Responded", label: "Responded", order: 1 },
        { id: "Screened", label: "Screened", order: 2 },
        { id: "Interviewing", label: "Interviewing", order: 3 },
        { id: "Offered", label: "Offered", order: 4 },
        { id: "LOA Signed", label: "LOA Signed", order: 5 },
        { id: "Confirmed", label: "Confirmed", order: 6 },
      ],
      committedStages: ["Confirmed"],
    },
    zones: ["House 1", "House 2", "House 3", "House 4", "House 5", "House 6", "House 7", "House 8", "Festival", "Floater"],
    theme: { accentColor: "#e94560", logoLetter: "M" },
  },
  // Add more productions here, e.g.:
  // { id: "rolling-loud-2026", name: "Rolling Loud", eventStartISO: "2026-07-24", eventEndISO: "2026-07-26", budget: { laborCap: 60000 }, kanban: { columns: [...], committedStages: ["Confirmed"] }, theme: { accentColor: "#22c55e", logoLetter: "R" } },
];

/** @param {string} id */
export function getProjectById(id) {
  return PROJECTS.find((p) => p.id === id) ?? null;
}

/** Kanban column ids in order for a project (default pipeline if not configured). */
export const DEFAULT_HIRE_STAGE_IDS = ["Outreach", "Responded", "Screened", "Interviewing", "Offered", "LOA Signed", "Confirmed"];

export function getKanbanColumns(project) {
  if (project?.kanban?.columns?.length) {
    return [...project.kanban.columns].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  }
  return DEFAULT_HIRE_STAGE_IDS.map((id) => ({ id, label: id, order: DEFAULT_HIRE_STAGE_IDS.indexOf(id) }));
}

/** Stages that count toward committed labor (default: Confirmed only). */
export function getCommittedStages(project) {
  return project?.kanban?.committedStages?.length ? project.kanban.committedStages : ["Confirmed"];
}
