import { cn } from "@/lib/utils";
import React from "react";

/** Select with same Lovable glass styling as GlassInput. Use for consistent form controls across modals. */
export const GlassSelect = React.forwardRef(
  ({ label, className, children, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label className="text-[11px] font-semibold text-muted-foreground tracking-wide uppercase">
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={cn(
            "w-full px-4 py-2.5 rounded-xl text-sm",
            "glass text-foreground bg-transparent",
            "focus:outline-none focus:ring-1 focus:ring-primary/40 focus-visible:ring-2 focus-visible:ring-primary/50 focus:border-primary/25",
            "transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed",
            className
          )}
          {...props}
        >
          {children}
        </select>
      </div>
    );
  }
);
GlassSelect.displayName = "GlassSelect";
