/**
 * Date helpers: midnight-based math to avoid off-by-one.
 * All dates are interpreted in local time.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Parse "YYYY-MM-DD" or ISO string to local midnight Date.
 * @param {string} dateString
 * @returns {Date | null}
 */
function toMidnight(dateString) {
  if (!dateString || typeof dateString !== "string") return null;
  const s = dateString.slice(0, 10);
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/**
 * Days until target date (midnight-based). Can be negative if target is in the past.
 * @param {string} dateString - "YYYY-MM-DD" or full ISO
 * @returns {number}
 */
export function daysUntil(dateString) {
  const target = toMidnight(dateString);
  if (!target) return 0;
  const now = new Date();
  const nowMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetMid = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.ceil((targetMid - nowMid) / MS_PER_DAY);
}

/**
 * @param {string} dateString
 * @returns {boolean} true if startDate <= today (event has started)
 */
export function isLive(dateString) {
  return daysUntil(dateString) <= 0;
}

/**
 * Format date string for display (YYYY-MM-DD).
 * @param {string} dateString
 * @returns {string}
 */
export function formatDate(dateString) {
  if (!dateString || typeof dateString !== "string") return "—";
  return dateString.slice(0, 10);
}

/**
 * Short format for availability/deployment (e.g. "Apr 14").
 * @param {string} dateString - "YYYY-MM-DD" or ISO
 * @returns {string}
 */
export function formatDateShort(dateString) {
  if (!dateString || typeof dateString !== "string") return "—";
  const s = dateString.slice(0, 10);
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return "—";
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Sprint label for header/cards: "YYYY-MM-DD • N DAYS SPRINT" or "YYYY-MM-DD • LIVE" / "STARTED".
 * @param {string} dateString
 * @returns {string}
 */
export function getSprintLabel(dateString) {
  const formatted = formatDate(dateString);
  const n = daysUntil(dateString);
  if (n < 0) return `${formatted} • LIVE`;
  if (n === 0) return `${formatted} • STARTED`;
  if (n === 1) return `${formatted} • 1 DAY SPRINT`;
  return `${formatted} • ${n} DAYS SPRINT`;
}
