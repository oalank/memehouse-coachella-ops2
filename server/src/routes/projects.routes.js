const express = require('express');
const projectsController = require('../controllers/projects.controller');

const router = express.Router();

router.patch('/projects/:id', projectsController.patchProject);
router.get('/projects/:id', projectsController.getProject);

module.exports = router;
