import { cn } from "@/lib/utils";
import { useCardLightTrack } from "@/hooks/useCardLightTrack";

/**
 * Wrapper that adds cursor-following hover glow to any card/panel.
 * Use for elements that are not GlassCard/StatCard/HudCard (e.g. launcher overview panels).
 */
export default function CardLightTrack({ children, className, ...rest }) {
  const lightTrack = useCardLightTrack();
  return (
    <div
      ref={lightTrack.ref}
      onMouseMove={lightTrack.onMouseMove}
      onMouseLeave={lightTrack.onMouseLeave}
      className={cn("card-light-track", className)}
      {...rest}
    >
      {children}
    </div>
  );
}
