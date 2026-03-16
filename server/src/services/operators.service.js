const { pool } = require('../config');

function computeRisk(op) {
  if (op.cred_status === 'Denied' || op.reliability <= 2) return 'HIGH';
  if (op.late_to_screen || op.rate_instability) return 'HIGH';
  if (op.reliability === 3) return 'MED';
  return 'LOW';
}

const OP_PATCH_WHITELIST = ['full_name', 'phone', 'day_rate', 'zone', 'cred_status', 'hire_stage', 'cred_type', 'planned_days', 'notes', 'active', 'is_archived', 'reliability', 'worked_with_memehouse', 'late_to_screen', 'rate_instability'];
const PO_PATCH_WHITELIST = ['zone', 'hire_stage', 'cred_status', 'cred_type', 'planned_days', 'project_day_rate', 'tier', 'availability_status', 'available_through', 'availability_note', 'availability_updated_by'];

async function getOperators(projectId, includeArchived) {
  if (projectId != null && projectId !== '') {
    let query = `
      SELECT o.*, po.id AS project_operator_id,
        COALESCE(po.project_day_rate, o.day_rate) AS day_rate,
        COALESCE(po.tier, o.tier) AS tier,
        po.zone AS zone,
        po.hire_stage AS hire_stage,
        po.cred_status AS cred_status,
        po.cred_type AS cred_type,
        po.planned_days AS planned_days,
        po.availability_status AS availability_status,
        po.available_through AS available_through,
        po.availability_note AS availability_note,
        po.availability_updated_by AS availability_updated_by,
        po.availability_updated_at AS availability_updated_at
      FROM operators o
      INNER JOIN project_operators po ON po.operator_id = o.id AND po.project_id = $1
      WHERE 1=1`;
    const params = [projectId];
    if (!includeArchived) query += ' AND o.is_archived = false';
    query += ' ORDER BY o.created_at ASC';
    const { rows } = await pool.query(query, params);
    return rows.map(o => {
      const { project_operator_id, ...rest } = o;
      return { ...rest, project_operator_id, risk: computeRisk(rest) };
    });
  }
  let query = 'SELECT id, op_id, full_name, phone, day_rate, tier, is_archived, created_at FROM operators WHERE 1=1';
  const params = [];
  if (!includeArchived) query += ' AND is_archived = false';
  query += ' ORDER BY full_name ASC';
  const { rows } = await pool.query(query, params);
  return rows;
}

async function createOperator(body) {
  const o = body;
  const opId = `OP-${Date.now()}`;
  const gearVal = Array.isArray(o.gear) ? o.gear : (o.gear ? [].concat(o.gear) : []);
  const { rows } = await pool.query(`
    INSERT INTO operators
      (op_id, full_name, tier, zone, hire_stage, cred_status, cred_type,
       day_rate, planned_days, source, is_buffer, phone, reel, refs, loa, w9,
       reliability, worked_with_memehouse, late_to_screen, rate_instability,
       gear, perf_score, rehire_eligible, post_notes, notes)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
    RETURNING *`,
    [opId, o?.full_name ?? '', o.tier || 'T2', o.zone || null, o.hire_stage || 'Outreach',
     o.cred_status || 'Not Started', o.cred_type || 'None', o.day_rate || 0,
     o.planned_days != null ? o.planned_days : 1,
     o.source || null, o.is_buffer || false, o.phone || null,
     o.reel || false, o.refs || false, o.loa || false, o.w9 || false,
     o.reliability || 3, o.worked_with_memehouse || false,
     o.late_to_screen || false, o.rate_instability || false,
     gearVal, o.perf_score || null, o.rehire_eligible || null,
     o.post_notes || null, o.notes || null]
  );
  return { ...rows[0], risk: computeRisk(rows[0]) };
}

