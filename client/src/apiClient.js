// Shared API client for the frontend.
// Single source of truth for API base:
// 1) VITE_API_BASE_URL (preferred)
// 2) VITE_API_URL (fallback)
// 3) Empty string (dev-only, so Vite proxy handles /api)
// If the value looks like "KEY=URL" (e.g. mis-injected env), use only the URL part so we never concatenate into the page path.

function normalizeBase(value) {
  const s = String(value ?? "").trim();
  if (!s) return "";
  // If value looks like "VITE_API_BASE_URL=https://..." use only the part after the last "=" that is a URL
  if (s.includes("=")) {
    const afterEq = s.slice(s.lastIndexOf("=") + 1).trim();
    if (afterEq.startsWith("http://") || afterEq.startsWith("https://")) return afterEq.replace(/\/$/, "");
  }
  // Only use as base if it's a full URL (avoids hostnames like "base" causing ENOTFOUND)
  if (s.startsWith("http://") || s.startsWith("https://")) return s.replace(/\/$/, "");
  return "";
}

const rawBase = import.meta.env?.VITE_API_BASE_URL ?? import.meta.env?.VITE_API_URL ?? "";
export const API_BASE = normalizeBase(rawBase);

if (import.meta.env.PROD && !API_BASE) {
  console.error(
    "[API] Backend URL not set. Set VITE_API_BASE_URL or VITE_API_URL on the frontend service to your backend root (e.g. https://your-backend.railway.app) and rebuild."
  );
}

function parseJsonResponse(txt, path) {
  const trimmed = (txt || "").trim();
  if (!trimmed) return {};
  if (trimmed.startsWith("<")) {
    const msg = API_BASE
      ? "Backend returned HTML instead of JSON."
      : "API returned HTML. Set VITE_API_BASE_URL or VITE_API_URL to your backend URL and rebuild.";
    console.error(`[API] ${path}:`, msg);
    throw new Error(msg);
  }
  try {
    return JSON.parse(txt);
  } catch (e) {
    console.error(`[API] ${path} invalid JSON:`, e?.message);
    throw new Error(`API ${path}: invalid response`);
  }
}

export async function apiFetch(path, opts = {}) {
  try {
    const normalizedPath = path && !path.startsWith("/") ? `/${path}` : path;
    const url = API_BASE ? `${API_BASE}${normalizedPath}` : normalizedPath;
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...opts,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const txt = await res.text();
    const contentType = (res.headers.get("content-type") || "").toLowerCase();

    if (!res.ok) {
      let msg = `API ${path} failed: ${res.status}`;
      try {
        const j = JSON.parse(txt);
        if (j?.error) msg = j.error;
      } catch {
        if (txt) msg += " " + txt.slice(0, 100);
      }
      console.error(`[API] ${path} failed:`, msg);
      const e = new Error(msg);
      e.status = res.status;
      e.body = txt;
      throw e;
    }

    if (contentType.includes("text/html") || (txt && txt.trimStart().startsWith("<"))) {
      const msg = API_BASE
        ? "Backend returned HTML instead of JSON."
        : "API returned HTML. Set VITE_API_BASE_URL or VITE_API_URL to your backend URL and rebuild.";
      console.error(`[API] ${path}:`, msg);
      throw new Error(msg);
    }

    return parseJsonResponse(txt, path);
  } catch (err) {
    if (err?.status) throw err;
    console.error(`[API] ${path} fetch error:`, err?.message || err);
    throw err;
  }
}

