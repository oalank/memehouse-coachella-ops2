/**
 * Shared full-viewport page container: full height, full width with gutters, no horizontal overflow.
 * Use for Executive, Operators, Credentials, Shifts so every page fills the viewport like a production dashboard.
 */
export default function PageShell({ children, className = "" }) {
  return (
    <div className={`page-shell ${className}`.trim()}>
      {children}
    </div>
  );
}
