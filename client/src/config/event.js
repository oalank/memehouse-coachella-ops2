/**
 * Single source of truth for event start date (fallback when API event not yet loaded).
 * Coachella 2026 start.
 */
export const EVENT_START_ISO = "2026-04-10";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Returns whole days remaining until the given date (start-of-day local).
 * Clamps at 0 once the event has started.
 * @param {string} dateISO - "YYYY-MM-DD" or full ISO string
 * @returns {number}
 */
export function getDaysUntil(dateISO) {
  if (!dateISO || typeof dateISO !== "string") return 0;
  const s = dateISO.slice(0, 10);
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const eventDate = new Date(y, m - 1, d);
  eventDate.setHours(0, 0, 0, 0);
  const diffMs = eventDate - today;
  const diffDays = Math.floor(diffMs / MS_PER_DAY);
  return Math.max(0, diffDays);
}
