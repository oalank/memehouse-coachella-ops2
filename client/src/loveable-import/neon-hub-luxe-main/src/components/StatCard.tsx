import { cn } from "@/lib/utils";
import { GlassCard } from "./GlassCard";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  note?: string;
  icon: LucideIcon;
  glowColor: "cyan" | "violet" | "green" | "amber" | "pink" | "red" | "blue";
}

const textColorMap = {
  cyan: "text-glow-cyan",
  violet: "text-glow-violet",
  green: "text-glow-green",
  amber: "text-glow-amber",
  pink: "text-glow-pink",
  red: "text-glow-red",
  blue: "text-glow-blue",
};

const iconBgMap = {
  cyan: "bg-glow-cyan/[0.08] border-glow-cyan/15",
  violet: "bg-glow-violet/[0.08] border-glow-violet/15",
  green: "bg-glow-green/[0.08] border-glow-green/15",
  amber: "bg-glow-amber/[0.08] border-glow-amber/15",
  pink: "bg-glow-pink/[0.08] border-glow-pink/15",
  red: "bg-glow-red/[0.08] border-glow-red/15",
  blue: "bg-glow-blue/[0.08] border-glow-blue/15",
};

export const StatCard = ({ label, value, note, icon: Icon, glowColor }: StatCardProps) => {
  return (
    <GlassCard glowColor={glowColor} hoverable className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
        <div className={cn("w-9 h-9 rounded-xl border flex items-center justify-center", iconBgMap[glowColor])}>
          <Icon className={cn("w-4 h-4", textColorMap[glowColor])} />
        </div>
      </div>
      <div className={cn("text-[1.65rem] font-bold tracking-tight leading-none", textColorMap[glowColor])}>{value}</div>
      {note && <span className="text-[11px] text-muted-foreground leading-snug">{note}</span>}
    </GlassCard>
  );
};
