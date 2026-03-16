import { useState } from "react";
import { Link } from "react-router-dom";
import { GlassInput } from "../components/GlassInput";
import { Mail } from "lucide-react";
import { API_BASE } from "../apiClient";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const url = API_BASE ? `${API_BASE}/api/auth/forgot-password` : "/api/auth/forgot-password";
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Request failed");
      setSent(true);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen grid-bg content-glow flex items-center justify-center px-4">
        <div className="w-full max-w-[400px]">
          <div className="glass-panel rounded-2xl p-8 shadow-xl border border-white/[0.08] text-center">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Mail className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground tracking-tight mb-2">Check your email</h1>
            <p className="text-sm text-muted-foreground mb-6">
              If that email is on file, we sent a password reset link. It expires in 1 hour.
            </p>
            <Link to="/login" className="text-sm text-primary hover:underline">Back to sign in</Link>
          </div>
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
              <Mail className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">Forgot password?</h1>
              <p className="text-xs text-muted-foreground">We’ll send a reset link to your email</p>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <GlassInput
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              disabled={submitting}
            />
            {error && <p className="text-sm text-destructive font-medium" role="alert">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 py-3 rounded-xl font-semibold text-sm bg-primary text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 transition-opacity"
            >
              {submitting ? "Sending…" : "Send reset link"}
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
