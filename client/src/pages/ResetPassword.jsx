import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { GlassInput } from "../components/GlassInput";
import { KeyRound } from "lucide-react";

const API = import.meta.env?.VITE_API_URL ?? "";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) setError("Missing reset token");
  }, [token]);

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
      const res = await fetch(`${API}/api/auth/reset-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Reset failed");
      setSuccess(true);
    } catch (err) {
      setError(err.message || "Reset failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen grid-bg content-glow flex items-center justify-center px-4">
        <div className="w-full max-w-[400px]">
          <div className="glass-panel rounded-2xl p-8 shadow-xl border border-white/[0.08] text-center">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <KeyRound className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground tracking-tight mb-2">Password reset</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Your password has been reset. You can sign in with your new password.
            </p>
            <Link to="/login" className="text-sm text-primary hover:underline">Sign in</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen grid-bg content-glow flex items-center justify-center px-4">
        <div className="glass-panel rounded-2xl p-8 max-w-[400px] w-full text-center">
          <p className="text-destructive font-medium">{error}</p>
          <Link to="/forgot-password" className="mt-4 inline-block text-sm text-primary hover:underline">Request a new link</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid-bg content-glow flex items-center justify-center px-4">
      <div className="w-full max-w-[400px]">
        <div className="glass-panel rounded-2xl p-8 shadow-xl border border-white/[0.08]">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">New password</h1>
              <p className="text-xs text-muted-foreground">Choose a password at least 8 characters long</p>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <GlassInput
              label="New password"
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
              {submitting ? "Resetting…" : "Reset password"}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-6">
          <Link to="/login" className="text-primary hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
