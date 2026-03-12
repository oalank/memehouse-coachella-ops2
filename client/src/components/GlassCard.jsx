import { cn } from "@/lib/utils";
import { useCardLightTrack } from "@/hooks/useCardLightTrack";

const glowMap = {
  cyan: "glow-cyan hover-glow-cyan",
  violet: "glow-violet hover-glow-violet",
  green: "glow-green hover-glow-green",
  amber: "glow-amber hover-glow-amber",
  pink: "glow-pink hover-glow-pink",
  red: "glow-red hover-glow-red",
  blue: "glow-blue hover-glow-blue",
  gray: "glow-gray hover-glow-gray",
};

const borderTopMap = {
  cyan: "border-t border-t-glow-cyan/20",
  violet: "border-t border-t-glow-violet/20",
  green: "border-t border-t-glow-green/20",
  amber: "border-t border-t-glow-amber/20",
  pink: "border-t border-t-glow-pink/20",
  red: "border-t border-t-glow-red/20",
  blue: "border-t border-t-glow-blue/20",
  gray: "",
};

export function GlassCard({ children, className, glowColor, hoverable = false, onClick }) {
  const lightTrack = useCardLightTrack();
  return (
    <div
      ref={lightTrack.ref}
      onMouseMove={lightTrack.onMouseMove}
      onMouseLeave={lightTrack.onMouseLeave}
      onClick={onClick}
      className={cn(
        "glass rounded-2xl p-6 transition-all duration-300",
        lightTrack.className,
        glowColor && glowMap[glowColor],
        glowColor && borderTopMap[glowColor],
        hoverable && "card-hover-subtle cursor-pointer",
        onClick && !hoverable && "cursor-pointer",
        className
      )}
    >
      {children}
    </div>
  );
}
