console.log("[BOOT CHECK] SERVER INDEX LIVE v1");

const express = require('express');
const session = require('express-session');
const fs = require('fs');
const cors = require('cors');
const path = require('path');

const { pool, hasDb } = require('./src/config');
const operatorsRoutes = require('./src/routes/operators.routes');
const authRoutes = require('./src/routes/auth.routes');
const projectsRoutes = require('./src/routes/projects.routes');
const { apiErrorHandler } = require('./src/middleware/apiErrorHandler');

const app = express();
const PORT = process.env.PORT || 3001;

console.log("[server] booting entry file:", __filename);
console.log("[server] NODE_ENV:", process.env.NODE_ENV || "undefined");

// ─── STATIC: production only, client/dist only; NEVER client/build in dev ───────
const clientDist = path.join(__dirname, '../client/dist');
const isProduction = process.env.NODE_ENV === 'production';
const distIndexPath = path.join(clientDist, 'index.html');
const productionBuildExists = isProduction && fs.existsSync(distIndexPath);

if (productionBuildExists) {
  app.use(express.static(clientDist));
} else if (isProduction) {
  console.warn('⚠️ client/dist not found; API only. Run "npm run build" in client.');
}

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Log auth route hits even if handlers are missing (helps diagnose 404s in prod).
app.use('/api/auth', (req, res, next) => {
  try {
    if (req.method === 'POST' && req.path === '/login') {
      console.log("[auth] hit POST /api/auth/login");
    }
    if (req.method === 'GET' && req.path === '/me') {
      console.log("[auth] hit GET /api/auth/me");
    }
  } catch (_) {}
  next();
});

const sessionSecret = process.env.SESSION_SECRET || 'dev-secret-change-in-production';
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    name: 'memehouse.sid',
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

// ─── INIT DB ──────────────────────────────────────────────────────────────────
/**
 * Migrate existing DBs: add new columns if missing.
 * Safe to run on fresh or existing databases.
 */
