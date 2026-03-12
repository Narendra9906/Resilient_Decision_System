/**
 * In-Memory Store
 * Simulates a persistent data layer. In production, replace with DB (Postgres, MongoDB, etc.)
 * Supports: requests, audit logs, idempotency keys
 */

class InMemoryStore {
  constructor() {
    this.requests = new Map();       // requestId -> request object
    this.auditLogs = new Map();      // requestId -> [audit entries]
    this.idempotencyKeys = new Map(); // idempotencyKey -> requestId
    this.retryQueues = new Map();    // requestId -> retry metadata
  }

  // --- Requests ---
  saveRequest(request) {
    this.requests.set(request.id, { ...request, updatedAt: new Date().toISOString() });
    return this.requests.get(request.id);
  }

  getRequest(requestId) {
    return this.requests.get(requestId) || null;
  }

  getAllRequests() {
    return Array.from(this.requests.values()).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
  }

  updateRequestStatus(requestId, status, extra = {}) {
    const req = this.requests.get(requestId);
    if (!req) throw new Error(`Request ${requestId} not found`);
    const updated = { ...req, status, ...extra, updatedAt: new Date().toISOString() };
    this.requests.set(requestId, updated);
    return updated;
  }

  // --- Audit Logs ---
  appendAudit(requestId, entry) {
    if (!this.auditLogs.has(requestId)) this.auditLogs.set(requestId, []);
    const log = { ...entry, timestamp: new Date().toISOString(), seq: this.auditLogs.get(requestId).length + 1 };
    this.auditLogs.get(requestId).push(log);
    return log;
  }

  getAuditLogs(requestId) {
    return this.auditLogs.get(requestId) || [];
  }

  // --- Idempotency ---
  checkIdempotency(key) {
    return this.idempotencyKeys.get(key) || null;
  }

  registerIdempotency(key, requestId) {
    this.idempotencyKeys.set(key, requestId);
  }

  // --- Retry ---
  setRetryMeta(requestId, meta) {
    this.retryQueues.set(requestId, meta);
  }

  getRetryMeta(requestId) {
    return this.retryQueues.get(requestId) || null;
  }

  // Stats for dashboard
  getStats() {
    const all = this.getAllRequests();
    const counts = all.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});
    return { total: all.length, byStatus: counts };
  }
}

// Singleton
module.exports = new InMemoryStore();
