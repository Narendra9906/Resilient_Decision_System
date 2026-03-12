/**
 * Workflow API Routes
 * REST API for submitting requests, querying results, and audit logs.
 */

const express = require('express');
const router = express.Router();
const workflowService = require('../services/workflowService');

// POST /api/workflows/:workflowId/submit
router.post('/:workflowId/submit', async (req, res) => {
  const { workflowId } = req.params;
  const idempotencyKey = req.headers['x-idempotency-key'] || null;
  const inputData = req.body;

  if (!inputData || typeof inputData !== 'object' || Object.keys(inputData).length === 0) {
    return res.status(400).json({ success: false, error: 'Request body is required' });
  }

  const result = await workflowService.submit(workflowId, inputData, idempotencyKey);
  return res.status(result.code || 200).json(result);
});

// GET /api/workflows
router.get('/', (req, res) => {
  const result = workflowService.listWorkflows();
  res.json(result);
});

// GET /api/workflows/:workflowId
router.get('/:workflowId', (req, res) => {
  const result = workflowService.getWorkflow(req.params.workflowId);
  res.status(result.code || 200).json(result);
});

module.exports = router;
