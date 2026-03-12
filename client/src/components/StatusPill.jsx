import { cn } from "@/lib/utils";
import {
  Circle,
  CheckCircle,
  Clock,
  AlertCircle,
  Archive,
  XCircle,
  Pause,
  Send,
  Eye,
  FileCheck,
  Ban,
  Zap,
} from "lucide-react";

const statusConfig = {
  active: { label: "Active", pillGlow: "pill-glow-green", borderColor: "border-glow-green/25", textColor: "text-glow-green", bgColor: "bg-glow-green/[0.08]", icon: Zap },
  confirmed: { label: "Confirmed", pillGlow: "pill-glow-green", borderColor: "border-glow-green/25", textColor: "text-glow-green", bgColor: "bg-glow-green/[0.08]", icon: CheckCircle },
  interviewing: { label: "Interviewing", pillGlow: "pill-glow-amber", borderColor: "border-glow-amber/25", textColor: "text-glow-amber", bgColor: "bg-glow-amber/[0.08]", icon: Clock },
  offered: { label: "Offered", pillGlow: "pill-glow-amber", borderColor: "border-glow-amber/25", textColor: "text-glow-amber", bgColor: "bg-glow-amber/[0.08]", icon: Send },
  responded: { label: "Responded", pillGlow: "pill-glow-cyan", borderColor: "border-glow-cyan/25", textColor: "text-glow-cyan", bgColor: "bg-glow-cyan/[0.08]", icon: Circle },
  screened: { label: "Screened", pillGlow: "pill-glow-violet", borderColor: "border-glow-violet/25", textColor: "text-glow-violet", bgColor: "bg-glow-violet/[0.08]", icon: Eye },
  submitted: { label: "Submitted", pillGlow: "pill-glow-blue", borderColor: "border-glow-blue/25", textColor: "text-glow-blue", bgColor: "bg-glow-blue/[0.08]", icon: FileCheck },
  denied: { label: "Denied", pillGlow: "pill-glow-red", borderColor: "border-glow-red/25", textColor: "text-glow-red", bgColor: "bg-glow-red/[0.08]", icon: XCircle },
  "high-risk": { label: "High Risk", pillGlow: "pill-glow-pink", borderColor: "border-glow-pink/25", textColor: "text-glow-pink", bgColor: "bg-glow-pink/[0.08]", icon: AlertCircle },
  archived: { label: "Archived", pillGlow: "pill-glow-gray", borderColor: "border-glow-gray/25", textColor: "text-glow-gray", bgColor: "bg-glow-gray/[0.08]", icon: Archive },
  completed: { label: "Completed", pillGlow: "pill-glow-blue", borderColor: "border-glow-blue/25", textColor: "text-glow-blue", bgColor: "bg-glow-blue/[0.08]", icon: CheckCircle },
  "on-hold": { label: "On Hold", pillGlow: "pill-glow-blue", borderColor: "border-glow-blue/25", textColor: "text-glow-blue", bgColor: "bg-glow-blue/[0.08]", icon: Pause },
  blocked: { label: "Blocked", pillGlow: "pill-glow-red", borderColor: "border-glow-red/25", textColor: "text-glow-red", bgColor: "bg-glow-red/[0.08]", icon: Ban },
  outreach: { label: "Outreach", pillGlow: "pill-glow-cyan", borderColor: "border-glow-cyan/25", textColor: "text-glow-cyan", bgColor: "bg-glow-cyan/[0.08]", icon: Send },
  "loa-signed": { label: "LOA Signed", pillGlow: "pill-glow-green", borderColor: "border-glow-green/25", textColor: "text-glow-green", bgColor: "bg-glow-green/[0.08]", icon: FileCheck },
};

export function StatusPill({ status, showIcon = true, className }) {
  const config = statusConfig[status];
  if (!config) return null;
  const Icon = config.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-semibold tracking-wide",
        "backdrop-blur-2xl border transition-all duration-300",
        config.pillGlow,
        config.borderColor,
        config.textColor,
        config.bgColor,
        className
      )}
    >
      {showIcon && <Icon className="w-3 h-3" />}
      {config.label}
    </span>
  );
}
