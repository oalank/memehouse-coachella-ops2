import { GlassCard } from "@/components/GlassCard";
import { StatusPill, type StatusType } from "@/components/StatusPill";

interface Operator {
  name: string;
  tier: string;
  zone: string;
  dayRate: string;
  statuses: StatusType[];
}

const columns: { title: string; color: string; borderColor: string; stage: StatusType; operators: Operator[] }[] = [
  {
    title: "Outreach", color: "text-glow-cyan", borderColor: "border-t-glow-cyan/25", stage: "outreach",
    operators: [
      { name: "Alex Rivera", tier: "T1", zone: "LA", dayRate: "$850", statuses: ["outreach"] },
      { name: "Sam Chen", tier: "T2", zone: "NY", dayRate: "$720", statuses: ["outreach"] },
    ],
  },
  {
    title: "Responded", color: "text-glow-cyan", borderColor: "border-t-glow-cyan/15", stage: "responded",
    operators: [
      { name: "Jordan Lee", tier: "T1", zone: "ATL", dayRate: "$900", statuses: ["responded"] },
    ],
  },
  {
    title: "Screened", color: "text-glow-violet", borderColor: "border-t-glow-violet/25", stage: "screened",
    operators: [
      { name: "Taylor Kim", tier: "T2", zone: "LA", dayRate: "$680", statuses: ["screened"] },
      { name: "Morgan Diaz", tier: "T1", zone: "CHI", dayRate: "$810", statuses: ["screened", "high-risk"] },
    ],
  },
  {
    title: "Interviewing", color: "text-glow-amber", borderColor: "border-t-glow-amber/25", stage: "interviewing",
    operators: [
      { name: "Casey Patel", tier: "T1", zone: "LA", dayRate: "$950", statuses: ["interviewing"] },
    ],
  },
  {
    title: "Offered", color: "text-glow-amber", borderColor: "border-t-glow-amber/15", stage: "offered",
    operators: [
      { name: "Drew Nakamura", tier: "T2", zone: "NY", dayRate: "$750", statuses: ["offered"] },
    ],
  },
  {
    title: "LOA Signed", color: "text-glow-green", borderColor: "border-t-glow-green/15", stage: "loa-signed",
    operators: [
      { name: "Quinn Foster", tier: "T1", zone: "LA", dayRate: "$880", statuses: ["loa-signed"] },
    ],
  },
  {
    title: "Confirmed", color: "text-glow-green", borderColor: "border-t-glow-green/25", stage: "confirmed",
    operators: [
      { name: "Reese Martin", tier: "T1", zone: "ATL", dayRate: "$920", statuses: ["confirmed"] },
      { name: "Avery Thompson", tier: "T2", zone: "LA", dayRate: "$700", statuses: ["confirmed"] },
    ],
  },
];

const KanbanPage = () => {
  return (
    <div className="min-h-screen grid-bg content-glow">
      <div className="px-6 lg:px-10 py-10 animate-fade-in max-w-[1400px]">
        <h1 className="text-2xl font-bold tracking-tight mb-8 text-heading-glow">Hiring Pipeline</h1>
        <div className="flex gap-4 overflow-x-auto pb-6">
          {columns.map((col) => (
            <div key={col.title} className="min-w-[270px] w-[270px] flex-shrink-0">
              <div className={`glass rounded-2xl border-t-2 ${col.borderColor} p-3.5 flex flex-col gap-3`}>
                <div className="flex items-center justify-between px-1 mb-1">
                  <span className={`text-[11px] font-semibold uppercase tracking-widest ${col.color}`}>{col.title}</span>
                  <span className="text-[10px] text-muted-foreground glass-subtle px-2 py-0.5 rounded-full font-medium">{col.operators.length}</span>
                </div>
                {col.operators.map((op) => (
                  <GlassCard key={op.name} hoverable className="!p-4 flex flex-col gap-2.5 !rounded-xl">
                    <span className="text-sm font-semibold">{op.name}</span>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{op.tier}</span>
                      <span className="opacity-25">·</span>
                      <span>{op.zone}</span>
                      <span className="opacity-25">·</span>
                      <span>{op.dayRate}/day</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-0.5">
                      {op.statuses.map((s) => (
                        <StatusPill key={s} status={s} showIcon={false} className="!text-[10px] !px-2.5 !py-0.5" />
                      ))}
                    </div>
                  </GlassCard>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default KanbanPage;
