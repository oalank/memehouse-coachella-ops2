import { cn } from "@/lib/utils";

/**
 * Status pill: Lovable-style pill (spacing, typography, glow). Same API: label, color, small.
 */
export default function HudBadge({ label, color, small, className = "" }) {
  const hasColor = !!color;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-semibold tracking-wide",
        "backdrop-blur-2xl transition-all duration-300",
        hasColor ? "border-current" : "border-white/10 bg-white/5 text-muted-foreground",
        small ? "px-2.5 py-0.5 text-[10px]" : "px-3.5 py-1.5 text-[11px]",
        className
      )}
      style={
        hasColor
          ? {
              color,
              backgroundColor: `${color}14`,
              borderColor: `${color}40`,
              boxShadow: `0 0 14px ${color}40, 0 0 4px ${color}25, inset 0 0 10px ${color}15`,
            }
          : undefined
      }
    >
      {label}
    </span>
  );
}
