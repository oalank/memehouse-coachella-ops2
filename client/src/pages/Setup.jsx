import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../state/authStore";
import { GlassInput } from "../components/GlassInput";
import { LogIn } from "lucide-react";

const API = import.meta.env?.VITE_API_URL ?? "";

export default function Setup() {
  const { user, setUserFromSession } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [info, setInfo] = useState({ email: "", role: "", valid: false });
  const [loading, setLoading] = useState(!!token);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      navigate("/projects", { replace: true });
      return;
    }
    if (!token) {
      setError("Missing setup token");
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetch(`${API}/api/auth/setup?token=${encodeURIComponent(token)}`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          if (data.valid && data.email) setInfo({ email: data.email, role: data.role || "", valid: true });
          else setError(data.error || "Invalid or expired setup link");
        }
      })
      .catch(() => { if (!cancelled) setError("Could not verify setup link"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/auth/setup`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Setup failed");
      setUserFromSession(data.user ?? null);
      navigate("/projects", { replace: true });
    } catch (err) {
      setError(err.message || "Setup failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen grid-bg content-glow flex items-center justify-center px-4">
        <div className="text-muted-foreground text-sm">Verifying setup link…</div>
      </div>
    );
  }

  if (!info.valid) {
    return (
      <div className="min-h-screen grid-bg content-glow flex items-center justify-center px-4">
        <div className="glass-panel rounded-2xl p-8 max-w-[400px] w-full text-center">
          <p className="text-destructive font-medium">{error || "Invalid or expired setup link"}</p>
          <a href="/login" className="mt-4 inline-block text-sm text-primary hover:underline">Back to sign in</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid-bg content-glow flex items-center justify-center px-4">
      <div className="w-full max-w-[400px]">
        <div className="glass-panel rounded-2xl p-8 shadow-xl border border-white/[0.08]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <LogIn className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">Set your password</h1>
              <p className="text-xs text-muted-foreground">{info.email}</p>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <GlassInput
              label="Password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              minLength={8}
              disabled={submitting}
            />
            <GlassInput
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              required
              disabled={submitting}
            />
            {error && <p className="text-sm text-destructive font-medium" role="alert">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 py-3 rounded-xl font-semibold text-sm bg-primary text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 transition-opacity"
            >
              {submitting ? "Creating account…" : "Create account"}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-6">
          You were invited to MemeHouse. After setting your password you can sign in.
        </p>
      </div>
    </div>
  );
}
