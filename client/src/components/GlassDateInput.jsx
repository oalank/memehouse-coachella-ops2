import { cn } from "@/lib/utils";
import React, { useRef, useCallback } from "react";
import { Calendar } from "lucide-react";

/**
 * Date field that opens the native calendar picker on click. Whole field and icon are clickable.
 * Uses native type="date" for accessibility and no manual typing required.
 */
function setRef(ref, value) {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}

export const GlassDateInput = React.forwardRef(
  ({ label, className, ...props }, ref) => {
    const inputRef = useRef(null);

    const openPicker = useCallback(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      if (typeof el.showPicker === "function") {
        try {
          el.showPicker();
        } catch (_) {
          /* some browsers restrict showPicker to user gesture; focus is enough */
        }
      }
    }, []);

    const inputRefCallback = useCallback(
      (el) => {
        inputRef.current = el;
        setRef(ref, el);
      },
      [ref]
    );

    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label className="text-[11px] font-semibold text-muted-foreground tracking-wide uppercase">
            {label}
          </label>
        )}
        <div
          onClick={openPicker}
          className={cn(
            "flex items-center gap-2 w-full rounded-xl overflow-hidden",
            "glass border border-white/[0.06]",
            "focus-within:ring-1 focus-within:ring-primary/40 focus-within:border-primary/25",
            "cursor-pointer transition-all duration-300",
            "min-h-[42px]"
          )}
        >
          <input
            ref={inputRefCallback}
            type="date"
            className={cn(
              "flex-1 min-w-0 px-4 py-2.5 rounded-xl text-sm bg-transparent border-none",
              "text-foreground placeholder:text-muted-foreground/40",
              "focus:outline-none focus:ring-0 focus:border-0",
              "cursor-pointer [color-scheme:dark]",
              "[&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer",
              className
            )}
            {...props}
          />
          <span className="flex-shrink-0 pr-3 pointer-events-none text-muted-foreground/70" aria-hidden>
            <Calendar className="w-4 h-4" />
          </span>
        </div>
      </div>
    );
  }
);
GlassDateInput.displayName = "GlassDateInput";
