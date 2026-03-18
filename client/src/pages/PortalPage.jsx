import { LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function PortalPage() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <div className="dark min-h-screen text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <header className="flex flex-wrap items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-heading-glow">Operator Portal</h1>
            <p className="text-sm text-muted-foreground mt-0.5">MemeHouse Ops</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">{user.email}</p>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{user.role}</p>
            </div>
            <button
              type="button"
              onClick={() => logout()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-white/20 bg-white/5 text-foreground hover:bg-white/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Log out
            </button>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="glass-panel rounded-2xl p-6 border border-white/[0.08]">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Shifts</h2>
            <p className="text-sm text-muted-foreground">View and log shifts. (Coming soon.)</p>
          </div>
          <div className="glass-panel rounded-2xl p-6 border border-white/[0.08]">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Credentials</h2>
            <p className="text-sm text-muted-foreground">Festival credentials status. (Coming soon.)</p>
          </div>
          <div className="glass-panel rounded-2xl p-6 border border-white/[0.08]">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Projects</h2>
            <p className="text-sm text-muted-foreground">Assigned projects. (Coming soon.)</p>
          </div>
        </section>
      </div>
    </div>
  );
}
