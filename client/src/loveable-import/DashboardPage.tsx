import { StatCard } from "@/components/StatCard";
import { StatusPill } from "@/components/StatusPill";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/ui/button";
import {
  DollarSign, Users, TrendingDown, Clock, Flame, CalendarDays, ArrowLeftRight,
  Archive, RefreshCw
} from "lucide-react";

const DashboardPage = () => {
  return (
    <div className="min-h-screen grid-bg content-glow">
      <div className="px-6 lg:px-10 py-10 animate-fade-in max-w-[1400px]">
        {/* Project Header */}
        <GlassCard className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold tracking-tight text-heading-glow">Summer Music Video</h1>
                <StatusPill status="active" />
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> Mar 1 – Apr 15, 2026</span>
                <span className="hidden sm:inline opacity-25">·</span>
                <span className="hidden sm:inline">Client: Universal Music</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="text-xs rounded-xl glass-subtle border-[hsla(210,20%,93%,0.06)] text-muted-foreground hover:text-foreground">
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Switch Project
              </Button>
              <Button variant="outline" className="text-xs rounded-xl glass-subtle border-destructive/15 text-destructive hover:bg-destructive/10">
                <Archive className="w-3.5 h-3.5 mr-1" /> End Project
              </Button>
            </div>
          </div>
        </GlassCard>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard label="Budget Cap" value="$285,000" note="Total approved budget" icon={DollarSign} glowColor="cyan" />
          <StatCard label="Actual Labor" value="$142,800" note="50.1% of budget used" icon={Users} glowColor="violet" />
          <StatCard label="Committed Labor" value="$68,200" note="Signed, not yet paid" icon={TrendingDown} glowColor="amber" />
          <StatCard label="Remaining" value="$74,000" note="25.9% remaining" icon={DollarSign} glowColor="green" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard label="OT Spend" value="$18,400" note="12.9% of actual labor" icon={Clock} glowColor="pink" />
          <StatCard label="Daily Burn" value="$9,520" note="Avg. over last 7 days" icon={Flame} glowColor="red" />
          <StatCard label="Runway" value="7.8 days" note="At current burn rate" icon={ArrowLeftRight} glowColor="blue" />
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
