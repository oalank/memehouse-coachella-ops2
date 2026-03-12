import { cn } from "@/lib/utils";
import React from "react";

export const GlassInput = React.forwardRef(
  ({ label, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label className="text-[11px] font-semibold text-muted-foreground tracking-wide uppercase">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={cn(
            "w-full px-4 py-2.5 rounded-xl text-sm",
            "glass text-foreground placeholder:text-muted-foreground/40",
            "focus:outline-none focus:ring-1 focus:ring-primary/40 focus-visible:ring-2 focus-visible:ring-primary/50 focus:border-primary/25",
            "transition-all duration-300",
            className
          )}
          {...props}
        />
      </div>
    );
  }
);
GlassInput.displayName = "GlassInput";
