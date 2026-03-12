import { GlassCard } from "@/components/GlassCard";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Clock, LogIn, LogOut, FileText } from "lucide-react";

const activeShifts = [
  { name: "Reese Martin", clockedIn: "6:00 AM", elapsed: "4h 32m", zone: "ATL" },
  { name: "Quinn Foster", clockedIn: "7:15 AM", elapsed: "3h 17m", zone: "LA" },
];

const todayShifts = [
  { name: "Avery Thompson", start: "6:00 AM", end: "2:30 PM", hours: "8.5h", status: "completed" as const },
  { name: "Casey Patel", start: "7:00 AM", end: "—", hours: "—", status: "active" as const },
  { name: "Drew Nakamura", start: "9:00 AM", end: "—", hours: "—", status: "active" as const },
  { name: "Morgan Diaz", start: "—", end: "—", hours: "—", status: "archived" as const },
];

const ShiftsPage = () => {
  return (
    <div className="min-h-screen grid-bg content-glow">
      <div className="px-6 lg:px-10 py-10 animate-fade-in max-w-[1400px]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-heading-glow">Shifts & Attendance</h1>
          <div className="flex gap-2">
            <Button variant="outline" className="text-xs rounded-xl glass-subtle border-glow-green/15 text-glow-green hover:bg-glow-green/10">
              <LogIn className="w-3.5 h-3.5 mr-1" /> Clock In
            </Button>
            <Button variant="outline" className="text-xs rounded-xl glass-subtle border-glow-red/15 text-glow-red hover:bg-glow-red/10">
              <LogOut className="w-3.5 h-3.5 mr-1" /> Clock Out
            </Button>
            <Button variant="outline" className="text-xs rounded-xl glass-subtle border-[hsla(210,20%,93%,0.06)] text-muted-foreground hover:text-foreground">
              <FileText className="w-3.5 h-3.5 mr-1" /> Log Shift
            </Button>
          </div>
        </div>

        {/* Active on-clock */}
        <div className="mb-8">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-glow-green" /> Currently On-Clock
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeShifts.map((s) => (
              <GlassCard key={s.name} glowColor="green" className="flex flex-col gap-2.5">
                <span className="font-semibold text-sm">{s.name}</span>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span>In: {s.clockedIn}</span>
                  <span className="opacity-25">·</span>
                  <span>{s.zone}</span>
                </div>
                <span className="text-xl font-bold text-glow-green">{s.elapsed}</span>
              </GlassCard>
            ))}
          </div>
        </div>

        {/* Today's shifts */}
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">Today's Shifts</h2>
        <GlassCard className="overflow-hidden !p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[hsla(210,20%,93%,0.05)]">
                {["Operator", "Start", "End", "Hours", "Status"].map((h) => (
                  <th key={h} className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-widest px-5 py-3.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {todayShifts.map((s) => (
                <tr key={s.name} className="border-b border-[hsla(210,20%,93%,0.03)] row-hover-glow">
                  <td className="px-5 py-4 font-medium">{s.name}</td>
                  <td className="px-5 py-4 text-muted-foreground">{s.start}</td>
                  <td className="px-5 py-4 text-muted-foreground">{s.end}</td>
                  <td className="px-5 py-4 text-muted-foreground">{s.hours}</td>
                  <td className="px-5 py-4"><StatusPill status={s.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      </div>
    </div>
  );
};

export default ShiftsPage;
