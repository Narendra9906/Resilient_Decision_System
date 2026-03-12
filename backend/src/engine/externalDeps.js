/**
 * External Dependency Simulator
 * Simulates real-world external service calls (credit bureaus, compliance APIs, etc.)
 * 
 * In production: replace with actual HTTP clients / SDKs.
 * Supports: simulated latency, random failures (for testing retry logic), deterministic test mode.
 */

const SERVICES = {
  credit_bureau: {
    name: 'Equifax Credit Bureau API',
    failureRate: 0.15, // 15% random failure rate to test retry logic
    latencyMs: { min: 200, max: 800 }
  },
  compliance_registry: {
    name: 'Global Compliance Registry',
    failureRate: 0.10,
    latencyMs: { min: 300, max: 1200 }
  },
  background_check_service: {
    name: 'Sterling Background Checks',
    failureRate: 0.08,
    latencyMs: { min: 500, max: 2000 }
  }
};

class ExternalDependencySimulator {
  constructor() {
    this.testMode = process.env.NODE_ENV === 'test';
    this.forceFail = false; // can be set externally for testing
    this.callHistory = [];
  }

  async call(serviceId, context) {
    const service = SERVICES[serviceId];
    if (!service) {
      return { success: false, error: `Unknown service: ${serviceId}` };
    }

    const startTime = Date.now();

    // Simulate latency (skip in test mode for speed)
    if (!this.testMode) {
      const delay = service.latencyMs.min +
        Math.random() * (service.latencyMs.max - service.latencyMs.min);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Simulate failure
    const shouldFail = this.forceFail ||
      (!this.testMode && Math.random() < service.failureRate);

    const elapsed = Date.now() - startTime;
    const entry = {
      serviceId,
      serviceName: service.name,
      calledAt: new Date().toISOString(),
      latencyMs: elapsed,
      success: !shouldFail,
      error: shouldFail ? `${service.name} temporarily unavailable (HTTP 503)` : null
    };

    this.callHistory.push(entry);

    if (shouldFail) {
      return { success: false, error: entry.error, serviceId, latencyMs: elapsed };
    }

    return { success: true, serviceId, serviceName: service.name, latencyMs: elapsed, data: this._mockResponse(serviceId, context) };
  }

  _mockResponse(serviceId, context) {
    switch (serviceId) {
      case 'credit_bureau':
        return { verified: true, reportId: `CR-${Date.now()}`, bureauScore: context.creditScore };
      case 'compliance_registry':
        return { verified: true, registryId: `REG-${Date.now()}`, sanctionsFree: true };
      case 'background_check_service':
        return { verified: true, checkId: `BGC-${Date.now()}`, cleared: context.backgroundCheckPassed };
      default:
        return { verified: true };
    }
  }

  setForceFail(value) {
    this.forceFail = value;
  }

  getCallHistory() {
    return this.callHistory;
  }
}

module.exports = new ExternalDependencySimulator();
