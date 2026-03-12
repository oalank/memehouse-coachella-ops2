import { cn } from "@/lib/utils";
import { useCardLightTrack } from "@/hooks/useCardLightTrack";

/**
 * Standard panel: Lovable card surface (solid dark), rounded-2xl, section header.
 * Same API: children, header, noPadding, className, style.
 * Uses --card token; border and typography from Lovable.
 */
export default function HudCard({ children, className = "", style = {}, header, noPadding }) {
  const lightTrack = useCardLightTrack();
  return (
    <div
      ref={lightTrack.ref}
      onMouseMove={lightTrack.onMouseMove}
      onMouseLeave={lightTrack.onMouseLeave}
      className={cn("glass-panel rounded-2xl overflow-hidden transition-all duration-300", lightTrack.className, className)}
      style={style}
    >
      {header && (
        <div className="px-6 py-3.5 border-b border-[hsla(210,20%,93%,0.06)] text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          {header}
        </div>
      )}
      <div className={noPadding ? "" : "p-6"}>{children}</div>
    </div>
  );
}