async function migrateDB() {
  const coreMigrations = [
    // Projects config (portal-side; separate from events). Stores budget, dates, metadata.
    `CREATE TABLE IF NOT EXISTS projects (
      id VARCHAR(128) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      budget_labor_cap INTEGER NOT NULL DEFAULT 0,
      start_date DATE,
      end_date DATE,
      event_start_iso DATE,
      event_end_iso DATE,
      location VARCHAR(255),
      client_name VARCHAR(255),
      credentials_required BOOLEAN NOT NULL DEFAULT true,
      break_policy JSONB,
      zones TEXT[],
      stream_report_link TEXT,
      gear_checkout_link TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_projects_name ON projects (name)`,
    // Auth: users table (created after operators so operator_id FK works)
    `CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'camera_operator',
      is_active BOOLEAN NOT NULL DEFAULT true,
      reset_token VARCHAR(255),
      reset_expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)`,
    `CREATE INDEX IF NOT EXISTS idx_users_role ON users (role)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS operator_id INTEGER REFERENCES operators(id) ON DELETE SET NULL`,
    `CREATE INDEX IF NOT EXISTS idx_users_operator_id ON users (operator_id)`,
    `ALTER TABLE operators ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true`,
    `ALTER TABLE operators ADD COLUMN IF NOT EXISTS planned_days INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE operators ADD COLUMN IF NOT EXISTS project_id VARCHAR(128)`,
    `ALTER TABLE operators ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE shifts ADD COLUMN IF NOT EXISTS project_id VARCHAR(128)`,
    `ALTER TABLE shifts ADD COLUMN IF NOT EXISTS hours NUMERIC(4,2)`,
    `ALTER TABLE shifts ADD COLUMN IF NOT EXISTS ot_hours NUMERIC(4,2)`,
    `ALTER TABLE shifts ADD COLUMN IF NOT EXISTS notes TEXT`,
    `ALTER TABLE shifts ADD COLUMN IF NOT EXISTS worked_hours NUMERIC(5,2)`,
    `ALTER TABLE shifts ADD COLUMN IF NOT EXISTS overtime_hours NUMERIC(5,2)`,
    `ALTER TABLE shifts ADD COLUMN IF NOT EXISTS overtime_pay NUMERIC(8,2)`,
    `ALTER TABLE shifts ADD COLUMN IF NOT EXISTS total_pay NUMERIC(8,2)`,
    `ALTER TABLE shifts ADD COLUMN IF NOT EXISTS on_break BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE shifts ADD COLUMN IF NOT EXISTS break_started_at TIMESTAMPTZ`,
    `ALTER TABLE shifts ADD COLUMN IF NOT EXISTS break_ended_at TIMESTAMPTZ`,
    `CREATE INDEX IF NOT EXISTS idx_shifts_operator_clockout ON shifts (operator_id, end_time)`,
    `CREATE TABLE IF NOT EXISTS project_operators (
      id SERIAL PRIMARY KEY,
      project_id VARCHAR(128) NOT NULL,
      operator_id INTEGER NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
      zone VARCHAR(50),
      hire_stage VARCHAR(50) NOT NULL DEFAULT 'Outreach',
      cred_status VARCHAR(50) NOT NULL DEFAULT 'Not Started',
      cred_type VARCHAR(50) NOT NULL DEFAULT 'None',
      planned_days INTEGER NOT NULL DEFAULT 1,
      project_day_rate INTEGER,
      tier VARCHAR(20),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(project_id, operator_id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_project_operators_project ON project_operators (project_id)`,
    `CREATE INDEX IF NOT EXISTS idx_project_operators_operator ON project_operators (operator_id)`,
    `ALTER TABLE project_operators ADD COLUMN IF NOT EXISTS availability_status VARCHAR(50)`,
    `ALTER TABLE project_operators ADD COLUMN IF NOT EXISTS available_through DATE`,
    `ALTER TABLE project_operators ADD COLUMN IF NOT EXISTS availability_note TEXT`,
    `ALTER TABLE project_operators ADD COLUMN IF NOT EXISTS availability_updated_by VARCHAR(255)`,
    `ALTER TABLE project_operators ADD COLUMN IF NOT EXISTS availability_updated_at TIMESTAMPTZ`,
    `CREATE TABLE IF NOT EXISTS operator_rating_history (
      id SERIAL PRIMARY KEY,
      operator_id INTEGER NOT NULL REFERENCES operators(id) ON DELETE CASCADE,
      old_rating INTEGER NOT NULL CHECK (old_rating >= 1 AND old_rating <= 5),
      new_rating INTEGER NOT NULL CHECK (new_rating >= 1 AND new_rating <= 5),
      reason TEXT,
      updated_by VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_operator_rating_history_operator ON operator_rating_history (operator_id)`,
  ];
  for (const q of coreMigrations) {
    try { await pool.query(q); } catch (_) { /* column may already exist */ }
  }
  // Optional: seed one admin user if none exist (set SEED_ADMIN_EMAIL + SEED_ADMIN_PASSWORD in .env)
  const seedEmail = process.env.SEED_ADMIN_EMAIL;
  const seedPassword = process.env.SEED_ADMIN_PASSWORD;
  if (seedEmail && seedPassword && hasDb) {
    try {
      const { rows: existing } = await pool.query('SELECT id FROM users LIMIT 1');
      if (existing.length === 0) {
        const bcrypt = require('bcrypt');
        const hash = bcrypt.hashSync(seedPassword, 12);
        await pool.query(
          'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)',
          [String(seedEmail).trim().toLowerCase(), hash, 'admin']
        );
        console.log('   Seeded admin user:', seedEmail);
      }
    } catch (e) {
      console.warn('   Seed admin skipped:', e.message);
    }
  }
  // Temporary seed user so login works immediately (safe: no duplicate email)
  if (hasDb) {
    try {
      const bcrypt = require('bcrypt');
      const seedEmail = 'work@alankaruku.com';
      const seedHash = bcrypt.hashSync('test1234', 12);
      const { rowCount } = await pool.query(
        `INSERT INTO users (email, password_hash, role, is_active)
         VALUES ($1, $2, 'admin', true)
         ON CONFLICT (email) DO NOTHING`,
        [seedEmail, seedHash]
      );
      if (rowCount > 0) console.log('   Seed user ready:', seedEmail);
    } catch (e) {
      console.warn('   Seed user skipped:', e.message);
    }
  }
  // One-time: move operators with project_id into project_operators, then clear project_id
  try {
    const { rows: legacy } = await pool.query('SELECT id, project_id, zone, hire_stage, cred_status, cred_type, planned_days, day_rate, tier FROM operators WHERE project_id IS NOT NULL AND project_id != \'\'');
    for (const op of legacy) {
      await pool.query(
        `INSERT INTO project_operators (project_id, operator_id, zone, hire_stage, cred_status, cred_type, planned_days, project_day_rate, tier)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (project_id, operator_id) DO NOTHING`,
        [op.project_id, op.id, op.zone, op.hire_stage || 'Outreach', op.cred_status || 'Not Started', op.cred_type || 'None', op.planned_days ?? 1, op.day_rate, op.tier || 'T2']
      );
    }
    if (legacy.length) await pool.query('UPDATE operators SET project_id = NULL WHERE project_id IS NOT NULL');
  } catch (_) { /* migration already done or table not ready */ }
}

