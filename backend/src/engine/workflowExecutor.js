/**
 * Workflow Executor
 * Orchestrates stage-by-stage execution of a workflow definition.
 * Handles: stage execution, external deps, retries, audit logging, final decision.
 */

const { v4: uuidv4 } = require('uuid');
const rulesEngine = require('./rulesEngine');
const externalDeps = require('./externalDeps');
const store = require('../models/store');

const STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  MANUAL_REVIEW: 'manual_review',
  FAILED: 'failed',
  RETRYING: 'retrying'
};

class WorkflowExecutor {
  /**
   * Execute a full workflow for a given request
   */
  async execute(workflowDef, inputData, requestId) {
    const stageTrace = [];
    let finalStatus = STATUS.PENDING;
    let finalDecision = null;
    let finalReason = null;

    store.appendAudit(requestId, {
      event: 'workflow_started',
      workflowId: workflowDef.id,
      workflowVersion: workflowDef.version,
      stageCount: workflowDef.stages.length
    });

    store.updateRequestStatus(requestId, STATUS.PROCESSING);

    for (const stage of workflowDef.stages) {
      store.appendAudit(requestId, { event: 'stage_started', stageId: stage.id, stageName: stage.name });

      let stageResult;

      // Handle external dependency stages with retry logic
      if (stage.externalDependency) {
        stageResult = await this._executeWithRetry(stage, inputData, requestId, workflowDef.retryConfig);
      } else {
        stageResult = rulesEngine.evaluateStage(stage, inputData);
      }

      stageTrace.push(stageResult);

      store.appendAudit(requestId, {
        event: 'stage_completed',
        stageId: stage.id,
        outcome: stageResult.outcome,
        action: stageResult.action,
        message: stageResult.message,
        rulesEvaluated: stageResult.rules?.length || 0,
        rulesTriggered: stageResult.rules?.filter(r => r.triggered).length || 0
      });

      // Hard stop on rejection
      if (stageResult.outcome === 'reject') {
        finalStatus = STATUS.REJECTED;
        finalDecision = 'rejected';
        finalReason = stageResult.message;
        break;
      }

      // Stage-level failure (external dep failed after retries)
      if (stageResult.outcome === 'failed') {
        finalStatus = STATUS.FAILED;
        finalDecision = 'failed';
        finalReason = stageResult.message;
        break;
      }

      // Accumulate manual_review flags but continue evaluation
      if (stageResult.outcome === 'manual_review' && finalStatus !== STATUS.REJECTED) {
        finalStatus = STATUS.MANUAL_REVIEW;
        finalDecision = 'manual_review';
        finalReason = stageResult.message;
      }

      // Explicit approve from a stage
      if (stageResult.outcome === 'approve' && finalStatus === STATUS.PENDING) {
        finalStatus = STATUS.APPROVED;
        finalDecision = 'approved';
        finalReason = stageResult.message;
      }
    }

    // If we reached the end without a hard decision
    if (finalStatus === STATUS.PENDING || finalStatus === STATUS.PROCESSING) {
      finalStatus = STATUS.APPROVED;
      finalDecision = 'approved';
      finalReason = 'All stages passed — request approved';
    }

    const updatedRequest = store.updateRequestStatus(requestId, finalStatus, {
      decision: finalDecision,
      decisionReason: finalReason,
      stageTrace,
      completedAt: new Date().toISOString()
    });

    store.appendAudit(requestId, {
      event: 'workflow_completed',
      finalStatus,
      finalDecision,
      finalReason,
      stagesExecuted: stageTrace.length
    });

    return updatedRequest;
  }

  /**
   * Execute a stage with retry logic for external dependency failures
   */
  async _executeWithRetry(stage, inputData, requestId, retryConfig) {
    const maxRetries = retryConfig?.maxRetries || 3;
    const retryDelayMs = retryConfig?.retryDelayMs || 1000;
    const isRetryable = retryConfig?.retryableStages?.includes(stage.id);

    let attempt = 0;

    while (attempt <= maxRetries) {
      attempt++;

      store.appendAudit(requestId, {
        event: 'external_dep_call',
        stageId: stage.id,
        dependency: stage.externalDependency,
        attempt
      });

      const depResult = await externalDeps.call(stage.externalDependency, inputData);

      if (depResult.success) {
        store.appendAudit(requestId, {
          event: 'external_dep_success',
          stageId: stage.id,
          dependency: stage.externalDependency,
          latencyMs: depResult.latencyMs,
          attempt
        });

        // Now evaluate rules for this stage
        return rulesEngine.evaluateStage(stage, inputData);
      }

      // Dep failed
      store.appendAudit(requestId, {
        event: 'external_dep_failed',
        stageId: stage.id,
        dependency: stage.externalDependency,
        error: depResult.error,
        attempt,
        willRetry: isRetryable && attempt <= maxRetries
      });

      if (!isRetryable || attempt > maxRetries) {
        return {
          stageId: stage.id,
          stageName: stage.name,
          outcome: 'failed',
          action: 'failed',
          message: `External dependency "${stage.externalDependency}" unavailable after ${attempt} attempt(s): ${depResult.error}`,
          rules: [],
          externalDepError: depResult.error
        };
      }

      // Update request to retrying
      store.updateRequestStatus(requestId, STATUS.RETRYING, {
        retryMeta: { stage: stage.id, attempt, maxRetries }
      });

      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
    }
  }
}

module.exports = new WorkflowExecutor();
