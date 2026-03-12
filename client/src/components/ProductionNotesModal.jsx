import { useState, useEffect } from "react";
import { GlassModal } from "./GlassModal";
import { getProjectNotes, setProjectNotes } from "../data/projectNotesStorage";

export default function ProductionNotesModal({ projectId, projectName, onClose }) {
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (projectId) setText(getProjectNotes(projectId));
  }, [projectId]);

  const handleSave = () => {
    if (projectId) {
      setProjectNotes(projectId, text);
      setSaved(true);
    }
  };

  if (!projectId) return null;

  return (
    <GlassModal
      open={true}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title="Production notes"
      description={projectName ? `Notes for ${projectName}` : "Project notes"}
      className="max-w-[520px] max-h-[85vh] flex flex-col"
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleSave}
        placeholder="Add notes for this production…"
        rows={10}
        className="w-full px-4 py-3 rounded-xl text-sm glass text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40 resize-y min-h-[200px]"
      />
      <div className="flex gap-3 justify-end pt-4 border-t border-white/[0.06] mt-4">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 transition-colors"
        >
          {saved ? "Done" : "Cancel"}
        </button>
        <button
          type="button"
          onClick={() => { handleSave(); onClose(); }}
          className="btn-primary-glow px-4 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Save & close
        </button>
      </div>
    </GlassModal>
  );
}
