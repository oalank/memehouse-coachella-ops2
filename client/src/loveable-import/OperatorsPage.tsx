import { useState } from "react";
import { GlassCard } from "@/components/GlassCard";
import { GlassInput } from "@/components/GlassInput";
import { GlassModal } from "@/components/GlassModal";
import { StatusPill, type StatusType } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Plus, Search } from "lucide-react";

const operators = [
  { name: "Reese Martin", tier: "T1", zone: "ATL", dayRate: "$920", stage: "confirmed" as StatusType, risk: null },
  { name: "Avery Thompson", tier: "T2", zone: "LA", dayRate: "$700", stage: "confirmed" as StatusType, risk: null },
  { name: "Casey Patel", tier: "T1", zone: "LA", dayRate: "$950", stage: "interviewing" as StatusType, risk: null },
  { name: "Morgan Diaz", tier: "T1", zone: "CHI", dayRate: "$810", stage: "screened" as StatusType, risk: "high-risk" as StatusType },
  { name: "Drew Nakamura", tier: "T2", zone: "NY", dayRate: "$750", stage: "offered" as StatusType, risk: null },
  { name: "Alex Rivera", tier: "T1", zone: "LA", dayRate: "$850", stage: "outreach" as StatusType, risk: null },
  { name: "Quinn Foster", tier: "T1", zone: "LA", dayRate: "$880", stage: "loa-signed" as StatusType, risk: null },
  { name: "Sam Chen", tier: "T2", zone: "NY", dayRate: "$720", stage: "outreach" as StatusType, risk: null },
];

const OperatorsPage = () => {
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = operators.filter((o) => o.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen grid-bg content-glow">
      <div className="px-6 lg:px-10 py-10 animate-fade-in max-w-[1400px]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-heading-glow">Operators</h1>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search operators..."
                className="pl-9 pr-4 py-2.5 rounded-xl glass text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring/40 w-56 transition-all duration-300"
              />
            </div>
            <Button onClick={() => setAddOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs rounded-xl">
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Operator
            </Button>
          </div>
        </div>

        <GlassCard className="overflow-hidden !p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[hsla(210,20%,93%,0.05)]">
                  {["Name", "Tier", "Zone", "Day Rate", "Stage", "Risk"].map((h) => (
                    <th key={h} className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-widest px-5 py-3.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((op) => (
                  <tr key={op.name} className="border-b border-[hsla(210,20%,93%,0.03)] row-hover-glow cursor-pointer">
                    <td className="px-5 py-4 font-medium">{op.name}</td>
                    <td className="px-5 py-4 text-muted-foreground">{op.tier}</td>
                    <td className="px-5 py-4 text-muted-foreground">{op.zone}</td>
                    <td className="px-5 py-4 text-muted-foreground">{op.dayRate}</td>
                    <td className="px-5 py-4"><StatusPill status={op.stage} /></td>
                    <td className="px-5 py-4">{op.risk ? <StatusPill status={op.risk} /> : <span className="text-muted-foreground/25">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>

      <GlassModal open={addOpen} onOpenChange={setAddOpen} title="Add Operator" description="Add a new operator to the pipeline.">
        <div className="flex flex-col gap-4 pt-2">
          <GlassInput label="Full Name" placeholder="e.g. Jordan Lee" />
          <div className="grid grid-cols-2 gap-4">
            <GlassInput label="Tier" placeholder="T1 / T2" />
            <GlassInput label="Zone" placeholder="e.g. LA" />
          </div>
          <GlassInput label="Day Rate" placeholder="$0.00" />
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="ghost" onClick={() => setAddOpen(false)} className="text-muted-foreground">Cancel</Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Add Operator</Button>
          </div>
        </div>
      </GlassModal>
    </div>
  );
};

export default OperatorsPage;
