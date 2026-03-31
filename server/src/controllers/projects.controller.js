const { hasDb } = require('../config');
const projectsService = require('../services/projects.service');

async function patchProject(req, res) {
  if (!hasDb) {
    return res.status(503).json({ error: 'DATABASE_URL not set. Add it to server/.env and restart.' });
  }
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Project id required' });
    console.log('[PATCH /api/projects/:id] request', { id, body: req.body });
    const updated = await projectsService.upsertProject(id, req.body || {});
    console.log('[PATCH /api/projects/:id] updated row', updated);
    res.status(200).json(updated);
  } catch (err) {
    console.error('[PATCH /api/projects/:id]', err.message);
    res.status(500).json({ error: 'Failed to update project' });
  }
}

async function getProject(req, res) {
  if (!hasDb) {
    return res.status(503).json({ error: 'DATABASE_URL not set. Add it to server/.env and restart.' });
  }
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Project id required' });
    const project = await projectsService.getProjectById(id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.status(200).json(project);
  } catch (err) {
    console.error('[GET /api/projects/:id]', err.message);
    res.status(500).json({ error: 'Failed to load project' });
  }
}

module.exports = { patchProject, getProject };
