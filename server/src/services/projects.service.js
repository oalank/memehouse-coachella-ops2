const { pool } = require('../config');

function normalizeBoolean(value, fallback = true) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'true' || v === '1' || v === 'yes') return true;
    if (v === 'false' || v === '0' || v === 'no') return false;
  }
  return fallback;
}

function toDbProject(id, body = {}) {
  const name = (body.name || '').trim() || null;
  const budgetLaborCap = body.budget && typeof body.budget === 'object' && body.budget.laborCap != null
    ? Number(body.budget.laborCap)
    : null;
  const startDate = (body.startDate || body.eventStartISO || '').slice(0, 10) || null;
  const endDate = (body.endDate || body.eventEndISO || '').slice(0, 10) || null;
  const eventStartIso = (body.eventStartISO || body.startDate || '').slice(0, 10) || null;
  const eventEndIso = (body.eventEndISO || body.endDate || '').slice(0, 10) || null;
  const location = body.location || null;
  const clientName = body.clientName || null;
  const credentialsRequired = normalizeBoolean(body.credentialsRequired, true);
  const breakPolicy = body.breakPolicy || null;
  const zones = Array.isArray(body.zones) ? body.zones : null;
  const streamReportLink = body.streamReportLink || null;
  const gearCheckoutLink = body.gearCheckoutLink || null;

  return {
    id,
    name,
    budget_labor_cap: budgetLaborCap != null && !Number.isNaN(budgetLaborCap) ? Math.round(budgetLaborCap) : 0,
    start_date: startDate,
    end_date: endDate,
    event_start_iso: eventStartIso,
    event_end_iso: eventEndIso,
    location,
    client_name: clientName,
    credentials_required: credentialsRequired,
    break_policy: breakPolicy,
    zones,
    stream_report_link: streamReportLink,
    gear_checkout_link: gearCheckoutLink,
  };
}

function mapRowToProject(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    budget: { laborCap: row.budget_labor_cap ?? 0 },
    startDate: row.start_date,
    endDate: row.end_date,
    eventStartISO: row.event_start_iso,
    eventEndISO: row.event_end_iso,
    location: row.location,
    clientName: row.client_name,
    credentialsRequired: row.credentials_required,
    breakPolicy: row.break_policy || undefined,
    zones: row.zones || [],
    streamReportLink: row.stream_report_link || undefined,
    gearCheckoutLink: row.gear_checkout_link || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function upsertProject(id, body) {
  const data = toDbProject(id, body);
  console.log('[projects.service] upsertProject toDbProject', data);
  const query = `
    INSERT INTO projects (
      id, name, budget_labor_cap, start_date, end_date, event_start_iso, event_end_iso,
      location, client_name, credentials_required, break_policy, zones,
      stream_report_link, gear_checkout_link
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      budget_labor_cap = EXCLUDED.budget_labor_cap,
      start_date = EXCLUDED.start_date,
      end_date = EXCLUDED.end_date,
      event_start_iso = EXCLUDED.event_start_iso,
      event_end_iso = EXCLUDED.event_end_iso,
      location = EXCLUDED.location,
      client_name = EXCLUDED.client_name,
      credentials_required = EXCLUDED.credentials_required,
      break_policy = EXCLUDED.break_policy,
      zones = EXCLUDED.zones,
      stream_report_link = EXCLUDED.stream_report_link,
      gear_checkout_link = EXCLUDED.gear_checkout_link,
      updated_at = NOW()
    RETURNING *
  `;
  const params = [
    data.id,
    data.name,
    data.budget_labor_cap,
    data.start_date,
    data.end_date,
    data.event_start_iso,
    data.event_end_iso,
    data.location,
    data.client_name,
    data.credentials_required,
    data.break_policy,
    data.zones,
    data.stream_report_link,
    data.gear_checkout_link,
  ];
  const { rows } = await pool.query(query, params);
  console.log('[projects.service] upsertProject result row', rows[0]);
  return mapRowToProject(rows[0]);
}

async function getProjectById(id) {
  const { rows } = await pool.query('SELECT * FROM projects WHERE id = $1', [id]);
  return mapRowToProject(rows[0]);
}

module.exports = {
  upsertProject,
  getProjectById,
};
