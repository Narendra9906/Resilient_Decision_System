# Configurable Workflow Decision Platform

A production-grade, configurable workflow decision engine built with Node.js (Express) and React.

<img width="1829" height="841" alt="image" src="https://github.com/user-attachments/assets/bc87991c-87c2-45ea-84bc-3e9546bd03ff" />
<img width="1813" height="829" alt="image" src="https://github.com/user-attachments/assets/85f8e4a4-3827-4f37-a0cc-4bd7bf5a427a" />
<img width="1824" height="829" alt="image" src="https://github.com/user-attachments/assets/036b3f9e-135c-4d62-b28d-864a13fd334e" />





## Quick Start

### Prerequisites
- Node.js >= 16
- npm >= 8

### 1. Start the Backend

```bash
cd backend
npm install
npm start
# API running at http://localhost:3001
```

### 2. Start the Frontend

```bash
cd frontend
npm install
npm start
# UI running at http://localhost:3000
```

### 3. Run Tests

```bash
cd backend
npm test
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     React Frontend                       │
│   Dashboard | Submit Form | Stage Trace | Audit Log     │
└─────────────────────┬───────────────────────────────────┘
                      │ REST API
┌─────────────────────▼───────────────────────────────────┐
│                  Express API Layer                        │
│    POST /api/workflows/:id/submit                        │
│    GET  /api/requests/:id/audit                         │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                Workflow Service                          │
│   Idempotency → Validation → Execution → Audit          │
└───────┬──────────────────────────────────────┬──────────┘
        │                                      │
┌───────▼──────────┐              ┌────────────▼──────────┐
│  Rules Engine    │              │  External Dep Sim      │
│  Stage-by-stage  │              │  Retries + Audit       │
│  condition eval  │              │  credit_bureau etc.    │
└──────────────────┘              └───────────────────────┘
        │
┌───────▼──────────────────────────────────────────────────┐
│              Workflow Registry                            │
│   loan_application.json | vendor_approval.json | ...     │
│   Hot-reloadable — no restart needed                     │
└──────────────────────────────────────────────────────────┘
```

---

## REST API Reference

### Submit a Request
```
POST /api/workflows/:workflowId/submit
Headers:
  Content-Type: application/json
  x-idempotency-key: <optional unique key>
Body: { ...workflow-specific fields }
```

### List All Requests
```
GET /api/requests?workflowId=loan_application&status=approved
```

### Get Request + Stage Trace
```
GET /api/requests/:requestId
```

### Get Full Audit Log
```
GET /api/requests/:requestId/audit
```

### Get Stats
```
GET /api/requests/stats
```

### List Workflows
```
GET /api/workflows
```

---

## Example: Loan Application

```bash
curl -X POST http://localhost:3001/api/workflows/loan_application/submit \
  -H "Content-Type: application/json" \
  -H "x-idempotency-key: user-123-loan-001" \
  -d '{
    "applicantName": "Alice Chen",
    "applicantId": "A001",
    "loanAmount": 30000,
    "annualIncome": 100000,
    "creditScore": 750,
    "employmentStatus": "employed",
    "loanPurpose": "Home renovation"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "uuid...",
    "status": "approved",
    "decision": "approved",
    "decisionReason": "Meets auto-approval criteria: strong credit and conservative loan ratio",
    "stageTrace": [...]
  }
}
```

---

## Adding a New Workflow

1. Create `backend/src/config/workflows/my_workflow.json`
2. Define `id`, `inputSchema`, `stages`, `retryConfig`
3. Restart the server (or call `workflowRegistry.reload('my_workflow')`)
4. POST to `/api/workflows/my_workflow/submit`

No code changes required.

---

## Supported Workflows

| ID | Name | Stages |
|----|------|--------|
| `loan_application` | Loan Application Workflow | Input Validation → Credit Check → DTI Check → Risk Scoring → Final Decision |
| `vendor_approval` | Vendor Approval Workflow | Eligibility → Compliance → Risk Assessment → Final Decision |
| `employee_onboarding` | Employee Onboarding Workflow | Documents → Background Check → Budget → Security Clearance → Final Decision |

---

## Key Design Decisions

- **Rules as data**: All rules live in JSON — no deploys for rule changes
- **Idempotency via header**: `x-idempotency-key` prevents duplicate processing
- **Sequential stage execution**: Each stage can short-circuit (reject) or flag for review
- **Retry with audit**: Every retry attempt is logged with attempt number and error
- **In-memory store**: Swappable with any database by replacing `store.js`

---

## Scaling Considerations

- Replace `InMemoryStore` with PostgreSQL/MongoDB for persistence
- Use Redis for idempotency key storage (TTL + distributed)
- Run multiple API instances behind a load balancer
- Move workflow execution to a job queue (Bull/BullMQ) for async processing
- Add rate limiting per client to prevent queue flooding
