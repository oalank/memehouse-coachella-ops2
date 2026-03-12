/**
 * Layout wrapper: HUD background (grid + vignette) and optional centered container.
 * Children: header, access bar, main. Does not constrain width of header; use hud-container inside main content.
 */
export default function AppShell({ children, className = "" }) {
  return (
    <div className={`hud-shell ${className}`.trim()}>
      {children}
    </div>
  );
}
