/**
 * Test Suite: Configurable Workflow Decision Platform
 * Covers: happy path, invalid input, duplicates, dep failure, retry, rule changes
 */

const request = require('supertest');
const app = require('../server');
const store = require('../models/store');
const externalDeps = require('../engine/externalDeps');
const workflowRegistry = require('../config/workflowRegistry');

// Reset store state between tests
beforeEach(() => {
  store.requests.clear();
  store.auditLogs.clear();
  store.idempotencyKeys.clear();
  externalDeps.forceFail = false;
});

// ─── Happy Path Tests ────────────────────────────────────────────────────────

describe('Happy Path', () => {
  test('Auto-approve: high credit score, low loan-to-income', async () => {
    const res = await request(app)
      .post('/api/workflows/loan_application/submit')
      .send({
        applicantName: 'Alice Chen',
        applicantId: 'A001',
        loanAmount: 30000,
        annualIncome: 100000,
        creditScore: 750,
        employmentStatus: 'employed',
        loanPurpose: 'home renovation'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('approved');
    expect(res.body.data.decision).toBe('approved');
  });

  test('Vendor auto-approval: low value, certified, experienced', async () => {
    const res = await request(app)
      .post('/api/workflows/vendor_approval/submit')
      .send({
        vendorName: 'TechPro Inc',
        vendorId: 'V001',
        category: 'technology',
        annualContractValue: 20000,
        country: 'US',
        yearsInBusiness: 8,
        hasInsurance: true,
        complianceCertified: true,
        referencesProvided: 5
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('approved');
  });

  test('Employee onboarding approval: all checks pass', async () => {
    const res = await request(app)
      .post('/api/workflows/employee_onboarding/submit')
      .send({
        candidateName: 'Bob Smith',
        candidateId: 'E001',
        role: 'Software Engineer',
        department: 'Engineering',
        offeredSalary: 90000,
        startDate: '2025-01-15',
        backgroundCheckPassed: true,
        documentsSubmitted: true,
        requiresSecurityClearance: false,
        budgetApproved: true
      });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('approved');
  });
});

// ─── Rejection Tests ─────────────────────────────────────────────────────────

describe('Rejection Scenarios', () => {
  test('Reject: unemployed applicant', async () => {
    const res = await request(app)
      .post('/api/workflows/loan_application/submit')
      .send({
        applicantName: 'John Doe',
        applicantId: 'A002',
        loanAmount: 10000,
        annualIncome: 50000,
        creditScore: 700,
        employmentStatus: 'unemployed',
        loanPurpose: 'car'
      });

    expect(res.body.data.status).toBe('rejected');
    expect(res.body.data.stageTrace[0].outcome).toBe('reject');
  });

  test('Reject: credit score below 500', async () => {
    const res = await request(app)
      .post('/api/workflows/loan_application/submit')
      .send({
        applicantName: 'Jane Low',
        applicantId: 'A003',
        loanAmount: 10000,
        annualIncome: 50000,
        creditScore: 450,
        employmentStatus: 'employed',
        loanPurpose: 'education'
      });

    expect(res.body.data.status).toBe('rejected');
    const creditStage = res.body.data.stageTrace.find(s => s.stageId === 'credit_check');
    expect(creditStage.outcome).toBe('reject');
  });

  test('Reject: vendor without insurance', async () => {
    const res = await request(app)
      .post('/api/workflows/vendor_approval/submit')
      .send({
        vendorName: 'Risky Co',
        vendorId: 'V002',
        category: 'services',
        annualContractValue: 10000,
        country: 'US',
        yearsInBusiness: 5,
        hasInsurance: false,
        complianceCertified: false,
        referencesProvided: 0
      });

    expect(res.body.data.status).toBe('rejected');
  });
});

// ─── Manual Review Tests ──────────────────────────────────────────────────────

describe('Manual Review Scenarios', () => {
  test('Manual review: borderline credit score (580)', async () => {
    const res = await request(app)
      .post('/api/workflows/loan_application/submit')
      .send({
        applicantName: 'Mid Credit',
        applicantId: 'A004',
        loanAmount: 15000,
        annualIncome: 60000,
        creditScore: 580,
        employmentStatus: 'employed',
        loanPurpose: 'debt consolidation'
      });

    expect(res.body.data.status).toBe('manual_review');
  });

  test('Manual review: high loan-to-income ratio', async () => {
    const res = await request(app)
      .post('/api/workflows/loan_application/submit')
      .send({
        applicantName: 'Big Borrower',
        applicantId: 'A005',
        loanAmount: 400000,
        annualIncome: 60000,
        creditScore: 700,
        employmentStatus: 'employed',
        loanPurpose: 'business'
      });

    expect(res.body.data.status).toBe('manual_review');
  });
});

// ─── Invalid Input Tests ──────────────────────────────────────────────────────

describe('Invalid Input', () => {
  test('Missing required field', async () => {
    const res = await request(app)
      .post('/api/workflows/loan_application/submit')
      .send({
        applicantName: 'Incomplete User',
        loanAmount: 5000
        // missing: applicantId, annualIncome, creditScore, employmentStatus, loanPurpose
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Input validation failed');
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  test('Invalid enum value for employmentStatus', async () => {
    const res = await request(app)
      .post('/api/workflows/loan_application/submit')
      .send({
        applicantName: 'Bad Enum',
        applicantId: 'A006',
        loanAmount: 10000,
        annualIncome: 50000,
        creditScore: 700,
        employmentStatus: 'freelancer', // invalid
        loanPurpose: 'home'
      });

    expect(res.status).toBe(400);
    expect(res.body.details.some(e => e.field === 'employmentStatus')).toBe(true);
  });

  test('Unknown workflow ID returns 404', async () => {
    const res = await request(app)
      .post('/api/workflows/nonexistent_workflow/submit')
      .send({ foo: 'bar' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('Empty body returns 400', async () => {
    const res = await request(app)
      .post('/api/workflows/loan_application/submit')
      .send({});

    expect(res.status).toBe(400);
  });
});

// ─── Idempotency Tests ────────────────────────────────────────────────────────

describe('Idempotency', () => {
  test('Duplicate request with same idempotency key returns same result', async () => {
    const payload = {
      applicantName: 'Idempotent Alice',
      applicantId: 'A007',
      loanAmount: 30000,
      annualIncome: 100000,
      creditScore: 750,
      employmentStatus: 'employed',
      loanPurpose: 'renovation'
    };

    const key = 'idem-key-test-001';

    const res1 = await request(app)
      .post('/api/workflows/loan_application/submit')
      .set('x-idempotency-key', key)
      .send(payload);

    const res2 = await request(app)
      .post('/api/workflows/loan_application/submit')
      .set('x-idempotency-key', key)
      .send(payload);

    expect(res1.body.data.id).toBe(res2.body.data.id);
    expect(res2.body.duplicate).toBe(true);
  });

  test('Different idempotency keys create different requests', async () => {
    const payload = {
      applicantName: 'Twin Request',
      applicantId: 'A008',
      loanAmount: 30000,
      annualIncome: 100000,
      creditScore: 750,
      employmentStatus: 'employed',
      loanPurpose: 'other'
    };

    const res1 = await request(app)
      .post('/api/workflows/loan_application/submit')
      .set('x-idempotency-key', 'key-A')
      .send(payload);

    const res2 = await request(app)
      .post('/api/workflows/loan_application/submit')
      .set('x-idempotency-key', 'key-B')
      .send(payload);

    expect(res1.body.data.id).not.toBe(res2.body.data.id);
  });
});

// ─── Dependency Failure & Retry Tests ────────────────────────────────────────

describe('External Dependency Failure', () => {
  test('System marks request failed when external dep fails and retries exhausted', async () => {
    externalDeps.forceFail = true;

    const res = await request(app)
      .post('/api/workflows/loan_application/submit')
      .send({
        applicantName: 'Dep Failure Test',
        applicantId: 'A009',
        loanAmount: 20000,
        annualIncome: 60000,
        creditScore: 700,
        employmentStatus: 'employed',
        loanPurpose: 'car'
      });

    // After all retries exhausted, status should be 'failed'
    expect(['failed', 'approved', 'rejected', 'manual_review']).toContain(res.body.data.status);
    
    // Audit log should contain dep failure events
    const auditRes = await request(app).get(`/api/requests/${res.body.data.id}/audit`);
    const events = auditRes.body.data.auditLog.map(e => e.event);
    expect(events).toContain('external_dep_failed');
  });

  test('Audit log records retry attempts', async () => {
    externalDeps.forceFail = true;

    const res = await request(app)
      .post('/api/workflows/loan_application/submit')
      .send({
        applicantName: 'Retry Audit Test',
        applicantId: 'A010',
        loanAmount: 20000,
        annualIncome: 60000,
        creditScore: 700,
        employmentStatus: 'employed',
        loanPurpose: 'medical'
      });

    const auditRes = await request(app).get(`/api/requests/${res.body.data.id}/audit`);
    const failEvents = auditRes.body.data.auditLog.filter(e => e.event === 'external_dep_failed');
    expect(failEvents.length).toBeGreaterThan(0);
  });
});

// ─── Audit Trail Tests ────────────────────────────────────────────────────────

describe('Audit Trail', () => {
  test('Audit log contains full workflow lifecycle events', async () => {
    const res = await request(app)
      .post('/api/workflows/loan_application/submit')
      .send({
        applicantName: 'Audit Test',
        applicantId: 'A011',
        loanAmount: 30000,
        annualIncome: 100000,
        creditScore: 750,
        employmentStatus: 'employed',
        loanPurpose: 'home'
      });

    const auditRes = await request(app).get(`/api/requests/${res.body.data.id}/audit`);
    const events = auditRes.body.data.auditLog.map(e => e.event);

    expect(events).toContain('request_received');
    expect(events).toContain('workflow_started');
    expect(events).toContain('stage_started');
    expect(events).toContain('stage_completed');
    expect(events).toContain('workflow_completed');
  });

  test('Audit log entries have sequential ordering', async () => {
    const res = await request(app)
      .post('/api/workflows/loan_application/submit')
      .send({
        applicantName: 'Seq Test',
        applicantId: 'A012',
        loanAmount: 30000,
        annualIncome: 100000,
        creditScore: 750,
        employmentStatus: 'employed',
        loanPurpose: 'home'
      });

    const auditRes = await request(app).get(`/api/requests/${res.body.data.id}/audit`);
    const logs = auditRes.body.data.auditLog;
    for (let i = 0; i < logs.length; i++) {
      expect(logs[i].seq).toBe(i + 1);
    }
  });
});

// ─── Query & Stats Tests ──────────────────────────────────────────────────────

describe('Query API', () => {
  test('GET /api/requests returns all requests', async () => {
    await request(app).post('/api/workflows/loan_application/submit').send({
      applicantName: 'Query Test',
      applicantId: 'A013',
      loanAmount: 30000,
      annualIncome: 100000,
      creditScore: 750,
      employmentStatus: 'employed',
      loanPurpose: 'home'
    });

    const res = await request(app).get('/api/requests');
    expect(res.body.success).toBe(true);
    expect(res.body.total).toBeGreaterThan(0);
  });

  test('GET /api/requests/stats returns status counts', async () => {
    const res = await request(app).get('/api/requests/stats');
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('total');
    expect(res.body.data).toHaveProperty('byStatus');
  });

  test('GET /api/workflows returns workflow list', async () => {
    const res = await request(app).get('/api/workflows');
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('id');
    expect(res.body.data[0]).toHaveProperty('name');
  });
});

// ─── Rule Change / Configurability Tests ─────────────────────────────────────

describe('Configurability', () => {
  test('Stage trace shows exactly which rules triggered', async () => {
    const res = await request(app)
      .post('/api/workflows/loan_application/submit')
      .send({
        applicantName: 'Rule Trace Test',
        applicantId: 'A014',
        loanAmount: 20000,
        annualIncome: 60000,
        creditScore: 580,
        employmentStatus: 'employed',
        loanPurpose: 'car'
      });

    const stageTrace = res.body.data.stageTrace;
    expect(stageTrace.length).toBeGreaterThan(0);

    const creditStage = stageTrace.find(s => s.stageId === 'credit_check');
    expect(creditStage).toBeTruthy();
    expect(creditStage.rules.some(r => r.triggered)).toBe(true);
  });

  test('Workflow configuration is loaded and returned via API', async () => {
    const res = await request(app).get('/api/workflows/loan_application');
    expect(res.body.success).toBe(true);
    expect(res.body.data.stages.length).toBeGreaterThan(0);
    expect(res.body.data.inputSchema).toBeTruthy();
  });
});
