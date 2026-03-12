/**
 * Segmented pill with sliding knob (reference: GreenMotive screenshot).
 */
export default function SegmentedPill({ options, value, onChange }) {
  const index = options.findIndex((o) => o.id === value);
  const activeIndex = index >= 0 ? index : 0;

  return (
    <div className="segmented-pill" role="tablist">
      <div
        className="segmented-pill__knob"
        style={{
          width: `${100 / options.length}%`,
          transform: `translateX(${activeIndex * 100}%)`,
        }}
        aria-hidden
      />
      {options.map((opt, i) => (
        <button
          key={opt.id}
          type="button"
          role="tab"
          aria-selected={value === opt.id}
          className={`segmented-pill__tab ${value === opt.id ? "segmented-pill__tab--active" : ""}`}
          onClick={() => onChange(opt.id)}
        >
          {opt.icon && <span className="segmented-pill__icon">{opt.icon}</span>}
          {opt.label}
        </button>
      ))}
    </div>
  );
}
