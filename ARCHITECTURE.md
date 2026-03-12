# Architecture Document: Configurable Workflow Decision Platform

## 1. System Overview

The platform is a configurable, rules-driven workflow engine. Incoming requests go through
configurable multi-stage evaluation pipelines, producing traceable decisions (approve/reject/manual_review)
with full audit trails.

---

## 2. Component Breakdown

### 2.1 API Layer (`routes/`)
- Thin Express routers — no business logic
- Receives HTTP requests, delegates to WorkflowService
- Returns structured JSON responses

### 2.2 WorkflowService (`services/workflowService.js`)
- Top-level orchestrator
- Responsibilities: idempotency check, schema validation, execution dispatch, error handling
- Returns a consistent result shape regardless of outcome

### 2.3 WorkflowRegistry (`config/workflowRegistry.js`)
- Reads workflow definitions from JSON files at startup
- Supports hot-reload per workflow ID (no server restart required)
- Single source of truth for all workflow configurations

### 2.4 InputValidator (`engine/inputValidator.js`)
- Validates request against workflow's `inputSchema`
- Applies defaults for optional fields
- Type coercion (string → number, string → boolean)

### 2.5 RulesEngine (`engine/rulesEngine.js`)
- Evaluates boolean conditions using sandboxed Function constructor
- Each rule returns: conditionResult, triggered, action, message
- Stage-level outcome = highest-priority triggered action (reject > manual_review > approve > pass)

### 2.6 WorkflowExecutor (`engine/workflowExecutor.js`)
- Iterates through workflow stages sequentially
- Calls RulesEngine per stage
- Calls ExternalDependencySimulator for stages with `externalDependency`
- Implements retry loop with configurable maxRetries and delay
- Writes audit entries at each lifecycle event

### 2.7 ExternalDependencySimulator (`engine/externalDeps.js`)
- Simulates real third-party APIs (credit bureaus, compliance registries, etc.)
- Configurable failure rate (15% for credit bureau, 10% for compliance registry)
- Deterministic in test mode (NODE_ENV=test), random in dev/prod
- Records call history for debugging

### 2.8 InMemoryStore (`models/store.js`)
- Singleton in-memory store (Map-based)
- Holds: requests, audit logs, idempotency registry
- Designed for easy replacement with a persistent DB (same interface)

---

## 3. Data Flow

```
Client Request
    │
    ▼
POST /api/workflows/:id/submit
    │
    ▼
WorkflowService.submit()
    │
    ├─ 1. Lookup workflow in WorkflowRegistry
    ├─ 2. Check idempotency key (return cached if duplicate)
    ├─ 3. Validate input against schema
    ├─ 4. Create request record (status: pending)
    ├─ 5. Register idempotency key
    ├─ 6. Audit: request_received
    │
    ▼
WorkflowExecutor.execute()
    │
    ├─ For each stage in workflow:
    │   ├─ Audit: stage_started
    │   ├─ If externalDependency:
    │   │   ├─ Call ExternalDep.call(serviceId)
    │   │   ├─ If fail + retryable: retry up to maxRetries
    │   │   └─ If all retries fail: stage outcome = 'failed'
    │   ├─ Else: RulesEngine.evaluateStage(stage, inputData)
    │   ├─ Audit: stage_completed (with rule trace)
    │   ├─ If outcome = 'reject': break loop
    │   └─ If outcome = 'manual_review': flag, continue
    │
    ▼
Final decision resolution:
    ├─ reject → status: rejected
    ├─ failed → status: failed
    ├─ manual_review (any stage) → status: manual_review
    ├─ approve (final stage) → status: approved
    └─ all stages pass → status: approved
    │
    ▼
Store final request state + Audit: workflow_completed
    │
    ▼
Return response to client
```

---

## 4. Workflow Configuration Model

A workflow is a JSON file with this structure:

```json
{
  "id": "unique_workflow_id",
  "name": "Human-readable name",
  "version": "1.0.0",
  "inputSchema": {
    "required": ["field1", "field2"],
    "properties": {
      "field1": { "type": "string" },
      "field2": { "type": "number", "min": 0, "max": 1000 },
      "field3": { "type": "boolean", "default": false }
    }
  },
  "stages": [
    {
      "id": "stage_id",
      "name": "Stage Name",
      "type": "validation|scoring|threshold|conditional|decision",
      "externalDependency": "service_name (optional)",
      "rules": [
        {
          "id": "rule_id",
          "name": "Rule Name",
          "condition": "field2 > 100 && field3 === false",
          "action": "reject|manual_review|approve|pass",
          "message": "Human-readable explanation",
          "weight": 100
        }
      ]
    }
  ],
  "retryConfig": {
    "maxRetries": 3,
    "retryDelayMs": 2000,
    "retryableStages": ["stage_id"]
  }
}
```

