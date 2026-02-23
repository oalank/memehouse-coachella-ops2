const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// ─── DB ───────────────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway') ? { rejectUnauthorized: false } : false,
});

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
const clientBuild = path.join(__dirname, process.env.NODE_ENV === 'production' ? 'client/build' : '../client/build');
app.use(cors());
app.use(express.json());
app.use(express.static(clientBuild));

// ─── INIT DB ──────────────────────────────────────────────────────────────────
async function initDB() {
  const fs = require('fs');
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  try {
    await pool.query(schema);
    console.log('✅ Database initialized');
  } catch (err) {
    console.error('DB init error:', err.message);
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function computeRisk(op) {
  if (op.cred_status === 'Denied' || op.reliability <= 2) return 'HIGH';
  if (op.late_to_screen || op.rate_instability) return 'HIGH';
  if (op.reliability === 3) return 'MED';
  return 'LOW';
}

// ─── OPERATORS ────────────────────────────────────────────────────────────────
app.get('/api/operators', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM operators ORDER BY created_at ASC');
    const ops = rows.map(o => ({ ...o, risk: computeRisk(o) }));
    res.json(ops);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/operators', async (req, res) => {
  const o = req.body;
  const opId = `OP-${Date.now()}`;
  try {
    const { rows } = await pool.query(`
      INSERT INTO operators
        (op_id, full_name, tier, zone, hire_stage, cred_status, cred_type,
         day_rate, source, is_buffer, phone, reel, refs, loa, w9,
         reliability, worked_with_memehouse, late_to_screen, rate_instability,
         gear, perf_score, rehire_eligible, post_notes, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
      RETURNING *`,
      [opId, o.full_name, o.tier||'T2', o.zone||null, o.hire_stage||'Outreach',
       o.cred_status||'Not Started', o.cred_type||'None', o.day_rate||0,
       o.source||null, o.is_buffer||false, o.phone||null,
       o.reel||false, o.refs||false, o.loa||false, o.w9||false,
       o.reliability||3, o.worked_with_memehouse||false,
       o.late_to_screen||false, o.rate_instability||false,
       o.gear||[], o.perf_score||null, o.rehire_eligible||null,
       o.post_notes||null, o.notes||null]
    );
    res.json({ ...rows[0], risk: computeRisk(rows[0]) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/operators/:id', async (req, res) => {
  const updates = req.body;
  const fields = Object.keys(updates);
  if (!fields.length) return res.status(400).json({ error: 'No fields' });

  const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
  const values = fields.map(f => updates[f]);

  try {
    const { rows } = await pool.query(
      `UPDATE operators SET ${setClauses} WHERE id = $1 RETURNING *`,
      [req.params.id, ...values]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ ...rows[0], risk: computeRisk(rows[0]) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/operators/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM operators WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── SHIFTS ───────────────────────────────────────────────────────────────────
app.get('/api/shifts', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM shifts ORDER BY date DESC, created_at DESC');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/shifts', async (req, res) => {
  const s = req.body;
  const shiftId = `SH-${Date.now()}`;
  try {
    const { rows } = await pool.query(`
      INSERT INTO shifts
        (shift_id, operator_id, operator_name, zone, date,
         start_time, end_time, break_minutes, flat_hours, ot_multiplier, day_rate)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *`,
      [shiftId, s.operator_id||null, s.operator_name, s.zone, s.date||null,
       s.start_time||null, s.end_time||null, s.break_minutes||0,
       s.flat_hours||12, s.ot_multiplier||1.5, s.day_rate||0]
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
  } catch (err) { res.status(500).json({ error: err.message }); }
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

// ─── STATS (computed server-side) ────────────────────────────────────────────
app.get('/api/stats', async (req, res) => {
  try {
    const [{ rows: ops }, { rows: shifts }, { rows: events }] = await Promise.all([
      pool.query('SELECT * FROM operators'),
      pool.query('SELECT * FROM shifts'),
      pool.query('SELECT * FROM events ORDER BY id ASC LIMIT 1'),
    ]);

    const event = events[0] || {};
    const confirmed = ops.filter(o => o.hire_stage === 'Confirmed');
    const credApproved = ops.filter(o => o.cred_status === 'Approved');
    const credDenied = ops.filter(o => o.cred_status === 'Denied');
    const highRisk = ops.filter(o => computeRisk(o) === 'HIGH');

    const calcShiftPay = (s) => {
      const worked = s.start_time && s.end_time
        ? Math.max(0, (new Date(s.end_time) - new Date(s.start_time)) / 3600000 - (s.break_minutes || 0) / 60)
        : 0;
      const ot = Math.max(0, worked - (s.flat_hours || 12));
      const hourly = (s.day_rate || 0) / 12;
      const otPay = ot * hourly * (s.ot_multiplier || 1.5);
      return { total: (s.day_rate || 0) + otPay, ot: otPay };
    };

    const actualLabor = shifts.reduce((a, s) => a + calcShiftPay(s).total, 0);
    const otSpend = shifts.reduce((a, s) => a + calcShiftPay(s).ot, 0);
    const projectedLabor = confirmed.reduce((a, o) => a + (o.day_rate || 0), 0);

    res.json({
      total: ops.length,
      confirmed: confirmed.length,
      credApproved: credApproved.length,
      credDenied: credDenied.length,
      highRisk: highRisk.length,
      actualLabor, otSpend, projectedLabor,
      remaining: (event.labor_budget_cap || 0) - actualLabor,
      budget: event.labor_budget_cap || 0,
      eventName: event.event_name || '',
      eventStart: event.start_date || '',
      eventEnd: event.end_date || '',
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── HEALTH ───────────────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, service: 'memehouse-ops', ts: new Date().toISOString() });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

// ─── SPA FALLBACK ─────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(clientBuild, 'index.html'));
});

// ─── START ────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 MemeHouse Ops running on :${PORT}`);
  initDB().catch(err => console.error('DB init:', err.message));
});
