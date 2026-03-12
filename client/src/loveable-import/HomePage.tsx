import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GlassCard } from "@/components/GlassCard";
import { GlassModal } from "@/components/GlassModal";
import { GlassInput } from "@/components/GlassInput";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/StatusPill";
import {
  Plus,
  FolderOpen,
  Archive,
  Zap,
  Target,
  Sparkles,
  TrendingUp,
  Clock,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

const HomePage = () => {
  const [addOpen, setAddOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen grid-bg content-glow">
      <div className="px-6 lg:px-10 py-10 animate-fade-in max-w-[1400px]">
        {/* Hero */}
        <div className="max-w-2xl mb-14">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4 leading-[1.1]">
            Production<br />
            <span className="text-heading-glow">Command Center</span>
          </h1>
          <p className="text-muted-foreground text-base leading-relaxed max-w-lg">
            Manage crews, budgets, credentials, and schedules across all your productions from one premium ops hub.
          </p>
        </div>

        {/* Feature badges */}
        <div className="flex flex-wrap gap-3 mb-10">
          {[
            { icon: Zap, label: "Real-time Tracking" },
            { icon: Target, label: "Budget Precision" },
            { icon: Sparkles, label: "Smart Scheduling" },
          ].map(({ icon: Icon, label }) => (
            <span key={label} className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-xs font-medium text-muted-foreground pill-glow-amber">
              <Icon className="w-3.5 h-3.5 text-primary" />
              {label}
            </span>
          ))}
        </div>

        {/* 3 Dashboard Panels */}
        <div className="grid lg:grid-cols-3 gap-6 mb-10">
          {/* Overview Panel */}
          <div className="glass-panel p-6 card-lift hover-glow-amber">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold text-foreground">Overview</h2>
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Active Projects</span>
                <span className="text-sm font-bold text-foreground">4</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Total Budget</span>
                <span className="text-sm font-bold text-primary">$1.2M</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Active Crew</span>
                <span className="text-sm font-bold text-foreground">32</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Utilization</span>
                <span className="text-sm font-bold text-glow-green">87%</span>
              </div>
            </div>
          </div>

          {/* Active Projects Panel */}
          <div className="glass-panel p-6 card-lift hover-glow-cyan">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold text-foreground">Active Projects</h2>
              <div className="w-8 h-8 rounded-lg bg-glow-cyan/10 flex items-center justify-center">
                <FolderOpen className="w-4 h-4 text-glow-cyan" />
              </div>
            </div>
            <div className="space-y-3">
              {[
                { name: "Summer Music Video", status: "active" as const, budget: "$285K" },
                { name: "Brand Campaign Q2", status: "active" as const, budget: "$420K" },
                { name: "Documentary Pilot", status: "active" as const, budget: "$180K" },
              ].map((p) => (
                <div key={p.name} className="flex items-center justify-between py-2 border-b border-[hsla(210,20%,93%,0.04)] last:border-0">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium text-foreground">{p.name}</span>
                    <span className="text-[10px] text-muted-foreground">{p.budget}</span>
                  </div>
                  <StatusPill status={p.status} />
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity Panel */}
          <div className="glass-panel p-6 card-lift hover-glow-violet">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold text-foreground">Recent Activity</h2>
              <div className="w-8 h-8 rounded-lg bg-glow-violet/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-glow-violet" />
              </div>
            </div>
            <div className="space-y-3">
              {[
                { action: "Reese Martin clocked in", time: "2m ago", icon: CheckCircle2, color: "text-glow-green" },
                { action: "Budget updated – SMV", time: "15m ago", icon: TrendingUp, color: "text-primary" },
                { action: "Casey Patel – LOA signed", time: "1h ago", icon: CheckCircle2, color: "text-glow-cyan" },
                { action: "New credential submitted", time: "3h ago", icon: Zap, color: "text-glow-violet" },
              ].map((a, i) => (
                <div key={i} className="flex items-center gap-3 py-1.5">
                  <a.icon className={`w-3.5 h-3.5 flex-shrink-0 ${a.color}`} />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-foreground block truncate">{a.action}</span>
                    <span className="text-[10px] text-muted-foreground">{a.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick action cards */}
        <div className="grid md:grid-cols-3 gap-6">
          <GlassCard glowColor="amber" hoverable onClick={() => setAddOpen(true)} className="flex flex-col gap-5 min-h-[220px]">
            <div className="w-11 h-11 rounded-xl bg-glow-amber/[0.08] border border-glow-amber/15 flex items-center justify-center">
              <Plus className="w-5 h-5 text-glow-amber" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold mb-1.5">Add Project</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Launch a new production with budget, crew, and timeline setup.
              </p>
            </div>
            <span className="text-xs font-semibold text-glow-amber flex items-center gap-1">
              Get Started <ArrowRight className="w-3 h-3" />
            </span>
          </GlassCard>

          <GlassCard glowColor="cyan" hoverable onClick={() => navigate("/dashboard")} className="flex flex-col gap-5 min-h-[220px]">
            <div className="w-11 h-11 rounded-xl bg-glow-cyan/[0.08] border border-glow-cyan/15 flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-glow-cyan" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold mb-1.5">Current Projects</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                View and manage active productions, crews, and budgets.
              </p>
            </div>
            <span className="text-xs font-semibold text-glow-cyan flex items-center gap-1">
              View Projects <ArrowRight className="w-3 h-3" />
            </span>
          </GlassCard>

          <GlassCard glowColor="gray" hoverable className="flex flex-col gap-5 min-h-[220px]">
            <div className="w-11 h-11 rounded-xl bg-glow-gray/[0.08] border border-glow-gray/15 flex items-center justify-center">
              <Archive className="w-5 h-5 text-glow-gray" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold mb-1.5">Archived Projects</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Access completed and archived productions for reference.
              </p>
            </div>
            <span className="text-xs font-semibold text-glow-gray flex items-center gap-1">
              Browse Archive <ArrowRight className="w-3 h-3" />
            </span>
          </GlassCard>
        </div>
      </div>

      <GlassModal open={addOpen} onOpenChange={setAddOpen} title="New Project" description="Set up a new production project.">
        <div className="flex flex-col gap-4 pt-2">
          <GlassInput label="Project Name" placeholder="e.g. Summer Music Video" />
          <GlassInput label="Client" placeholder="e.g. Universal Music" />
          <div className="grid grid-cols-2 gap-4">
            <GlassInput label="Start Date" type="date" />
            <GlassInput label="End Date" type="date" />
          </div>
          <GlassInput label="Budget Cap" placeholder="$0.00" />
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="ghost" onClick={() => setAddOpen(false)} className="text-muted-foreground">Cancel</Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Create Project</Button>
          </div>
        </div>
      </GlassModal>
    </div>
  );
};

export default HomePage;