### Rule Semantics
- `condition` is a JavaScript boolean expression evaluated in a sandboxed scope
- When `condition` evaluates to `true`, the `action` is triggered
- Rules are evaluated in order; first `reject` wins; `manual_review` accumulates
- No `invertCondition` needed — write conditions that trigger the action directly

### Stage Types
| Type | Purpose |
|------|---------|
| `validation` | Hard gates — failure causes immediate rejection |
| `scoring` | Soft checks — can flag for review without rejecting |
| `threshold` | Numeric boundary checks |
| `conditional` | Context-dependent branching |
| `decision` | Final auto-approve logic |

---

## 5. Idempotency

Idempotency is implemented at the service layer:
1. Client sends `x-idempotency-key` header (UUID or meaningful string)
2. Before execution, check if key exists in `idempotencyKeys` map
3. If found: return cached result immediately (no re-execution)
4. If not found: register key BEFORE execution (prevents race conditions)
5. Duplicate request is flagged in response and audit log

This ensures safe retries from clients without double-processing.

---

## 6. Audit Trail

Every significant event is recorded as an immutable, sequentially-numbered log entry:

| Event | Data |
|-------|------|
| `request_received` | workflowId, idempotencyKey, inputFields |
| `workflow_started` | workflowId, version, stageCount |
| `stage_started` | stageId, stageName |
| `external_dep_call` | dependency, attempt |
| `external_dep_success` | dependency, latencyMs |
| `external_dep_failed` | dependency, error, willRetry |
| `stage_completed` | outcome, action, rulesEvaluated, rulesTriggered |
| `duplicate_request_detected` | idempotencyKey |
| `workflow_completed` | finalStatus, finalDecision, stagesExecuted |
| `workflow_error` | error message |

---

## 7. Error Handling

| Scenario | Handling |
|----------|---------|
| Invalid input | Validate before execution, return 400 with field-level errors |
| Unknown workflow | Return 404 before creating request record |
| External dep failure | Retry up to maxRetries with delay; then mark stage/request as failed |
| Partial stage failure | Stage trace preserved; remaining stages skip if hard failure |
| Duplicate request | Idempotency check returns cached result; no re-execution |
| Rule eval error | Captured per-rule, stage continues; error logged in trace |
| Uncaught exception | Global handler returns 500; request marked failed |

---

## 8. Trade-offs and Assumptions

### Trade-off: In-memory vs. Persistent Storage
- **Choice**: In-memory store (Map-based singleton)
- **Why**: Simplicity for hackathon context; zero dependencies
- **Production path**: Replace `store.js` with identical interface backed by PostgreSQL
- **Risk**: Data loss on restart — acceptable for demo, not production

### Trade-off: Sandboxed Function() for Rule Evaluation
- **Choice**: `new Function(...keys, condition)` with context injection
- **Why**: Supports full JS expression syntax without a third-party library
- **Risk**: Function constructor can execute arbitrary code if condition is attacker-controlled
- **Mitigation**: In production, use a proper expression library (jsep, filtrex, or JSON Rules Engine)
- **Alternative considered**: JSON-based condition objects — safer but much less expressive

### Trade-off: Sequential Stage Execution vs. Parallel
- **Choice**: Sequential (each stage can short-circuit)
- **Why**: Natural for approval workflows where early rejection prevents unnecessary external calls
- **Trade-off**: Slower for workflows where stages are independent
- **Extension**: Add `parallel: true` flag to stage config for independent stages

### Trade-off: Synchronous API Response vs. Async Job Queue
- **Choice**: Synchronous — execute workflow during HTTP request
- **Why**: Simplest client model; no polling needed
- **Risk**: Long workflows or slow external deps can timeout HTTP connections
- **Production path**: Return `requestId` immediately, push to job queue, client polls `/requests/:id`

### Assumption: Single-tenant
- All requests share one in-memory store
- Production would namespace by tenant/org

---

## 9. Scaling Considerations

| Concern | Solution |
|---------|---------|
| Persistence | Replace InMemoryStore with PostgreSQL (transactions for idempotency) |
| Distributed idempotency | Use Redis with TTL-based key expiry |
| High throughput | Move execution to BullMQ job queue with worker pool |
| Workflow hot-reload | File watcher on config directory or admin API endpoint |
| External dep reliability | Circuit breaker pattern (e.g., opossum library) |
| Observability | Emit audit events to event bus (Kafka/SQS) for analytics |
| Horizontal scaling | Stateless API servers + shared DB + Redis for idempotency |
