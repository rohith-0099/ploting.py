const BASE = 'http://localhost:8000/api';

export async function apiGet(path) {
  const r = await fetch(`${BASE}${path}`);
  if (!r.ok) throw new Error(`HTTP ${r.status} on GET ${path}`);
  return r.json();
}
export async function apiPost(path, body = {}) {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${r.status}`);
  }
  return r.json();
}
export async function apiDelete(path) {
  const r = await fetch(`${BASE}${path}`, { method: 'DELETE' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// ── Core Data ──────────────────────────────────────────────────────────
export const getHealth = () => apiGet('/health');
export const getMachines = () => apiGet('/machines');
export const getJobs = () => apiGet('/jobs');
export const getPredictions = () => apiGet('/predictions');
export const getSummary = () => apiGet('/summary');
export const getShap = () => apiGet('/shap');
export const getPhase3 = (id) => apiGet(id ? `/phase3?machine_id=${id}` : '/phase3');
export const getPhase3Summary = () => apiGet('/phase3/summary');
export const getPhase4Schedule = (w1, w2, w3) => apiGet(`/phase4/schedule?w1=${w1}&w2=${w2}&w3=${w3}`);
export const getPhase4Sensitivity = () => apiGet('/phase4/sensitivity');

// ── Operator Interface ─────────────────────────────────────────────────
export const submitJob = (job) => apiPost('/jobs/add', job);
export const findBestMachine = (job, w1, w2, w3) =>
  apiPost(`/jobs/find-best?w1=${w1}&w2=${w2}&w3=${w3}`, job);
export const deleteCustomJob = (jobId) => apiDelete(`/jobs/${jobId}`);
export const getSessionJobs = () => apiGet('/session/jobs');

// ── Management Dashboard ───────────────────────────────────────────────
export const addMachine = (m) => apiPost('/machines/add', m);
export const deleteCustomMachine = (mid) => apiDelete(`/machines/${mid}`);
export const getSessionMachines = () => apiGet('/session/machines');
export const getFleetStatus = () => apiGet('/fleet/status');
export const manualAllocate = (job_id, machine_id) =>
  apiPost('/jobs/allocate', { job_id, machine_id });
export const clearSession = () => apiDelete('/session/clear');
