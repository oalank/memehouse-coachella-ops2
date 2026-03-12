import { useState, useEffect } from "react";

const BREAKPOINT_MOBILE = 768;

/**
 * Single source of truth for mobile breakpoint. Import this hook; do not re-declare elsewhere.
 * Must be called unconditionally (top level of component) to avoid "rendered more hooks" errors.
 * @param {number} [breakpoint=768]
 * @returns {boolean}
 */
export function useIsMobile(breakpoint = BREAKPOINT_MOBILE) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= breakpoint : false
  );
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return isMobile;
}

export { BREAKPOINT_MOBILE };
