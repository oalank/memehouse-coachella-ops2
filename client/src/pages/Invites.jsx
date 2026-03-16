import { useState, useEffect } from "react";
import { useAuth } from "../state/authStore";
import { Navigate, Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import PageShell from "../components/PageShell";
import { GlassCard } from "../components/GlassCard";
import { GlassInput } from "../components/GlassInput";
import { GlassSelect } from "../components/GlassSelect";
import { UserPlus, Copy, Check } from "lucide-react";
import { apiFetch, API_BASE } from "../apiClient";

export default function Invites() {
  const { user } = useAuth();
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("camera_operator");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [lastSetupLink, setLastSetupLink] = useState("");
  const [copied, setCopied] = useState(false);

  if (user && user.role !== "admin") {
    return <Navigate to="/projects" replace />;
  }

  useEffect(() => {
    apiFetch("/api/invites")
      .then(setInvites)
      .catch(() => setInvites([]))
      .finally(() => setLoading(false));
  }, []);

  const loadInvites = () => {
    apiFetch("/api/invites").then(setInvites).catch(() => setInvites([]));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    setCreating(true);
    setLastSetupLink("");
    try {
      const url = API_BASE ? `${API_BASE}/api/invites` : "/api/invites";
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to create invite");
      setEmail("");
      if (data.setupLink) setLastSetupLink(data.setupLink);
      loadInvites();
    } catch (err) {
      setError(err.message || "Failed to create invite");
    } finally {
      setCreating(false);
    }
  };

  const copyLink = () => {
    if (!lastSetupLink) return;
    navigator.clipboard.writeText(lastSetupLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const formatDate = (d) => {
    if (!d) return "—";
    const dt = new Date(d);
    return dt.toLocaleDateString(undefined, { dateStyle: "short" }) + " " + dt.toLocaleTimeString(undefined, { timeStyle: "short" });
  };

  return (
    <PageShell>
      <p className="mb-4">
        <Link to="/projects" className="text-xs text-muted-foreground hover:text-primary transition-colors">← Projects</Link>
      </p>
      <PageHeader
        title="Invites"
        subtitle="Invite-only access. Create a setup link and share it with the invitee; they set their password from the link."
      />
      <div className="space-y-6 max-w-2xl">
        <GlassCard className="p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> Create invite
          </h2>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <GlassInput
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="invitee@company.com"
              required
              disabled={creating}
            />
            <GlassSelect
              label="Role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={creating}
            >
              <option value="camera_operator">Camera operator</option>
              <option value="production_lead">Production lead</option>
              <option value="admin">Admin</option>
            </GlassSelect>
            {error && <p className="text-sm text-destructive font-medium">{error}</p>}
            {lastSetupLink && (
              <div className="rounded-xl glass p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Setup link (share with invitee)</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={lastSetupLink}
                    className="flex-1 px-3 py-2 rounded-lg text-xs bg-black/20 border border-white/10 text-foreground"
                  />
                  <button
                    type="button"
                    onClick={copyLink}
                    className="px-3 py-2 rounded-lg text-xs font-medium border border-white/20 bg-white/5 hover:bg-white/10 flex items-center gap-1.5"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">Link expires in 7 days. In production, send this by email.</p>
              </div>
            )}
            <button
              type="submit"
              disabled={creating}
              className="w-fit px-4 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create invite"}
            </button>
          </form>
        </GlassCard>

        <GlassCard className="p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">Recent invites</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !invites.length ? (
            <p className="text-sm text-muted-foreground">No invites yet. Create one above.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Email</th>
                    <th className="pb-2 pr-4 font-medium">Role</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map((inv) => (
                    <tr key={inv.id} className="border-b border-white/5">
                      <td className="py-2.5 pr-4 text-foreground">{inv.email}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground capitalize">{inv.role?.replace("_", " ")}</td>
                      <td className="py-2.5 pr-4">
                        {inv.used_at ? <span className="text-xs text-emerald-500/90">Used</span> : <span className="text-xs text-amber-500/90">Pending</span>}
                      </td>
                      <td className="py-2.5 text-muted-foreground">{formatDate(inv.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </div>
    </PageShell>
  );
}
