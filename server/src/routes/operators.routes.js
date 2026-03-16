const express = require('express');
const operatorsController = require('../controllers/operators.controller');

const router = express.Router({ mergeParams: true });

router.get('/operators', operatorsController.getOperators);
router.post('/operators', operatorsController.postOperator);
router.patch('/operators/:id', operatorsController.patchOperator);
router.delete('/operators/:id', operatorsController.deleteOperator);
router.post('/operators/:id/rating-history', operatorsController.postRatingHistory);

router.post('/projects/:projectId/operators', operatorsController.assignToProject);
router.patch('/projects/:projectId/operators/:projectOperatorId', operatorsController.patchProjectOperator);
router.delete('/projects/:projectId/operators/:projectOperatorId', operatorsController.removeFromProject);

module.exports = router;
