import React, { useState, useEffect, useCallback } from 'react';

const API = '/api';

// ─── Utilities ───────────────────────────────────────────────────────────────
const api = {
  get: (path) => fetch(`${API}${path}`).then(r => r.json()),
  post: (path, body, headers = {}) => fetch(`${API}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body)
  }).then(r => r.json())
};

const STATUS_COLOR = {
  approved: '#00d4aa',
  rejected: '#ff4757',
  manual_review: '#ffa502',
  failed: '#ff6b35',
  processing: '#5352ed',
  retrying: '#eccc68',
  pending: '#747d8c'
};

const STATUS_ICON = {
  approved: '✓', rejected: '✗', manual_review: '⚠', failed: '!', processing: '⟳', pending: '○', retrying: '↺'
};

// ─── Components ──────────────────────────────────────────────────────────────

function Badge({ status }) {
  const color = STATUS_COLOR[status] || '#747d8c';
  return (
    <span style={{
      background: color + '22', color, border: `1px solid ${color}44`,
      padding: '2px 10px', borderRadius: '3px', fontSize: '11px',
      fontFamily: "'IBM Plex Mono', monospace", fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px'
    }}>
      {STATUS_ICON[status]} {status?.replace('_', ' ')}
    </span>
  );
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      background: '#0d1117', border: '1px solid #21262d',
      borderRadius: '8px', padding: '20px', ...style
    }}>
      {children}
    </div>
  );
}

function StatBox({ label, value, color = '#c9d1d9' }) {
  return (
    <div style={{
      background: '#0d1117', border: '1px solid #21262d', borderRadius: '8px',
      padding: '16px 20px', flex: 1
    }}>
      <div style={{ fontSize: '28px', fontWeight: 600, color, fontFamily: "'IBM Plex Mono', monospace" }}>{value ?? 0}</div>
      <div style={{ fontSize: '12px', color: '#8b949e', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{label}</div>
    </div>
  );
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

function Dashboard({ requests, stats, onSelect }) {
  const s = stats?.byStatus || {};
  return (
    <div>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <StatBox label="Total Requests" value={stats?.total} color="#c9d1d9" />
        <StatBox label="Approved" value={s.approved} color={STATUS_COLOR.approved} />
        <StatBox label="Rejected" value={s.rejected} color={STATUS_COLOR.rejected} />
        <StatBox label="Manual Review" value={s.manual_review} color={STATUS_COLOR.manual_review} />
        <StatBox label="Failed" value={s.failed} color={STATUS_COLOR.failed} />
      </div>

      <Card>
        <div style={{ fontSize: '13px', color: '#8b949e', marginBottom: '16px', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Recent Requests
        </div>
        {requests.length === 0 ? (
          <div style={{ color: '#8b949e', textAlign: 'center', padding: '40px', fontSize: '14px' }}>
            No requests yet. Submit a workflow above to get started.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #21262d' }}>
                {['Request ID', 'Workflow', 'Status', 'Decision Reason', 'Submitted'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#8b949e', fontWeight: 500, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {requests.map(r => (
                <tr key={r.id} onClick={() => onSelect(r)} style={{ borderBottom: '1px solid #161b22', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#161b22'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '10px 12px', fontFamily: "'IBM Plex Mono', monospace", color: '#58a6ff', fontSize: '12px' }}>
                    {r.id.slice(0, 8)}…
                  </td>
                  <td style={{ padding: '10px 12px', color: '#c9d1d9' }}>{r.workflowName}</td>
                  <td style={{ padding: '10px 12px' }}><Badge status={r.status} /></td>
                  <td style={{ padding: '10px 12px', color: '#8b949e', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.decisionReason || '—'}
                  </td>
                  <td style={{ padding: '10px 12px', color: '#8b949e', fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px' }}>
                    {new Date(r.createdAt).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

// ─── Submit Form ─────────────────────────────────────────────────────────────

const SAMPLE_INPUTS = {
  loan_application: {
    approved: { applicantName: 'Alice Chen', applicantId: 'A001', loanAmount: 30000, annualIncome: 100000, creditScore: 750, employmentStatus: 'employed', loanPurpose: 'Home renovation', existingDebt: 5000, collateralValue: 0 },
    rejected: { applicantName: 'Bob Low', applicantId: 'A002', loanAmount: 10000, annualIncome: 50000, creditScore: 420, employmentStatus: 'employed', loanPurpose: 'Car', existingDebt: 0, collateralValue: 0 },
    manual_review: { applicantName: 'Carol Mid', applicantId: 'A003', loanAmount: 20000, annualIncome: 60000, creditScore: 580, employmentStatus: 'employed', loanPurpose: 'Education', existingDebt: 2000, collateralValue: 0 }
  },
  vendor_approval: {
    approved: { vendorName: 'TechPro Inc', vendorId: 'V001', category: 'technology', annualContractValue: 20000, country: 'US', yearsInBusiness: 8, hasInsurance: true, complianceCertified: true, referencesProvided: 5 },
    rejected: { vendorName: 'New Startup', vendorId: 'V002', category: 'services', annualContractValue: 10000, country: 'US', yearsInBusiness: 1, hasInsurance: false, complianceCertified: false, referencesProvided: 0 },
    manual_review: { vendorName: 'BigCorp Ltd', vendorId: 'V003', category: 'manufacturing', annualContractValue: 200000, country: 'DE', yearsInBusiness: 10, hasInsurance: true, complianceCertified: true, referencesProvided: 2 }
  },
  employee_onboarding: {
    approved: { candidateName: 'David Park', candidateId: 'E001', role: 'Software Engineer', department: 'Engineering', offeredSalary: 95000, startDate: '2025-02-01', backgroundCheckPassed: true, documentsSubmitted: true, requiresSecurityClearance: false, budgetApproved: true },
    rejected: { candidateName: 'Eve Fail', candidateId: 'E002', role: 'Analyst', department: 'Finance', offeredSalary: 60000, startDate: '2025-02-15', backgroundCheckPassed: false, documentsSubmitted: false, requiresSecurityClearance: false, budgetApproved: true },
    manual_review: { candidateName: 'Frank Secure', candidateId: 'E003', role: 'Security Analyst', department: 'IT', offeredSalary: 85000, startDate: '2025-03-01', backgroundCheckPassed: true, documentsSubmitted: true, requiresSecurityClearance: true, budgetApproved: true }
  }
};

function SubmitForm({ workflows, onSubmit, loading }) {
  const [workflowId, setWorkflowId] = useState('loan_application');
  const [jsonInput, setJsonInput] = useState(JSON.stringify(SAMPLE_INPUTS.loan_application.approved, null, 2));
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [error, setError] = useState(null);

  const loadSample = (outcome) => {
    const sample = SAMPLE_INPUTS[workflowId]?.[outcome];
    if (sample) setJsonInput(JSON.stringify(sample, null, 2));
  };

  const handleSubmit = async () => {
    setError(null);
    let parsed;
    try { parsed = JSON.parse(jsonInput); }
    catch (e) { setError('Invalid JSON: ' + e.message); return; }
    onSubmit(workflowId, parsed, idempotencyKey || null);
  };

  return (
    <Card>
      <div style={{ fontSize: '13px', color: '#8b949e', marginBottom: '16px', fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Submit Workflow Request
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={{ display: 'block', fontSize: '11px', color: '#8b949e', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Workflow</label>
          <select value={workflowId} onChange={e => { setWorkflowId(e.target.value); setJsonInput(JSON.stringify(SAMPLE_INPUTS[e.target.value]?.approved || {}, null, 2)); }}
            style={{ width: '100%', background: '#161b22', border: '1px solid #30363d', borderRadius: '6px', color: '#c9d1d9', padding: '8px 12px', fontSize: '14px' }}>
            {workflows.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={{ display: 'block', fontSize: '11px', color: '#8b949e', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Idempotency Key (optional)</label>
          <input value={idempotencyKey} onChange={e => setIdempotencyKey(e.target.value)}
            placeholder="e.g. user-123-loan-request-1"
            style={{ width: '100%', boxSizing: 'border-box', background: '#161b22', border: '1px solid #30363d', borderRadius: '6px', color: '#c9d1d9', padding: '8px 12px', fontSize: '14px', fontFamily: "'IBM Plex Mono', monospace" }} />
        </div>
      </div>

      <div style={{ marginBottom: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Load Sample:</span>
        {['approved', 'rejected', 'manual_review'].map(o => (
          <button key={o} onClick={() => loadSample(o)} style={{
            background: STATUS_COLOR[o] + '22', border: `1px solid ${STATUS_COLOR[o]}44`, color: STATUS_COLOR[o],
            padding: '3px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px',
            fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase'
          }}>{o.replace('_', ' ')}</button>
        ))}
      </div>

      <textarea value={jsonInput} onChange={e => setJsonInput(e.target.value)} rows={14}
        style={{ width: '100%', boxSizing: 'border-box', background: '#161b22', border: '1px solid #30363d', borderRadius: '6px', color: '#c9d1d9', padding: '12px', fontSize: '13px', fontFamily: "'IBM Plex Mono', monospace", lineHeight: '1.6', resize: 'vertical' }} />

      {error && <div style={{ color: STATUS_COLOR.rejected, fontSize: '13px', marginTop: '8px', fontFamily: "'IBM Plex Mono', monospace' " }}>⚠ {error}</div>}

      <button onClick={handleSubmit} disabled={loading} style={{
        marginTop: '12px', background: loading ? '#21262d' : '#1f6feb', border: 'none', borderRadius: '6px',
        color: '#fff', padding: '10px 24px', fontSize: '14px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 500
      }}>
        {loading ? '⟳ Processing...' : '→ Submit Request'}
      </button>
    </Card>
  );
}

// ─── Request Detail ───────────────────────────────────────────────────────────

function RequestDetail({ request, auditLog, onBack }) {
  const [tab, setTab] = useState('trace');

  if (!request) return null;

  return (
    <div>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#58a6ff', cursor: 'pointer', fontSize: '14px', marginBottom: '16px', padding: 0 }}>
        ← Back to Dashboard
      </button>

      <Card style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '12px', color: '#8b949e', fontFamily: "'IBM Plex Mono', monospace", marginBottom: '4px' }}>{request.id}</div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#c9d1d9', marginBottom: '6px' }}>{request.workflowName}</div>
            <Badge status={request.status} />
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '13px', color: '#8b949e', marginBottom: '4px' }}>Submitted: {new Date(request.createdAt).toLocaleString()}</div>
            {request.completedAt && <div style={{ fontSize: '13px', color: '#8b949e' }}>Completed: {new Date(request.completedAt).toLocaleString()}</div>}
          </div>
        </div>
        {request.decisionReason && (
          <div style={{ marginTop: '12px', padding: '10px 14px', background: `${STATUS_COLOR[request.status]}11`, border: `1px solid ${STATUS_COLOR[request.status]}33`, borderRadius: '6px', fontSize: '13px', color: STATUS_COLOR[request.status] }}>
            {request.decisionReason}
          </div>
        )}
      </Card>

      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
        {['trace', 'input', 'audit'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: tab === t ? '#1f6feb' : '#21262d', border: '1px solid #30363d',
            color: tab === t ? '#fff' : '#8b949e', padding: '6px 16px', borderRadius: '6px',
            cursor: 'pointer', fontSize: '13px', textTransform: 'capitalize'
          }}>{t === 'trace' ? 'Stage Trace' : t === 'input' ? 'Input Data' : 'Audit Log'}</button>
        ))}
      </div>

      {tab === 'trace' && <StageTrace stages={request.stageTrace || []} />}
      {tab === 'input' && (
        <Card>
          <pre style={{ color: '#c9d1d9', fontSize: '13px', fontFamily: "'IBM Plex Mono', monospace", lineHeight: '1.6', margin: 0, overflow: 'auto' }}>
            {JSON.stringify(request.inputData, null, 2)}
          </pre>
        </Card>
      )}
      {tab === 'audit' && <AuditLog entries={auditLog} />}
    </div>
  );
}

function StageTrace({ stages }) {
  const [expanded, setExpanded] = useState(new Set([0]));
  const toggle = i => {
    const next = new Set(expanded);
    next.has(i) ? next.delete(i) : next.add(i);
    setExpanded(next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {stages.map((stage, i) => (
        <Card key={stage.stageId} style={{ cursor: 'pointer' }}>
          <div onClick={() => toggle(i)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#8b949e' }}>STAGE {i + 1}</span>
              <span style={{ color: '#c9d1d9', fontSize: '14px', fontWeight: 500 }}>{stage.stageName}</span>
              <span style={{ fontSize: '11px', color: '#8b949e', background: '#21262d', padding: '1px 6px', borderRadius: '3px' }}>{stage.stageType}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Badge status={stage.outcome === 'pass' ? 'approved' : stage.outcome} />
              <span style={{ color: '#8b949e', fontSize: '12px' }}>{expanded.has(i) ? '▲' : '▼'}</span>
            </div>
          </div>

          {expanded.has(i) && (
            <div style={{ marginTop: '14px', borderTop: '1px solid #21262d', paddingTop: '14px' }}>
              {stage.message && (
                <div style={{ fontSize: '13px', color: '#8b949e', marginBottom: '12px', fontStyle: 'italic' }}>"{stage.message}"</div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {(stage.rules || []).map(rule => (
                  <div key={rule.ruleId} style={{
                    padding: '10px 12px', borderRadius: '6px',
                    background: rule.triggered ? `${STATUS_COLOR[rule.action === 'no_action' ? 'pending' : rule.action]}11` : '#161b22',
                    border: `1px solid ${rule.triggered ? STATUS_COLOR[rule.action === 'no_action' ? 'pending' : rule.action] + '33' : '#21262d'}`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 500, color: rule.triggered ? '#c9d1d9' : '#8b949e' }}>{rule.ruleName}</span>
                      <span style={{ fontSize: '11px', fontFamily: "'IBM Plex Mono', monospace", color: rule.triggered ? STATUS_COLOR[rule.action] || '#c9d1d9' : '#8b949e' }}>
                        {rule.triggered ? `▶ ${rule.action}` : '— not triggered'}
                      </span>
                    </div>
                    <code style={{ fontSize: '11px', color: '#79c0ff', fontFamily: "'IBM Plex Mono', monospace" }}>{rule.condition}</code>
                    {rule.triggered && rule.message && (
                      <div style={{ fontSize: '12px', color: '#8b949e', marginTop: '4px' }}>{rule.message}</div>
                    )}
                    {rule.error && <div style={{ fontSize: '11px', color: STATUS_COLOR.rejected, marginTop: '4px' }}>Error: {rule.error}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

function AuditLog({ entries }) {
  return (
    <Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
        {entries.map((entry, i) => (
          <div key={i} style={{ display: 'flex', gap: '16px', padding: '8px 0', borderBottom: '1px solid #161b22' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#8b949e', whiteSpace: 'nowrap', minWidth: '160px' }}>
              <div>{new Date(entry.timestamp).toLocaleTimeString()}</div>
              <div style={{ color: '#30363d' }}>#{entry.seq}</div>
            </div>
            <div>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', color: '#58a6ff', background: '#1f6feb22', padding: '1px 6px', borderRadius: '3px' }}>
                {entry.event}
              </span>
              <div style={{ fontSize: '12px', color: '#8b949e', marginTop: '4px' }}>
                {Object.entries(entry)
                  .filter(([k]) => !['event', 'timestamp', 'seq'].includes(k))
                  .map(([k, v]) => (
                    <span key={k} style={{ marginRight: '12px' }}>
                      <span style={{ color: '#79c0ff' }}>{k}</span>=<span style={{ color: '#a5d6ff' }}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                    </span>
                  ))
                }
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── Workflows List ───────────────────────────────────────────────────────────

function WorkflowsList({ workflows }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {workflows.map(wf => (
        <Card key={wf.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div>
              <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', color: '#8b949e', marginBottom: '4px' }}>{wf.id} · v{wf.version || '1.0.0'}</div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#c9d1d9' }}>{wf.name}</div>
              <div style={{ fontSize: '13px', color: '#8b949e', marginTop: '4px' }}>{wf.description}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {(wf.stages || []).map((s, i) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {i > 0 && <span style={{ color: '#30363d' }}>→</span>}
                <span style={{ background: '#161b22', border: '1px solid #21262d', borderRadius: '4px', padding: '3px 8px', fontSize: '12px', color: '#8b949e' }}>
                  {s.name}
                </span>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView] = useState('dashboard');
  const [workflows, setWorkflows] = useState([]);
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({});
  const [selected, setSelected] = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, color = '#00d4aa') => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 3500);
  };

  const refresh = useCallback(async () => {
    const [wfRes, reqRes, statRes] = await Promise.all([
      api.get('/workflows'), api.get('/requests'), api.get('/requests/stats')
    ]);
    if (wfRes.success) setWorkflows(wfRes.data);
    if (reqRes.success) setRequests(reqRes.data);
    if (statRes.success) setStats(statRes.data);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleSubmit = async (workflowId, data, idempotencyKey) => {
    setLoading(true);
    const headers = idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : {};
    const res = await api.post(`/workflows/${workflowId}/submit`, data, headers);
    setLoading(false);

    if (res.success) {
      const status = res.data.status;
      const color = STATUS_COLOR[status] || '#c9d1d9';
      showToast(`${res.duplicate ? 'Duplicate detected — ' : ''}Decision: ${status.toUpperCase()}`, color);
      await refresh();
      const auditRes = await api.get(`/requests/${res.data.id}/audit`);
      setSelected(res.data);
      setAuditLog(auditRes.data?.auditLog || []);
      setView('detail');
    } else {
      showToast(`Error: ${res.error}`, STATUS_COLOR.rejected);
    }
  };

  const handleSelect = async (req) => {
    const auditRes = await api.get(`/requests/${req.id}/audit`);
    setSelected(req);
    setAuditLog(auditRes.data?.auditLog || []);
    setView('detail');
  };

  const NAV = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'submit', label: 'Submit Request' },
    { id: 'workflows', label: 'Workflow Configs' }
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#010409', color: '#c9d1d9', fontFamily: "'IBM Plex Sans', sans-serif" }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid #21262d', background: '#0d1117', padding: '0 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '56px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: '15px', color: '#c9d1d9' }}>
              ⬡ WORKFLOW PLATFORM
            </div>
            <div style={{ height: '16px', width: '1px', background: '#21262d' }} />
            <nav style={{ display: 'flex', gap: '4px' }}>
              {NAV.map(n => (
                <button key={n.id} onClick={() => setView(n.id)} style={{
                  background: view === n.id ? '#21262d' : 'none', border: 'none',
                  color: view === n.id ? '#c9d1d9' : '#8b949e', padding: '6px 12px',
                  borderRadius: '6px', cursor: 'pointer', fontSize: '14px'
                }}>{n.label}</button>
              ))}
            </nav>
          </div>
          <button onClick={refresh} style={{ background: 'none', border: '1px solid #30363d', borderRadius: '6px', color: '#8b949e', padding: '5px 12px', cursor: 'pointer', fontSize: '12px', fontFamily: "'IBM Plex Mono', monospace" }}>
            ↺ refresh
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '16px', right: '16px', zIndex: 1000,
          background: '#0d1117', border: `1px solid ${toast.color}44`, borderRadius: '8px',
          padding: '12px 20px', fontSize: '14px', color: toast.color,
          boxShadow: `0 4px 24px ${toast.color}22`
        }}>
          {toast.msg}
        </div>
      )}

      {/* Main */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
        {view === 'dashboard' && (
          <Dashboard requests={requests} stats={stats} onSelect={handleSelect} />
        )}
        {view === 'submit' && (
          <SubmitForm workflows={workflows} onSubmit={handleSubmit} loading={loading} />
        )}
        {view === 'workflows' && (
          <WorkflowsList workflows={workflows} />
        )}
        {view === 'detail' && (
          <RequestDetail request={selected} auditLog={auditLog} onBack={() => setView('dashboard')} />
        )}
      </div>
    </div>
  );
}
