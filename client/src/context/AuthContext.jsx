import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiFetch } from "../apiClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const data = await apiFetch("/api/auth/me");
      setUser(data?.user ?? null);
      return data?.user ?? null;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/auth/login", {
        method: "POST",
        body: { email, password },
      });
      setUser(data?.user ?? null);
      return { user: data?.user, error: null };
    } catch (err) {
      let message = "Login failed";
      try {
        if (err?.body && typeof err.body === "string") {
          const j = JSON.parse(err.body);
          if (j?.error) message = j.error;
        }
      } catch (_) {}
      if (!message || message === "Login failed") message = err?.message || message;
      setUser(null);
      return { user: null, error: message };
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch (_) {}
    setUser(null);
  }, []);

  const value = {
    user,
    loading,
    login,
    logout,
    refreshAuth: fetchMe,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
