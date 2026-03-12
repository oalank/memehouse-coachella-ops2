import { useState } from "react";
import { GlassCard } from "@/components/GlassCard";
import { StatusPill, type StatusType } from "@/components/StatusPill";

const filters: StatusType[] = ["submitted", "active", "denied", "archived"];

const credentials = [
  { name: "Reese Martin", type: "Background Check", submitted: "Mar 3", status: "active" as StatusType },
  { name: "Casey Patel", type: "Drug Screen", submitted: "Mar 5", status: "submitted" as StatusType },
  { name: "Quinn Foster", type: "I-9 Verification", submitted: "Mar 4", status: "active" as StatusType },
  { name: "Drew Nakamura", type: "Background Check", submitted: "Mar 6", status: "submitted" as StatusType },
  { name: "Morgan Diaz", type: "Drug Screen", submitted: "Mar 2", status: "denied" as StatusType },
  { name: "Avery Thompson", type: "Background Check", submitted: "Mar 1", status: "active" as StatusType },
  { name: "Sam Chen", type: "I-9 Verification", submitted: "Feb 28", status: "archived" as StatusType },
];

const CredentialsPage = () => {
  const [activeFilter, setActiveFilter] = useState<StatusType | "all">("all");

  const filtered = activeFilter === "all" ? credentials : credentials.filter((c) => c.status === activeFilter);

  return (
    <div className="min-h-screen grid-bg content-glow">
      <div className="px-6 lg:px-10 py-10 animate-fade-in max-w-[1400px]">
        <h1 className="text-2xl font-bold tracking-tight mb-8 text-heading-glow">Credentials</h1>

        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => setActiveFilter("all")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-300 border ${
              activeFilter === "all"
                ? "glass text-primary border-primary/20 pill-glow-amber"
                : "glass-subtle text-muted-foreground border-transparent hover:text-foreground"
            }`}
          >
            All
          </button>
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-300 border ${
                activeFilter === f
                  ? "glass text-primary border-primary/20 pill-glow-amber"
                  : "glass-subtle text-muted-foreground border-transparent hover:text-foreground"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <GlassCard className="overflow-hidden !p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[hsla(210,20%,93%,0.05)]">
                {["Operator", "Type", "Submitted", "Status"].map((h) => (
                  <th key={h} className="text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-widest px-5 py-3.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => (
                <tr key={i} className="border-b border-[hsla(210,20%,93%,0.03)] row-hover-glow">
                  <td className="px-5 py-4 font-medium">{c.name}</td>
                  <td className="px-5 py-4 text-muted-foreground">{c.type}</td>
                  <td className="px-5 py-4 text-muted-foreground">{c.submitted}</td>
                  <td className="px-5 py-4"><StatusPill status={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      </div>
    </div>
  );
};

export default CredentialsPage;
