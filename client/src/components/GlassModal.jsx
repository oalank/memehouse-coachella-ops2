import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function GlassModal({ open, onOpenChange, title, description, children, className }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "glass-strong rounded-2xl animate-scale-in max-w-lg",
          "border-[hsla(210,20%,93%,0.06)]",
          "shadow-[0_24px_80px_hsla(0,0%,0%,0.6),0_0_40px_hsla(190,95%,55%,0.04)]",
          className
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-bold tracking-tight">{title}</DialogTitle>
          {description && (
            <DialogDescription className="text-muted-foreground text-sm">{description}</DialogDescription>
          )}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
