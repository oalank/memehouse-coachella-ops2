import { useCallback, useRef } from "react";

const MAX_TILT_DEG = 3;

/**
 * Hook for cursor-following hover glow and subtle 3D tilt on cards/panels.
 * Updates --mouse-x, --mouse-y, --tilt-x, --tilt-y via direct style (no re-renders).
 * Attach ref, onMouseMove, onMouseLeave, and className "card-light-track" to the card element.
 */
export function useCardLightTrack() {
  const ref = useRef(null);

  const onMouseMove = useCallback((e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    el.style.setProperty("--mouse-x", `${x}%`);
    el.style.setProperty("--mouse-y", `${y}%`);
    const tiltY = ((x - 50) / 50) * MAX_TILT_DEG;
    const tiltX = ((50 - y) / 50) * MAX_TILT_DEG;
    el.style.setProperty("--tilt-x", `${tiltX}deg`);
    el.style.setProperty("--tilt-y", `${tiltY}deg`);
  }, []);

  const onMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--tilt-x", "0deg");
    el.style.setProperty("--tilt-y", "0deg");
  }, []);

  return { ref, onMouseMove, onMouseLeave, className: "card-light-track" };
}
