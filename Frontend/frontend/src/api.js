const BASE = 'http://localhost:8000/api';

export async function apiGet(path) {
  const r = await fetch(`${BASE}${path}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export const getHealth = () => apiGet('/health');
export const getMachines = () => apiGet('/machines');
export const getJobs = () => apiGet('/jobs');
export const getPredictions = () => apiGet('/predictions');
export const getSummary = () => apiGet('/summary');
export const getShap = () => apiGet('/shap');

export const getPhase3 = (machine_id = null) =>
  apiGet(machine_id ? `/phase3?machine_id=${machine_id}` : '/phase3');
export const getPhase3Summary = () => apiGet('/phase3/summary');

export const getPhase4Schedule = (w1, w2, w3) =>
  apiGet(`/phase4/schedule?w1=${w1}&w2=${w2}&w3=${w3}`);
export const getPhase4Sensitivity = () => apiGet('/phase4/sensitivity');
