/**
 * Status pill for project lifecycle: active (green), completed (blue), archived (gray).
 * Matches soft pill style used for credential status and pipeline tags.
 */
export default function ProjectStatusBadge({ status }) {
  const s = (status || "active").toLowerCase();
  const label = s === "active" ? "ACTIVE" : s === "completed" ? "COMPLETED" : "ARCHIVED";
  const variant = s === "active" ? "active" : s === "completed" ? "completed" : "archived";
  return (
    <span className={`project-status-badge project-status-badge--${variant}`} aria-label={label}>
      {variant === "active" && <span className="project-status-badge__dot" aria-hidden />}
      {label}
    </span>
  );
}
