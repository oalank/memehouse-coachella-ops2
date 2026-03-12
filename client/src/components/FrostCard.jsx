import { useCardLightTrack } from "@/hooks/useCardLightTrack";

/**
 * Frosted-glass card (reference: hero mid-section cards).
 */
export default function FrostCard({ label, title, icon, onClick }) {
  const lightTrack = useCardLightTrack();
  return (
    <button
      type="button"
      ref={lightTrack.ref}
      onMouseMove={lightTrack.onMouseMove}
      onMouseLeave={lightTrack.onMouseLeave}
      className={`frost-card ${lightTrack.className}`}
      onClick={onClick}
    >
      {label && <span className="frost-card__label">{label}</span>}
      <span className="frost-card__icon" aria-hidden>
        {icon}
      </span>
      <span className="frost-card__title">{title}</span>
    </button>
  );
}