async function updateOperator(id, updates) {
  const allowed = Object.keys(updates).filter(k => OP_PATCH_WHITELIST.includes(k));
  if (!allowed.length) return null;
  const setClauses = allowed.map((f, i) => `${f} = $${i + 2}`).join(', ');
  const values = allowed.map(f => updates[f]);
  const { rows } = await pool.query(
    `UPDATE operators SET ${setClauses} WHERE id = $1 RETURNING *`,
    [id, ...values]
  );
  if (!rows.length) return { notFound: true };
  return { ...rows[0], risk: computeRisk(rows[0]) };
}

async function deleteOperator(id) {
  await pool.query('DELETE FROM operators WHERE id = $1', [id]);
  return true;
}

async function addRatingHistory(operatorId, body) {
  const { old_rating, new_rating, reason, updated_by } = body || {};
  const newVal = Number(new_rating);
  if (newVal < 1 || newVal > 5) return null;
  const oldVal = old_rating != null ? Number(old_rating) : null;
  if (oldVal != null && (oldVal < 1 || oldVal > 5)) return null;
  const { rows } = await pool.query(
    `INSERT INTO operator_rating_history (operator_id, old_rating, new_rating, reason, updated_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [operatorId, oldVal ?? newVal, newVal, reason ?? null, updated_by ?? null]
  );
  return rows[0];
}

async function assignToProject(projectId, body) {
  const operatorId = body.operator_id ?? body.operatorId;
  if (!operatorId) return null;
  const { rows: existing } = await pool.query('SELECT id, full_name, phone, day_rate, tier FROM operators WHERE id = $1', [operatorId]);
  if (!existing.length) return null;
  const op = existing[0];
  const { rows } = await pool.query(`
    INSERT INTO project_operators (project_id, operator_id, zone, hire_stage, cred_status, cred_type, planned_days, project_day_rate, tier)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *`,
    [
      projectId,
      operatorId,
      body.zone ?? null,
      body.hire_stage ?? 'Outreach',
      body.cred_status ?? 'Not Started',
      body.cred_type ?? 'None',
      body.planned_days != null ? body.planned_days : 1,
      body.project_day_rate != null ? body.project_day_rate : (body.day_rate != null ? body.day_rate : op.day_rate),
      body.tier ?? op.tier ?? 'T2',
    ]
  );
  const po = rows[0];
  return { ...op, project_operator_id: po.id, day_rate: po.project_day_rate ?? op.day_rate, zone: po.zone, hire_stage: po.hire_stage, cred_status: po.cred_status, cred_type: po.cred_type, planned_days: po.planned_days, tier: po.tier ?? op.tier, risk: computeRisk({ ...op, ...po }) };
}

async function updateProjectOperator(projectId, projectOperatorId, updates) {
  const allowed = Object.keys(updates).filter(k => PO_PATCH_WHITELIST.includes(k));
  if (!allowed.length) return null;
  const hasAvailability = allowed.some(k => ['availability_status', 'available_through', 'availability_note', 'availability_updated_by'].includes(k));
  const setClauses = allowed.map((f, i) => `${f} = $${i + 4}`).join(', ') + (hasAvailability ? ', availability_updated_at = NOW()' : '');
  const values = allowed.map(f => updates[f]);
  const { rows } = await pool.query(
    `UPDATE project_operators SET ${setClauses} WHERE id = $1 AND project_id = $2 RETURNING *`,
    [projectOperatorId, projectId, ...values]
  );
  if (!rows.length) return { notFound: true };
  return rows[0];
}

async function removeFromProject(projectId, projectOperatorId) {
  const { rows } = await pool.query(
    'DELETE FROM project_operators WHERE id = $1 AND project_id = $2 RETURNING id',
    [projectOperatorId, projectId]
  );
  return rows.length > 0;
}

module.exports = {
  computeRisk,
  getOperators,
  createOperator,
  updateOperator,
  deleteOperator,
  addRatingHistory,
  assignToProject,
  updateProjectOperator,
  removeFromProject,
};
