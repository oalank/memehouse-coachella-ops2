const { hasDb } = require('../config');
const operatorsService = require('../services/operators.service');

function dbDown(res, route, fallback) {
  console.warn(`[${route}] DB down or query failed: returning fallback payload`);
  res.status(200).json(fallback);
}

async function getOperators(req, res) {
  try {
    const projectId = req.query.project_id || req.query.projectId || null;
    const includeArchived = req.query.includeArchived === 'true' || req.query.includeArchived === '1';
    const rows = await operatorsService.getOperators(projectId, includeArchived);
    res.json(rows);
  } catch (err) {
    console.error('[GET /api/operators]', err.message);
    dbDown(res, 'GET /api/operators', []);
  }
}

async function postOperator(req, res) {
  console.log('[POST /api/operators] route reached, body keys:', req.body ? Object.keys(req.body) : []);
  if (!hasDb) {
    res.status(503).json({ error: 'DATABASE_URL not set. Add it to server/.env and restart.' });
    return;
  }
  try {
    const created = await operatorsService.createOperator(req.body);
    res.status(201).json(created);
  } catch (err) {
    console.error('[POST /api/operators] error:', err.message);
    console.error('[POST /api/operators] stack:', err.stack);
    if (err.code) console.error('[POST /api/operators] code:', err.code, 'hostname:', err.hostname);
    if (err.message && String(err.message).includes('base') && String(err.message).toLowerCase().includes('enotfound')) {
      console.error('[POST /api/operators] HINT: getaddrinfo ENOTFOUND base usually means DATABASE_URL has host "base". Check Railway backend env: DATABASE_URL should be the full Postgres URL (e.g. from Railway Postgres service), not a placeholder or reference to host "base".');
    }
    const message = err.message || 'Database error';
    res.status(500).json({ error: message });
  }
}

async function patchOperatorSafe(req, res) {
  try {
    const result = await operatorsService.updateOperator(req.params.id, req.body);
    if (!result) return res.status(400).json({ error: 'No valid fields' });
    if (result.notFound) return res.status(404).json({ error: 'Not found' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function deleteOperator(req, res) {
  try {
    await operatorsService.deleteOperator(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function postRatingHistorySafe(req, res) {
  try {
    const result = await operatorsService.addRatingHistory(req.params.id, req.body);
    if (!result) return res.status(400).json({ error: 'new_rating required (1-5)' });
    res.status(201).json(result);
  } catch (err) {
    if (err.code === '23503') return res.status(404).json({ error: 'Operator not found' });
    res.status(500).json({ error: err.message });
  }
}

async function assignToProject(req, res) {
  if (!hasDb) {
    res.status(503).json({ error: 'DATABASE_URL not set.' });
    return;
  }
  const operatorId = req.body?.operator_id ?? req.body?.operatorId;
  if (!operatorId) return res.status(400).json({ error: 'operator_id required' });
  try {
    const result = await operatorsService.assignToProject(req.params.projectId, req.body);
    if (!result) return res.status(404).json({ error: 'Operator not found' });
    res.status(201).json(result);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Operator already assigned to this project' });
    console.error('[POST /api/projects/:projectId/operators]', err.message);
    res.status(500).json({ error: err.message || 'Database error' });
  }
}

async function patchProjectOperator(req, res) {
  try {
    const result = await operatorsService.updateProjectOperator(req.params.projectId, req.params.projectOperatorId, req.body);
    if (!result) return res.status(400).json({ error: 'No valid fields' });
    if (result.notFound) return res.status(404).json({ error: 'Not found' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function removeFromProject(req, res) {
  try {
    const removed = await operatorsService.removeFromProject(req.params.projectId, req.params.projectOperatorId);
    if (!removed) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getOperators,
  postOperator,
  patchOperator: patchOperatorSafe,
  deleteOperator,
  postRatingHistory: postRatingHistorySafe,
  assignToProject,
  patchProjectOperator,
  removeFromProject,
};
