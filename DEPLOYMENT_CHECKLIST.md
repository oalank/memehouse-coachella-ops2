# MemeHouse Coachella Ops — Deployment Checklist

## Status: Deployed, DB needs connection

---

## ✅ Done
- [x] GitHub repo (oalank/memehouse-coachella-ops2)
- [x] Railway project connected
- [x] Vite + Docker build
- [x] Server starts, health check passes
- [x] App URL live (check Railway dashboard)

---

## 🔧 To Complete (do these in order)

### 1. Add Postgres & link DATABASE_URL

1. Railway Dashboard → your project
2. Click **"+ New"** → **"Database"** → **"PostgreSQL"**
3. Wait for Postgres to provision
4. Click your **app service** (memehouse-coachella-ops2)
5. Go to **Variables** tab
6. Click **"+ New Variable"** → **"Add a variable reference"**
7. Select `DATABASE_URL` from the Postgres service
8. Save — Railway will redeploy automatically

### 2. Verify deployment

After linking DATABASE_URL:
- Check **Deploy Logs** — should see `✅ Database initialized`
- Visit your app URL — dashboard should load
- Test: add an operator, create a shift

### 3. (Optional) Configure domain

- Railway → your service → **Settings** → **Networking**
- Add a custom domain or use the default `*.railway.app` URL

---

## Quick test URLs

- **App:** `https://[your-app].railway.app`
- **Health:** `https://[your-app].railway.app/api/health` — should return `{"ok":true,"db":true,...}`

---

## If something breaks

| Issue | Fix |
|-------|-----|
| `DB init: DATABASE_URL not set` | Link Postgres variable (step 1) |
| Blank/white page | Check browser console; API may be down |
| 500 on API | Check Deploy Logs for DB errors |
| Can't connect to repo | Reconnect GitHub in Railway Settings |
