/**
 * Workflow Registry
 * Loads all workflow configurations from JSON files.
 * Supports hot-reloading for runtime updates (no code changes needed).
 */

const fs = require('fs');
const path = require('path');

const WORKFLOWS_DIR = path.join(__dirname, 'workflows');

class WorkflowRegistry {
  constructor() {
    this.workflows = new Map();
    this.loadAll();
  }

  loadAll() {
    const files = fs.readdirSync(WORKFLOWS_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const workflow = JSON.parse(fs.readFileSync(path.join(WORKFLOWS_DIR, file), 'utf8'));
      this.workflows.set(workflow.id, workflow);
    }
    console.log(`[WorkflowRegistry] Loaded ${this.workflows.size} workflows: ${[...this.workflows.keys()].join(', ')}`);
  }

  // Reload a specific workflow (config change without restart)
  reload(workflowId) {
    const file = path.join(WORKFLOWS_DIR, `${workflowId}.json`);
    if (!fs.existsSync(file)) throw new Error(`Workflow file not found: ${workflowId}.json`);
    const workflow = JSON.parse(fs.readFileSync(file, 'utf8'));
    this.workflows.set(workflow.id, workflow);
    return workflow;
  }

  get(workflowId) {
    const wf = this.workflows.get(workflowId);
    if (!wf) throw new Error(`Unknown workflow: ${workflowId}`);
    return wf;
  }

  list() {
    return Array.from(this.workflows.values()).map(w => ({
      id: w.id,
      name: w.name,
      description: w.description,
      version: w.version,
      stages: w.stages.map(s => ({ id: s.id, name: s.name, type: s.type }))
    }));
  }

  exists(workflowId) {
    return this.workflows.has(workflowId);
  }
}

module.exports = new WorkflowRegistry();
