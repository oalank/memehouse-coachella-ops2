import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/portal";

  if (isAuthenticated) {
    navigate(from, { replace: true });
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { user, error: err } = await login(email, password);
      if (err) {
        setError(typeof err === "string" ? err : "Invalid email or password");
        setLoading(false);
        return;
      }
      if (user) {
        navigate(from, { replace: true });
      }
    } catch (_) {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dark min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="glass-panel rounded-2xl p-8 border border-white/[0.08]">
          <h1 className="text-xl font-bold tracking-tight text-foreground mb-1">Portal sign in</h1>
          <p className="text-xs text-muted-foreground mb-6">MemeHouse Ops</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-black/30 border border-white/10 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label htmlFor="login-password" className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-black/30 border border-white/10 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
                placeholder="••••••••"
                required
              />
            </div>
            {error && (
              <p className="text-xs text-destructive font-medium" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
