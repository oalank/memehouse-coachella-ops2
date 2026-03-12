/**
 * Page header: Lovable-style // micro-label, title, optional subtitle, optional actions (right).
 */
export default function PageHeader({ label, title, subtitle, actions, className = "" }) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-4 mb-8 ${className}`.trim()}>
      <div>
        {label && (
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-1">
            // {label}
          </div>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-heading-glow">{title}</h1>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground mt-1">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap gap-3 items-center">
          {actions}
        </div>
      )}
    </div>
  );
}
