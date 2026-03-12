const express = require('express');
const router = express.Router();
const workflowService = require('../services/workflowService');

// GET /api/requests
router.get('/', (req, res) => {
  const { workflowId, status } = req.query;
  const result = workflowService.listRequests({ workflowId, status });
  res.json(result);
});

// GET /api/requests/stats
router.get('/stats', (req, res) => {
  const result = workflowService.getStats();
  res.json(result);
});

// GET /api/requests/:requestId
router.get('/:requestId', (req, res) => {
  const result = workflowService.getRequest(req.params.requestId);
  res.status(result.code || 200).json(result);
});

// GET /api/requests/:requestId/audit
router.get('/:requestId/audit', (req, res) => {
  const result = workflowService.getAuditLog(req.params.requestId);
  res.status(result.code || 200).json(result);
});

module.exports = router;
