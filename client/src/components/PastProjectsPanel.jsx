import { formatDate } from "../utils/dates";
import { isCustomProject } from "../data/projectStorage";
import { StatusPill } from "./StatusPill";

export default function PastProjectsPanel({ projects: past = [], onOpenProject, onArchivePermanently, onDeletePermanently }) {
  const status = (s) => (s === "completed" || s === "archived" ? s : "completed");

  return (
    <div className="p-6">
      {past.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-10">No archived projects.</p>
      ) : (
        <ul className="space-y-2">
          {past.map((p) => (
            <li key={p.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onOpenProject(p.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenProject(p.id); } }}
                className="flex items-center justify-between gap-4 py-3 px-4 rounded-xl glass-subtle hover:bg-white/[0.03] cursor-pointer transition-all duration-150 border border-transparent hover:border-white/[0.04]"
              >
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <span className="font-medium text-foreground truncate">{p.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(p.eventStartISO || p.startDate)} – {formatDate(p.eventEndISO || p.endDate)}
                  </span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <StatusPill status={status(p.status)} showIcon={false} className="!text-[10px] !px-2.5 !py-0.5" />
                  {onArchivePermanently && p.status === "completed" && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onArchivePermanently(p.id); }}
                      title="Move to archive permanently"
                      className="px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-amber-500/40 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 transition-colors"
                    >
                      Archive Permanently
                    </button>
                  )}
                  {onDeletePermanently && isCustomProject(p.id) && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onDeletePermanently(p.id); }}
                      title="Delete this project permanently"
                      className="px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-destructive/50 text-destructive bg-destructive/10 hover:bg-destructive/20 transition-colors"
                    >
                      Delete permanently
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