async function initDB() {
  if (!hasDb) {
    console.warn('   Skipping DB init: DATABASE_URL not set');
    return;
  }
  try {
    await pool.query('SELECT 1');
    console.log('   DB connection: OK');
  } catch (err) {
    console.error('   DB connection FAILED:', err.message);
    console.error('   Stack:', err.stack);
    return;
  }
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  // Run only non-auth schema (from operators onward) so server boots without users/invites/reset_token
  const operatorsStart = schema.indexOf('CREATE TABLE IF NOT EXISTS operators');
  const schemaToRun = operatorsStart >= 0 ? schema.slice(operatorsStart) : schema;
  try {
    await pool.query(schemaToRun);
    await migrateDB();
    console.log('✅ Database initialized (operators, shifts, events)');
  } catch (err) {
    console.error('DB init error:', err.message);
    console.error('Stack:', err.stack);
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function computeRisk(op) {
  if (op.cred_status === 'Denied' || op.reliability <= 2) return 'HIGH';
  if (op.late_to_screen || op.rate_instability) return 'HIGH';
  if (op.reliability === 3) return 'MED';
  return 'LOW';
}

// ─── DB FALLBACK (return safe empty data when DB unavailable) ────────────────
function dbDown(res, route, fallback) {
  console.warn(`[${route}] DB down or query failed: returning fallback payload`);
  res.status(200).json(fallback);
}

function listRouterPaths(prefix, router) {
  const routes = [];
  try {
    const stack = router?.stack || [];
    for (const layer of stack) {
      if (!layer.route || !layer.route.path) continue;
      const methods = layer.route.methods || {};
      for (const [method, enabled] of Object.entries(methods)) {
        if (enabled) routes.push(`${method.toUpperCase()} ${prefix}${layer.route.path}`);
      }
    }
  } catch (_) {}
  return routes.sort();
}

// ─── API ROUTES (modular) ─────────────────────────────────────────────────────
console.log("[server] mounting auth routes at /api (expects /api/auth/*)");
app.use('/api', authRoutes);
console.log("[server] auth route paths:", listRouterPaths("/api", authRoutes));
app.use('/api', projectsRoutes);
app.use('/api', operatorsRoutes);

// ─── SHIFTS (scoped by project_id) ─────────────────────────────────────────────
app.get('/api/shifts', async (req, res) => {
  try {
    const { status, date, project_id: queryProjectId, projectId: queryProjectIdAlt } = req.query;
    const projectId = queryProjectId ?? queryProjectIdAlt ?? null;
    console.log('[GET /api/shifts] request', { projectId, status, date });
    let query = 'SELECT s.*, o.full_name AS operator_name FROM shifts s LEFT JOIN operators o ON s.operator_id = o.id';
    const conditions = [];
    const params = [];
    let paramIndex = 1;
    if (projectId != null && projectId !== '') {
      conditions.push(`s.project_id = $${paramIndex}`);
      params.push(projectId);
      paramIndex++;
    }
    if (status === 'active') {
      conditions.push('s.end_time IS NULL');
    } else if (status === 'closed') {
      conditions.push('s.end_time IS NOT NULL');
    }
    if (date === 'today') {
      conditions.push('(s.start_time AT TIME ZONE \'UTC\')::date = (CURRENT_TIMESTAMP AT TIME ZONE \'UTC\')::date');
    }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY s.start_time DESC, s.created_at DESC';
    let { rows } = await pool.query(query, params);
    rows = rows.map((s) => {
      if (s.end_time && s.start_time && (s.total_pay == null || Number(s.total_pay) === 0)) {
        const calc = computeShiftPay(s.start_time, s.end_time, s.break_minutes || 0, s.day_rate || 0);
        return { ...s, worked_hours: calc.worked_hours, overtime_hours: calc.overtime_hours, overtime_pay: calc.overtime_pay, total_pay: calc.total_pay };
      }
      return s;
    });
    res.json(rows);
  } catch (err) {
    console.error('[GET /api/shifts]', err.message);
    dbDown(res, 'GET /api/shifts', []);
  }
});

const SHIFT_PATCH_WHITELIST = ['end_time','break_minutes','notes','zone','start_time','worked_hours','overtime_hours','overtime_pay','total_pay','on_break','break_started_at','break_ended_at'];

function computeShiftPay(clockIn, clockOut, breakMins, dayRate) {
  const rate = Number(dayRate) || 0;
  if (!clockIn || !clockOut) return { worked_hours: 0, overtime_hours: 0, overtime_pay: 0, total_pay: rate };
  let endMs = new Date(clockOut).getTime();
  const startMs = new Date(clockIn).getTime();
  if (endMs <= startMs) endMs += 24 * 3600000;
  const worked = Math.max(0, (endMs - startMs) / 3600000 - (Number(breakMins) || 0) / 60);
  const ot = Math.max(0, worked - 8);
  const reg = Math.min(worked, 8);
  const hourly = rate / 8;
  const regularPay = reg * hourly;
  const otPay = ot * hourly * 1.5;
  return { worked_hours: worked, overtime_hours: ot, overtime_pay: otPay, total_pay: regularPay + otPay };
}

app.post('/api/shifts', async (req, res) => {
  const s = req.body;
  const operatorId = s.operator_id || s.operatorId;
  if (!operatorId) return res.status(400).json({ error: 'operatorId required' });
  const clockIn = s.clock_in || s.start_time;
  const clockOut = s.clock_out || s.end_time;
  const isClockIn = !clockOut;
  try {
    if (isClockIn) {
      const { rows: existing } = await pool.query('SELECT id FROM shifts WHERE operator_id = $1 AND end_time IS NULL', [operatorId]);
      if (existing.length) return res.status(409).json({ error: 'This operator is already clocked in.', shiftId: existing[0].id });
    }
    const { rows: opRow } = await pool.query('SELECT full_name, day_rate FROM operators WHERE id = $1', [operatorId]);
    if (!opRow.length) return res.status(404).json({ error: 'Operator not found' });
    const op = opRow[0];
    const now = new Date().toISOString();
    const startTime = clockIn || now;
    const endTime = clockOut || (isClockIn ? null : now);
    const breakM = Number(s.break_minutes) || 0;
    const zone = s.zone || s.zoneId || null;
    let workedHours = null, overtimeHours = null, overtimePay = null, totalPay = null;
    if (endTime) {
      const calc = computeShiftPay(startTime, endTime, breakM, op.day_rate);
      workedHours = calc.worked_hours;
      overtimeHours = calc.overtime_hours;
      overtimePay = calc.overtime_pay;
      totalPay = calc.total_pay;
    }
    const shiftId = `SH-${Date.now()}`;
    const projectId = s.project_id ?? s.projectId ?? null;
    const d = s.date ? new Date(s.date).toISOString().slice(0, 10) : (startTime ? startTime.slice(0, 10) : new Date().toISOString().slice(0, 10));
    const { rows } = await pool.query(`
      INSERT INTO shifts (shift_id, operator_id, operator_name, zone, date, start_time, end_time, break_minutes, flat_hours, ot_multiplier, day_rate, notes, worked_hours, overtime_hours, overtime_pay, total_pay, project_id)
      VALUES ($1,$2,$3,$4,$5::date,$6,$7,$8,12,1.5,$9,$10,$11,$12,$13,$14,$15)
      RETURNING *`,
      [shiftId, operatorId, op.full_name, zone, d, startTime, endTime, breakM, op.day_rate || 0, s.notes || null, workedHours, overtimeHours, overtimePay, totalPay, projectId]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('[POST /api/shifts]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/shifts/:id', async (req, res) => {
  let updates = { ...req.body };
  if (updates.clockOut !== undefined) { updates.end_time = updates.clockOut === 'now' ? new Date().toISOString() : updates.clockOut; }
  const allowed = Object.keys(updates).filter(k => SHIFT_PATCH_WHITELIST.includes(k));
  if (!allowed.length) return res.status(400).json({ error: 'No valid fields' });
  try {
    const { rows: existing } = await pool.query('SELECT start_time, day_rate, break_minutes FROM shifts WHERE id = $1', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const ex = existing[0];
    if (updates.end_time && ex.start_time && !updates.worked_hours) {
      const calc = computeShiftPay(ex.start_time, updates.end_time, updates.break_minutes ?? ex.break_minutes ?? 0, ex.day_rate || 0);
      updates.worked_hours = calc.worked_hours;
      updates.overtime_hours = calc.overtime_hours;
      updates.overtime_pay = calc.overtime_pay;
      updates.total_pay = calc.total_pay;
    }
    const allKeys = [...new Set([...allowed, ...(updates.worked_hours != null ? ['worked_hours','overtime_hours','overtime_pay','total_pay'] : [])])].filter(k => updates[k] != null);
    const setClauses = allKeys.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const values = allKeys.map(f => updates[f]);
    const { rows } = await pool.query(
      `UPDATE shifts SET ${setClauses} WHERE id = $1 RETURNING *`,
      [req.params.id, ...values]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/shifts/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM shifts WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── EVENTS ───────────────────────────────────────────────────────────────────
app.get('/api/events', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM events ORDER BY id ASC LIMIT 1');
    res.json(rows[0] || {});
  } catch (err) {
    console.error('[GET /api/events]', err.message);
    dbDown(res, 'GET /api/events', {});
  }
});

app.patch('/api/events', async (req, res) => {
  const updates = req.body;
  const fields = Object.keys(updates);
  const setClauses = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
  const values = fields.map(f => updates[f]);
  try {
    const { rows } = await pool.query(
      `UPDATE events SET ${setClauses} WHERE id = (SELECT id FROM events ORDER BY id ASC LIMIT 1) RETURNING *`,
      values
    );
    res.json(rows[0] || {});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Stage weights for forecast_labor (pipeline stages except Passed). Normalized lowercase.
const STAGE_WEIGHTS = {
  confirmed: 1.0,
  'loa signed': 0.8,
  offered: 0.6,
  interviewing: 0.4,
  screened: 0.25,
  outreach: 0.1,
  responded: 0.1,
  onboarded: 0.1,
  added: 0.1,
  passed: 0,
};

function getStageWeight(hireStage) {
  const key = (hireStage || '').toLowerCase().trim();
  return STAGE_WEIGHTS[key] ?? 0;
}

// ─── STATS (Executive dashboard: project-scoped when project_id provided) ─
// When project_id set: operators and labor from project_operators join (effective rate = project_day_rate ?? day_rate).
app.get('/api/stats', async (req, res) => {
  try {
    const projectId = req.query.project_id ?? req.query.projectId ?? null;
    console.log('[GET /api/stats] request', { projectId });
    const projectScoped = projectId != null && String(projectId).trim() !== '';

    const shiftWhere = projectScoped ? ' WHERE project_id = $1' : '';
    const shiftParams = projectScoped ? [projectId] : [];

    const opJoin = projectScoped
      ? `FROM operators o INNER JOIN project_operators po ON po.operator_id = o.id AND po.project_id = $1
         WHERE o.is_archived = false`
      : 'FROM operators';
    const opSelect = projectScoped
      ? `SELECT o.id, o.reliability, o.late_to_screen, o.rate_instability,
         COALESCE(po.project_day_rate, o.day_rate) AS day_rate,
         COALESCE(po.planned_days, o.planned_days) AS planned_days,
         po.hire_stage AS hire_stage, po.cred_status AS cred_status`
      : 'SELECT id, hire_stage, cred_status, day_rate, planned_days, reliability, late_to_screen, rate_instability';
    const opParams = projectScoped ? [projectId] : [];

    const [
      { rows: ops },
      { rows: shifts },
      { rows: events },
      { rows: committedRows },
      { rows: forecastRows },
    ] = await Promise.all([
      pool.query(`${opSelect} ${opJoin}`, opParams),
      pool.query('SELECT * FROM shifts' + shiftWhere, shiftParams),
      pool.query('SELECT * FROM events ORDER BY id ASC LIMIT 1'),
      projectScoped
        ? pool.query(
            `SELECT COALESCE(SUM(
              COALESCE(po.project_day_rate, o.day_rate, 0)::numeric * CASE WHEN COALESCE(po.planned_days, o.planned_days, 0) > 0 THEN po.planned_days ELSE 1 END
            ), 0)::integer AS committed_labor
            FROM operators o INNER JOIN project_operators po ON po.operator_id = o.id AND po.project_id = $1
            WHERE o.is_archived = false AND o.active IS NOT FALSE AND po.hire_stage = 'Confirmed'`,
            [projectId]
          )
        : pool.query(
            `SELECT COALESCE(SUM(
              COALESCE(day_rate, 0)::numeric * CASE WHEN COALESCE(planned_days, 0) > 0 THEN planned_days ELSE 1 END
            ), 0)::integer AS committed_labor
            FROM operators WHERE hire_stage = 'Confirmed' AND (active IS NOT FALSE)`
          ),
      projectScoped
        ? pool.query(
            `SELECT COALESCE(SUM(
              COALESCE(po.project_day_rate, o.day_rate, 0)::numeric * COALESCE(po.planned_days, o.planned_days, 0) * (
                CASE
                  WHEN LOWER(TRIM(po.hire_stage)) = 'confirmed' THEN 1.0
                  WHEN LOWER(TRIM(po.hire_stage)) = 'loa signed' THEN 0.8
                  WHEN LOWER(TRIM(po.hire_stage)) = 'offered' THEN 0.6
                  WHEN LOWER(TRIM(po.hire_stage)) = 'interviewing' THEN 0.4
                  WHEN LOWER(TRIM(po.hire_stage)) = 'screened' THEN 0.25
                  WHEN LOWER(TRIM(po.hire_stage)) IN ('onboarded', 'outreach', 'added', 'responded') THEN 0.10
                  ELSE 0
                END
              )
            ), 0)::integer AS forecast_labor
            FROM operators o INNER JOIN project_operators po ON po.operator_id = o.id AND po.project_id = $1
            WHERE o.is_archived = false`,
            [projectId]
          )
        : pool.query(
            `SELECT COALESCE(SUM(
              COALESCE(day_rate, 0)::numeric * COALESCE(planned_days, 0) * (
                CASE
                  WHEN LOWER(TRIM(hire_stage)) = 'confirmed' THEN 1.0
                  WHEN LOWER(TRIM(hire_stage)) = 'loa signed' THEN 0.8
                  WHEN LOWER(TRIM(hire_stage)) = 'offered' THEN 0.6
                  WHEN LOWER(TRIM(hire_stage)) = 'interviewing' THEN 0.4
                  WHEN LOWER(TRIM(hire_stage)) = 'screened' THEN 0.25
                  WHEN LOWER(TRIM(hire_stage)) IN ('onboarded', 'outreach', 'added', 'responded') THEN 0.10
                  ELSE 0
                END
              )
            ), 0)::integer AS forecast_labor
            FROM operators`
          ),
    ]);

    const event = events[0] || {};
    // When project-scoped, budget_cap comes from client (project); API returns 0 so client uses project.budget.laborCap
    const budget_cap = projectScoped ? 0 : (event.labor_budget_cap != null ? Number(event.labor_budget_cap) : 0);

    const committed_labor = Math.round(Number(committedRows[0]?.committed_labor ?? 0));
    const forecast_labor = Number(forecastRows[0]?.forecast_labor ?? 0);

    const confirmed = ops.filter(o => (o.hire_stage || '').trim() === 'Confirmed');
    const credentialed = ops.filter(o => (o.cred_status || '').trim() === 'Approved');
    const credDenied = ops.filter(o => (o.cred_status || '').trim() === 'Denied');
    const highRisk = ops.filter(o => computeRisk(o) === 'HIGH');

    // actual_labor = SUM(total_pay) from closed shifts (project-scoped when project_id set); otSpend = SUM(overtime_pay)
    let actual_labor = 0;
    let otSpend = 0;
    for (const s of shifts) {
      if (s.end_time == null) continue;
      const storedTotal = s.total_pay != null && !Number.isNaN(Number(s.total_pay)) ? Number(s.total_pay) : null;
      const storedOt = s.overtime_pay != null && !Number.isNaN(Number(s.overtime_pay)) ? Number(s.overtime_pay) : null;
      const useStored = storedTotal != null && storedTotal > 0;
      if (useStored) {
        actual_labor += storedTotal;
        otSpend += storedOt != null ? storedOt : 0;
      } else if (s.start_time && s.end_time) {
        const calc = computeShiftPay(s.start_time, s.end_time, s.break_minutes || 0, s.day_rate || 0);
        actual_labor += calc.total_pay;
        otSpend += calc.overtime_pay;
      }
    }
    actual_labor = Math.round(actual_labor);
    otSpend = Math.round(otSpend);

    const remaining = Math.round(budget_cap - Math.max(actual_labor, committed_labor));

    const counts = {
      total_operators: ops.length,
      confirmed: confirmed.length,
      credentialed: credentialed.length,
      cred_denied: credDenied.length,
      high_risk: highRisk.length,
    };

    res.json({
      budget_cap: Math.round(budget_cap),
      actual_labor,
      committed_labor,
      forecast_labor,
      remaining,
      counts,
      otSpend,
      total: ops.length,
      confirmed: confirmed.length,
      credApproved: credentialed.length,
      credDenied: credDenied.length,
      highRisk: highRisk.length,
      budgetCap: Math.round(budget_cap),
      actualLabor: actual_labor,
      eventName: event.event_name || '',
      eventStart: event.start_date || '',
      eventEnd: event.end_date || '',
      budget: budget_cap,
    });
  } catch (err) {
    console.error('[GET /api/stats]', err.message);
    const fallbackCounts = { total_operators: 0, confirmed: 0, credentialed: 0, cred_denied: 0, high_risk: 0 };
    dbDown(res, 'GET /api/stats', {
      budget_cap: 0, actual_labor: 0, committed_labor: 0, forecast_labor: 0,
      remaining: 0, counts: fallbackCounts, otSpend: 0,
      total: 0, confirmed: 0, credApproved: 0, credDenied: 0, highRisk: 0,
      budgetCap: 0, actualLabor: 0, eventName: '', eventStart: '', eventEnd: '', budget: 0,
    });
  }
});

// ─── METRICS (minimal aggregate for Executive; single source of truth from DB) ─
app.get('/api/metrics', async (req, res) => {
  try {
    const [
      { rows: committedRows },
      { rows: shifts },
      { rows: events },
    ] = await Promise.all([
      pool.query(`
        SELECT COALESCE(SUM(
          COALESCE(day_rate, 0)::numeric * CASE WHEN COALESCE(planned_days, 0) > 0 THEN planned_days ELSE 1 END
        ), 0)::integer AS committed_labor
        FROM operators
        WHERE hire_stage = 'Confirmed' AND (active IS NOT FALSE)
      `),
      pool.query('SELECT * FROM shifts'),
      pool.query('SELECT * FROM events ORDER BY id ASC LIMIT 1'),
    ]);
    const budget_cap = (events[0] && events[0].labor_budget_cap != null) ? Number(events[0].labor_budget_cap) : 0;
    const committed_labor = Math.round(Number(committedRows[0]?.committed_labor ?? 0));
    let actual_labor = 0;
    for (const s of shifts) {
      if (s.end_time == null) continue;
      const storedTotal = s.total_pay != null && !Number.isNaN(Number(s.total_pay)) ? Number(s.total_pay) : null;
      const useStored = storedTotal != null && storedTotal > 0;
      if (useStored) {
        actual_labor += storedTotal;
      } else if (s.start_time && s.end_time) {
        const calc = computeShiftPay(s.start_time, s.end_time, s.break_minutes || 0, s.day_rate || 0);
        actual_labor += calc.total_pay;
      }
    }
    actual_labor = Math.round(actual_labor);
    const remaining = Math.round(budget_cap - Math.max(actual_labor, committed_labor));
    res.json({ committed_labor, actual_labor, remaining, budget_cap });
  } catch (err) {
    console.error('[GET /api/metrics]', err.message);
    dbDown(res, 'GET /api/metrics', {
      committed_labor: 0, actual_labor: 0, remaining: 0, budget_cap: 0,
    });
  }
});

// ─── HEALTH ───────────────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  let dbOk = false;
  try { await pool.query('SELECT 1'); dbOk = true; } catch (e) { /* db not ready */ }
  res.status(200).json({ ok: true, db: dbOk, service: 'memehouse-ops', ts: new Date().toISOString() });
});

// ─── DEMO SEED (run server-side seed so DB and app use same DATABASE_URL) ─────
app.post('/api/demo/seed', async (req, res) => {
  if (!hasDb) {
    return res.status(503).json({ error: 'DATABASE_URL not set. Add it to server/.env to use demo seed.' });
  }
  const { execSync } = require('child_process');
  const repoRoot = path.join(__dirname, '..');
  try {
    execSync(`node "${path.join(repoRoot, 'scripts', 'seed-demo.js')}"`, {
      cwd: repoRoot,
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    });
    res.status(200).json({ ok: true, message: 'Demo seed complete. Reload the app.' });
  } catch (err) {
    console.error('[POST /api/demo/seed]', err.message);
    const stderr = err.stderr ? err.stderr.toString() : '';
    res.status(500).json({ error: err.message || 'Seed failed', detail: stderr.slice(0, 500) });
  }
});

// Temporary debug endpoint: confirms this entry file is live.
app.get('/api/debug/routes', (req, res) => {
  res.status(200).json({ bootCheck: "SERVER INDEX LIVE v1", authRoutesMounted: true });
});

// ─── API error handler: ensure /api/* always returns JSON on errors
app.use(apiErrorHandler);

// ─── API 404: ensure /api/* never gets HTML (e.g. from SPA fallback or wrong host)
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found', path: req.path });
  }
  next();
});

// ─── SPA FALLBACK (production only) / DEV ROOT ────────────────────────────────
if (productionBuildExists) {
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API route not found', path: req.path });
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  app.get('/', (req, res) =>
    res.json({ ok: true, message: 'API running; use Vite on :5173 for UI' })
  );
  app.get('*', (req, res) =>
    res.status(404).json({ error: 'Not found', message: 'In dev use http://localhost:5173 for UI' })
  );
}

// ─── START ────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 MemeHouse Ops running on :${PORT}`);
  console.log(`   DATABASE_URL: ${hasDb ? 'set' : 'NOT SET (DB operations will fail)'}`);
  if (!isProduction) {
    console.log('   Dev: API only; UI at http://localhost:5173');
  }
  initDB().catch(err => console.error('DB init:', err.message));
});
