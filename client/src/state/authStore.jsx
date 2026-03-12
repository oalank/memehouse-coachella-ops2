import { createContext, useContext, useState, useEffect, useCallback } from "react";

const AuthContext = createContext(null);

const API = import.meta.env?.VITE_API_URL ?? "";

/** Demo-only: bypass auth in local dev. Set VITE_DEMO_BYPASS_AUTH=true in .env.local */
const DEMO_BYPASS_AUTH = import.meta.env.DEV && import.meta.env.VITE_DEMO_BYPASS_AUTH === "true";
const DEMO_USER = { id: "demo", email: "demo@local", role: "production_lead" };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(DEMO_BYPASS_AUTH ? DEMO_USER : null);
  const [loading, setLoading] = useState(!DEMO_BYPASS_AUTH);

  const checkAuth = useCallback(async () => {
    if (DEMO_BYPASS_AUTH) {
      setUser(DEMO_USER);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API}/api/auth/me`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user ?? null);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    const onUnauthorized = () => {
      if (!DEMO_BYPASS_AUTH) setUser(null);
    };
    window.addEventListener("auth:unauthorized", onUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", onUnauthorized);
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await fetch(`${API}/api/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: (email || "").trim().toLowerCase(), password: password || "" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "Login failed");
    }
    setUser(data.user ?? null);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${API}/api/auth/logout`, { method: "POST", credentials: "include" });
    } finally {
      setUser(null);
    }
  }, []);

  /** Set user from session (e.g. after invite setup). No API call. */
  const setUserFromSession = useCallback((userData) => {
    setUser(userData ?? null);
  }, []);

  const value = { user, loading, login, logout, checkAuth, setUserFromSession };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
