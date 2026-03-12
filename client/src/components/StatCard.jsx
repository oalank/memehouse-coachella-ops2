import { cn } from "@/lib/utils";
import { useCardLightTrack } from "@/hooks/useCardLightTrack";

/**
 * StatCard: label, value, helper/sub, accentColor/accent, optional bars, optional statusLabel (health).
 * Surface: Lovable card token (solid dark), typography and spacing from Lovable.
 * When statusLabel is set, value and bar use accentColor; optional tiny status label shown.
 */
export default function StatCard({ label, value, helper, sub, accentColor, accent, bars = 0, statusLabel }) {
  const color = accentColor || accent || "#6366f1";
  const text = helper ?? sub ?? "";
  const lightTrack = useCardLightTrack();
  return (
    <div
      ref={lightTrack.ref}
      onMouseMove={lightTrack.onMouseMove}
      onMouseLeave={lightTrack.onMouseLeave}
      className={cn(
        "glass-panel rounded-2xl p-6 card-hover-subtle transition-all duration-200 hover:shadow-[0_24px_64px_rgba(0,0,0,0.5)]",
        lightTrack.className
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </div>
        {statusLabel && (
          <span
            className="text-[10px] font-semibold uppercase tracking-wider shrink-0"
            style={{ color, opacity: 0.92 }}
          >
            {statusLabel}
          </span>
        )}
      </div>
      <div
        className="text-2xl font-bold tracking-tight leading-none mb-0.5"
        style={{ color }}
      >
        {value}
      </div>
      {text && (
        <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">
          {text}
        </div>
      )}
      {bars > 0 && (
        <div className="mt-4 h-1.5 rounded-full overflow-hidden flex gap-0.5 bg-black/30">
          {Array.from({ length: Math.min(bars, 5) }).map((_, i) => (
            <span
              key={i}
              className="flex-1 rounded-full transition-opacity duration-300"
              style={{
                backgroundColor: color,
                opacity: 0.35 + (i / Math.min(bars, 5)) * 0.65,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
