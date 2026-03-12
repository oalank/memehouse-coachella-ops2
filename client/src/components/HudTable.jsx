/**
 * Table with HUD styling; optional mobile card render.
 * columns: { key, label, width?, render?(row) }
 * rows: array of objects
 * mobileCardRender(row): if provided and isMobile, render cards instead of table
 */
export default function HudTable({ columns, rows, isMobile, mobileCardRender, emptyMessage = "No data", className = "" }) {
  if (isMobile && mobileCardRender) {
    return (
      <div className={`hud-table-wrap ${className}`.trim()}>
        <div style={{ padding: 14 }}>
          {rows.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--hud-muted)", fontSize: 11 }}>
              {emptyMessage}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {rows.map((row, i) => (
                <div key={row.id ?? i}>{mobileCardRender(row)}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`hud-table-wrap ${className}`.trim()}>
      <div style={{ maxHeight: 440, overflowY: "auto" }}>
        <table className="hud-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} style={col.width ? { width: col.width } : undefined}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ padding: 24, textAlign: "center", color: "var(--hud-muted)", fontSize: 11 }}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={row.id ?? i}>
                  {columns.map((col) => (
                    <td key={col.key}>
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
