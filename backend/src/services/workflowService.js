/**
 * Workflow Service
 * Top-level orchestration: idempotency check → schema validation → execution → audit
 */

const { v4: uuidv4 } = require('uuid');
const workflowRegistry = require('../config/workflowRegistry');
const inputValidator = require('../engine/inputValidator');
const workflowExecutor = require('../engine/workflowExecutor');
const store = require('../models/store');

class WorkflowService {
  async submit(workflowId, inputData, idempotencyKey) {
    // 1. Check workflow exists
    if (!workflowRegistry.exists(workflowId)) {
      return { success: false, error: `Workflow '${workflowId}' not found`, code: 404 };
    }

    // 2. Idempotency check — return existing result if already processed
    if (idempotencyKey) {
      const existingId = store.checkIdempotency(idempotencyKey);
      if (existingId) {
        const existing = store.getRequest(existingId);
        store.appendAudit(existingId, { event: 'duplicate_request_detected', idempotencyKey });
        return { success: true, data: existing, duplicate: true, code: 200 };
      }
    }

    // 3. Load workflow
    const workflowDef = workflowRegistry.get(workflowId);

    // 4. Validate input
    const validation = inputValidator.validate(inputData, workflowDef.inputSchema);
    if (!validation.valid) {
      return { success: false, error: 'Input validation failed', details: validation.errors, code: 400 };
    }

    // 5. Create request record
    const requestId = uuidv4();
    const request = store.saveRequest({
      id: requestId,
      workflowId,
      workflowName: workflowDef.name,
      workflowVersion: workflowDef.version,
      status: 'pending',
      inputData: validation.data,
      idempotencyKey: idempotencyKey || null,
      decision: null,
      decisionReason: null,
      stageTrace: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null
    });

    // 6. Register idempotency key BEFORE execution (prevents race duplicate submissions)
    if (idempotencyKey) {
      store.registerIdempotency(idempotencyKey, requestId);
    }

    // 7. Audit: request received
    store.appendAudit(requestId, {
      event: 'request_received',
      workflowId,
      idempotencyKey: idempotencyKey || null,
      inputFields: Object.keys(validation.data)
    });

    // 8. Execute workflow
    try {
      const result = await workflowExecutor.execute(workflowDef, validation.data, requestId);
      return { success: true, data: result, duplicate: false, code: 201 };
    } catch (err) {
      store.updateRequestStatus(requestId, 'failed', { errorMessage: err.message });
      store.appendAudit(requestId, { event: 'workflow_error', error: err.message });
      return { success: false, error: 'Workflow execution error', details: err.message, code: 500 };
    }
  }

  getRequest(requestId) {
    const req = store.getRequest(requestId);
    if (!req) return { success: false, error: 'Request not found', code: 404 };
    return { success: true, data: req };
  }

  getAuditLog(requestId) {
    const req = store.getRequest(requestId);
    if (!req) return { success: false, error: 'Request not found', code: 404 };
    return { success: true, data: { request: req, auditLog: store.getAuditLogs(requestId) } };
  }

  listRequests(filters = {}) {
    let all = store.getAllRequests();
    if (filters.workflowId) all = all.filter(r => r.workflowId === filters.workflowId);
    if (filters.status) all = all.filter(r => r.status === filters.status);
    return { success: true, data: all, total: all.length };
  }

  getStats() {
    return { success: true, data: store.getStats() };
  }

  listWorkflows() {
    return { success: true, data: workflowRegistry.list() };
  }

  getWorkflow(workflowId) {
    try {
      return { success: true, data: workflowRegistry.get(workflowId) };
    } catch (e) {
      return { success: false, error: e.message, code: 404 };
    }
  }
}

module.exports = new WorkflowService();
