/**
 * Demo/seed data for local testing. Uses existing projectStorage and expenseStorage.
 * Run seedDemo() to load; resetDemo() to remove demo projects and their expenses.
 * Server operators/shifts must be seeded separately via: npm run seed (scripts/seed-demo.js).
 */

import {
  replaceCustomProjectsForDemo,
  removeDemoIdsFromDeleted,
  removeProjectsFromCustom,
} from "./projectStorage";
import { setExpensesForProject, removeAllExpensesForProject } from "./expenseStorage";

export const DEMO_PROJECT_IDS = ["demo-festival-2026", "demo-creator-2026", "demo-archived-2025"];

const now = () => new Date().toISOString();
const DEFAULT_KANBAN = {
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
};

/** 1 active festival, 1 active creator, 1 archived. Row shape for projectStorage custom list. */
export const DEMO_PROJECT_ROWS = [
  {
    id: "demo-festival-2026",
    name: "Sunset Fest 2026",
    startDate: "2026-04-10",
    endDate: "2026-04-19",
    eventStartISO: "2026-04-10",
    eventEndISO: "2026-04-19",
    location: "Empire Polo Club, Indio CA",
    clientName: "Sunset Productions",
    budget: { laborCap: 85000 },
    credentialsRequired: true,
    kanban: DEFAULT_KANBAN,
    zones: ["House 1", "House 2", "House 3", "House 4", "House 5", "House 6", "Festival", "Floater"],
    status: "active",
    createdAt: now(),
    updatedAt: now(),
    breakPolicy: { enabled: true, mealBreakRequiredAfterHours: 6, mealBreakDurationMinutes: 30 },
    streamReportLink: "https://stream.demo/sunset-2026",
    gearCheckoutLink: "https://gear.demo/sunset-2026",
  },
  {
    id: "demo-creator-2026",
    name: "Creator House — Spring Run",
    startDate: "2026-03-01",
    endDate: "2026-03-14",
    eventStartISO: "2026-03-01",
    eventEndISO: "2026-03-14",
    location: "LA Studio",
    clientName: "Creator Co",
    budget: { laborCap: 22000 },
    credentialsRequired: false,
    kanban: DEFAULT_KANBAN,
    zones: ["House 1", "House 2", "Floater"],
    status: "active",
    createdAt: now(),
    updatedAt: now(),
    breakPolicy: { enabled: true, mealBreakRequiredAfterHours: 5, mealBreakDurationMinutes: 30 },
    streamReportLink: "",
    gearCheckoutLink: "",
  },
  {
    id: "demo-archived-2025",
    name: "Holiday Special 2025",
    startDate: "2025-12-01",
    endDate: "2025-12-07",
    eventStartISO: "2025-12-01",
    eventEndISO: "2025-12-07",
    location: "Brooklyn",
    clientName: "Holiday Media",
    budget: { laborCap: 45000 },
    credentialsRequired: true,
    kanban: DEFAULT_KANBAN,
    zones: ["House 1", "House 2", "House 3", "Floater"],
    status: "archived",
    createdAt: now(),
    updatedAt: now(),
    breakPolicy: { enabled: true, mealBreakRequiredAfterHours: 6, mealBreakDurationMinutes: 30 },
    streamReportLink: "",
    gearCheckoutLink: "",
  },
];

/** Expenses per project (active projects only for meaningful Executive metrics). */
export const DEMO_EXPENSES = {
  "demo-festival-2026": [
    { category: "Meals", description: "Crew catering Day 1-2", amount: 1240, date: "2026-04-10", submittedBy: "Prod" },
    { category: "Transportation", description: "Van rental", amount: 680, date: "2026-04-09", submittedBy: "Ops" },
    { category: "Rentals", description: "Extra camera package", amount: 1200, date: "2026-04-08", submittedBy: "DP" },
    { category: "Reimbursements", description: "Mileage — J. Smith", amount: 95, date: "2026-04-11", submittedBy: "J. Smith" },
    { category: "Gear Purchases", description: "Batteries & media", amount: 340, date: "2026-04-10", submittedBy: "Gear" },
    { category: "Misc Production", description: "Parking passes", amount: 220, date: "2026-04-10", submittedBy: "Prod" },
  ],
  "demo-creator-2026": [
    { category: "Meals", description: "Lunch run", amount: 180, date: "2026-03-05", submittedBy: "PA" },
    { category: "Misc Production", description: "Supplies", amount: 75, date: "2026-03-03", submittedBy: "Prod" },
  ],
};

/**
 * Load demo projects and expenses into localStorage. Removes demo ids from deleted list so they appear.
 * Does not seed operators/shifts — run `npm run seed` in project root for that.
 */
export function seedDemo() {
  removeDemoIdsFromDeleted(DEMO_PROJECT_IDS);
  replaceCustomProjectsForDemo(DEMO_PROJECT_ROWS);
  Object.entries(DEMO_EXPENSES).forEach(([projectId, list]) => {
    setExpensesForProject(projectId, list);
  });
}

/**
 * Remove demo projects from custom list and clear their expenses. Removes demo ids from deleted set.
 * Other custom projects (if any) are left intact.
 */
export function resetDemo() {
  removeDemoIdsFromDeleted(DEMO_PROJECT_IDS);
  removeProjectsFromCustom(DEMO_PROJECT_IDS);
  DEMO_PROJECT_IDS.forEach((id) => removeAllExpensesForProject(id));
}
