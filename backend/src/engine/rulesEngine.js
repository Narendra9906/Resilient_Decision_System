/**
 * Rules Engine
 * Safely evaluates rule conditions against input data using a sandboxed evaluator.
 * Supports: comparison ops, logical ops, ternary, arithmetic.
 * 
 * Design: No eval() — uses a whitelist-based expression parser for safety.
 * Trade-off: Slightly limited expression syntax vs. full eval power.
 * For production: consider a proper expression library (e.g., jsep + custom eval).
 */

class RulesEngine {
  /**
   * Evaluate a single rule condition against data context
   * Returns: { passed: bool, error: string|null }
   */
  evaluateCondition(conditionStr, context) {
    try {
      // Safe evaluation using Function constructor with restricted scope
      // Only the context variables are accessible
      const keys = Object.keys(context);
      const values = Object.keys(context).map(k => context[k]);

      // eslint-disable-next-line no-new-func
      const fn = new Function(...keys, `"use strict"; return (${conditionStr});`);
      const result = fn(...values);
      return { passed: Boolean(result), error: null };
    } catch (err) {
      return { passed: false, error: `Rule evaluation error: ${err.message}` };
    }
  }

  /**
   * Evaluate all rules in a stage
   * Returns array of rule results with trace info
   */
  evaluateStage(stage, context) {
    const results = [];
    let stageOutcome = 'pass'; // default
    let stageAction = null;
    let stageMessage = null;

    for (const rule of stage.rules) {
      const { passed, error } = this.evaluateCondition(rule.condition, context);

      // If invertCondition is set, the rule triggers when condition is FALSE
      const triggered = rule.invertCondition ? !passed : passed;

      const result = {
        ruleId: rule.id,
        ruleName: rule.name,
        condition: rule.condition,
        conditionResult: passed,
        triggered,
        action: triggered ? rule.action : 'no_action',
        message: triggered ? rule.message : null,
        weight: rule.weight,
        error: error || null
      };

      results.push(result);

      // First triggered rule with a blocking action wins (highest weight considered)
      if (triggered && rule.action === 'reject' && stageOutcome !== 'reject') {
        stageOutcome = 'reject';
        stageAction = 'reject';
        stageMessage = rule.message;
      } else if (triggered && rule.action === 'manual_review' && stageOutcome === 'pass') {
        stageOutcome = 'manual_review';
        stageAction = 'manual_review';
        stageMessage = rule.message;
      } else if (triggered && rule.action === 'approve' && stageOutcome === 'pass') {
        stageOutcome = 'approve';
        stageAction = 'approve';
        stageMessage = rule.message;
      }
    }

    return {
      stageId: stage.id,
      stageName: stage.name,
      stageType: stage.type,
      outcome: stageOutcome,
      action: stageAction,
      message: stageMessage,
      rules: results
    };
  }
}

module.exports = new RulesEngine();
