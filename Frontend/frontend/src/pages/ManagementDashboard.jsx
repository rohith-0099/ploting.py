import { useState, useEffect, useCallback } from 'react';
import {
  getFleetStatus, getSessionJobs, getSessionMachines,
  addMachine, deleteCustomMachine, submitJob, deleteCustomJob,
  manualAllocate, clearSession, getPhase4Schedule
} from '../api';

const MACHINE_TYPES = ['Hydraulic Press', 'CNC Mill', 'Welding Unit', 'Conveyor', 'Lathe'];
const PRIORITY_COLOR = { 1: '#EF4444', 2: '#F97316', 3: '#EAB308', 4: '#10B981', 5: '#22C55E' };

// ── Utilization Bar ────────────────────────────────────────────────
function UtilBar({ pct }) {
  const color = pct > 85 ? '#EF4444' : pct > 60 ? '#F59E0B' : '#10B981';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 0.5s' }} />
      </div>
      <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color, minWidth: 36 }}>{pct}%</span>
    </div>
  );
}

// ── Section Tabs ────────────────────────────────────────────────────
const SECTIONS = [
  { key: 'fleet', label: '▦  Fleet Status' },
  { key: 'addjob', label: '◈  Add Job' },
  { key: 'addmach', label: '⬡  Add Machine' },
  { key: 'allocate', label: '◉  Manual Allocate' },
];

export default function ManagementDashboard({ machines, schedule, deferred, weights, setWeights }) {
  const [section, setSection] = useState('fleet');
  const [fleet, setFleet] = useState([]);
  const [sessionJobs, setSessionJobs] = useState([]);
  const [sessionMach, setSessionMach] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  // Add Machine form
  const [machForm, setMachForm] = useState({
    Machine_Type: 'Hydraulic Press', Machine_Age: 5,
    Daily_Operating_Hours: 12, Avg_Load_Percentage: 60,
    Avg_Vibration: 3, Avg_Temperature: 75,
    Total_Run_Hours: 5000, Last_Maintenance_Days: 30,
    Failure_History_Count: 0, Energy_Consumption_Rate: 50,
  });

  // Add Job form
  const [jobForm, setJobForm] = useState({
    Revenue_Per_Job: 8000, Priority_Level: 1,
    Required_Machine_Type: 'Hydraulic Press',
    Processing_Time_Hours: 12, Deadline_Hours: 96, Notes: '',
  });

  // Manual Allocate form
  const [allocForm, setAllocForm] = useState({ job_id: '', machine_id: '' });
  const [allocResult, setAllocResult] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [f, sj, sm] = await Promise.all([
        getFleetStatus(), getSessionJobs(), getSessionMachines()
      ]);
      setFleet(f); setSessionJobs(sj); setSessionMach(sm);
    } catch { }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const flash = (text) => { setMsg(text); setTimeout(() => setMsg(''), 4000); };

  async function handleAddMachine() {
    try {
      const r = await addMachine(machForm);
      flash(`✓ ${r.machine_id} added to fleet — Risk Tier: ${r.risk_tier}`);
      refresh();
    } catch (e) { flash(`✗ ${e.message}`); }
  }

  async function handleAddJob() {
    try {
      const r = await submitJob(jobForm);
      flash(`✓ ${r.job_id} queued — ₹${jobForm.Revenue_Per_Job.toLocaleString()}, P${jobForm.Priority_Level}`);
      refresh();
    } catch (e) { flash(`✗ ${e.message}`); }
  }

  async function handleDeleteJob(id) {
    try { await deleteCustomJob(id); refresh(); } catch (e) { flash(`✗ ${e.message}`); }
  }

  async function handleDeleteMachine(id) {
    try { await deleteCustomMachine(id); refresh(); } catch (e) { flash(`✗ ${e.message}`); }
  }

  async function handleManualAllocate() {
    if (!allocForm.job_id || !allocForm.machine_id) return;
    try {
      const r = await manualAllocate(allocForm.job_id, allocForm.machine_id);
      setAllocResult(r);
    } catch (e) { setAllocResult({ error: e.message }); }
  }

  async function handleClearSession() {
    if (!window.confirm('Clear all custom jobs and machines from this session?')) return;
    try { await clearSession(); flash('✓ Session cleared.'); refresh(); } catch { }
  }

  return (
    <div className="animate-in">
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <p className="section-title">Layer 2 — Management Operations</p>
        <h1 className="page-title" style={{ marginTop: 4 }}>Management Dashboard</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
          Fleet control, job allocation management, machine onboarding — manage the entire production floor.
        </p>
      </div>

      {/* Quick KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {[
          { label: 'Fleet Size', value: (machines.length || 500) + sessionMach.length, accent: '#06B6D4' },
          { label: 'Jobs in Queue', value: sessionJobs.length, accent: '#F59E0B' },
          { label: 'Custom Machines', value: sessionMach.length, accent: '#10B981' },
          { label: 'Deferred Jobs', value: deferred.length || 0, accent: deferred.length > 0 ? '#EF4444' : '#10B981' },
        ].map(k => (
          <div key={k.label} className="kpi-card" style={{ '--kpi-accent': k.accent, padding: 16 }}>
            <p className="kpi-value" style={{ fontSize: 28, color: k.accent }}>{k.value}</p>
            <p className="kpi-label">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Flash message */}
      {msg && (
        <div style={{
          marginBottom: 16, padding: '12px 16px', borderRadius: 3,
          background: msg.startsWith('✓') ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${msg.startsWith('✓') ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
          fontFamily: 'IBM Plex Mono', fontSize: 13,
          color: msg.startsWith('✓') ? '#10B981' : '#EF4444',
        }}>{msg}</div>
      )}

      {/* Section Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {SECTIONS.map(s => (
          <button key={s.key} onClick={() => setSection(s.key)}
            style={{
              fontFamily: 'Rajdhani', fontSize: 13, fontWeight: 700, letterSpacing: '0.04em',
              padding: '8px 18px', border: '1px solid', borderRadius: 3, cursor: 'pointer',
              background: section === s.key ? 'rgba(6,182,212,0.1)' : 'transparent',
              color: section === s.key ? '#06B6D4' : 'var(--text-secondary)',
              borderColor: section === s.key ? 'rgba(6,182,212,0.35)' : 'rgba(255,255,255,0.08)',
            }}>{s.label}</button>
        ))}
        <button onClick={handleClearSession}
          style={{
            marginLeft: 'auto', fontFamily: 'DM Sans', fontSize: 12, fontWeight: 500,
            padding: '8px 14px', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 3,
            cursor: 'pointer', background: 'rgba(239,68,68,0.05)', color: '#EF4444'
          }}>
          ✕ Clear Session
        </button>
      </div>

      {/* ═══ FLEET STATUS ═══════════════════════════════════════════ */}
      {section === 'fleet' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <p className="section-title">Fleet Capacity by Machine Type</p>
            <button onClick={refresh} className="btn-secondary" style={{ padding: '6px 14px', fontSize: 12 }}>
              ↻ Refresh
            </button>
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading fleet data...</div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Machine Type</th>
                    <th>Total</th>
                    <th>Healthy</th>
                    <th>Critical</th>
                    <th>Custom Added</th>
                    <th>Available Hours</th>
                    <th>Jobs Needed</th>
                    <th>Utilization</th>
                  </tr>
                </thead>
                <tbody>
                  {fleet.map(row => (
                    <tr key={row.Machine_Type}>
                      <td style={{ fontFamily: 'Rajdhani', fontSize: 14, fontWeight: 600 }}>{row.Machine_Type}</td>
                      <td style={{ fontFamily: 'IBM Plex Mono', color: '#06B6D4', fontWeight: 700 }}>{row.Total_Machines}</td>
                      <td style={{ fontFamily: 'IBM Plex Mono', color: '#10B981' }}>{row.Healthy_Machines}</td>
                      <td style={{ fontFamily: 'IBM Plex Mono', color: row.Critical_Machines > 0 ? '#EF4444' : 'var(--text-muted)' }}>{row.Critical_Machines}</td>
                      <td style={{ fontFamily: 'IBM Plex Mono', color: row.Custom_Added > 0 ? '#F59E0B' : 'var(--text-muted)' }}>
                        {row.Custom_Added > 0 ? `+${row.Custom_Added}` : '—'}
                      </td>
                      <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }}>{row.Total_Available_Hours?.toLocaleString()}h</td>
                      <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#F59E0B' }}>{row.Total_Jobs_Needed}</td>
                      <td style={{ minWidth: 120 }}><UtilBar pct={row.Utilization_Pct || 0} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Custom machine list */}
          {sessionMach.length > 0 && (
            <div className="card" style={{ padding: 20, marginTop: 20 }}>
              <p className="section-title" style={{ marginBottom: 14 }}>Custom Machines Added This Session</p>
              <table className="data-table">
                <thead>
                  <tr><th>Machine ID</th><th>Type</th><th>Age</th><th>Daily Hours</th><th>Est. Failure Prob</th><th>Risk Tier</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {sessionMach.map(m => (
                    <tr key={m.Machine_ID}>
                      <td style={{ fontFamily: 'IBM Plex Mono', color: '#F59E0B' }}>{m.Machine_ID}</td>
                      <td>{m.Machine_Type}</td>
                      <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }}>{m.Machine_Age}yr</td>
                      <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }}>{m.Daily_Operating_Hours}h</td>
                      <td style={{ fontFamily: 'IBM Plex Mono', color: '#10B981' }}>{(m.Failure_Prob * 100).toFixed(1)}%</td>
                      <td><span className="badge badge-healthy">{m.Risk_Tier}</span></td>
                      <td>
                        <button onClick={() => handleDeleteMachine(m.Machine_ID)}
                          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 3, color: '#EF4444', padding: '3px 10px', cursor: 'pointer', fontSize: 11, fontFamily: 'IBM Plex Mono' }}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══ ADD JOB ══════════════════════════════════════════════ */}
      {section === 'addjob' && (
        <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card-amber" style={{ padding: 22 }}>
              <p className="section-title" style={{ color: 'var(--amber)', marginBottom: 16 }}>◈  New Job Entry</p>

              {/* Revenue */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, display: 'block', marginBottom: 6 }}>Revenue (₹) *</label>
                <input type="number" min={100} value={jobForm.Revenue_Per_Job}
                  onChange={e => setJobForm(f => ({ ...f, Revenue_Per_Job: parseFloat(e.target.value) || 0 }))}
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 3, color: '#F59E0B', padding: '8px 12px', fontFamily: 'IBM Plex Mono', fontSize: 20, fontWeight: 700, width: '100%', outline: 'none' }} />
              </div>

              {/* Priority */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, display: 'block', marginBottom: 8 }}>Priority Level *</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[1, 2, 3, 4, 5].map(p => (
                    <button key={p} onClick={() => setJobForm(f => ({ ...f, Priority_Level: p }))}
                      style={{
                        flex: 1, padding: '8px 0', borderRadius: 3, border: `1px solid ${PRIORITY_COLOR[p]}`,
                        fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 15, cursor: 'pointer',
                        background: jobForm.Priority_Level === p ? PRIORITY_COLOR[p] : 'transparent',
                        color: jobForm.Priority_Level === p ? '#0D1117' : PRIORITY_COLOR[p]
                      }}>
                      P{p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Machine Type */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, display: 'block', marginBottom: 6 }}>Machine Type *</label>
                <select value={jobForm.Required_Machine_Type} onChange={e => setJobForm(f => ({ ...f, Required_Machine_Type: e.target.value }))}>
                  {MACHINE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>

              {/* Processing + Deadline */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                {[
                  { label: 'Processing Time (h)', key: 'Processing_Time_Hours', min: 1 },
                  { label: 'Deadline (h)', key: 'Deadline_Hours', min: 1 },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, display: 'block', marginBottom: 6 }}>{f.label}</label>
                    <input type="number" min={f.min} value={jobForm[f.key]}
                      onChange={e => setJobForm(j => ({ ...j, [f.key]: parseFloat(e.target.value) || f.min }))}
                      style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text-primary)', padding: '8px 10px', fontFamily: 'IBM Plex Mono', fontSize: 14, width: '100%', outline: 'none' }} />
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, display: 'block', marginBottom: 6 }}>Notes</label>
                <input type="text" value={jobForm.Notes} placeholder="Optional description..."
                  onChange={e => setJobForm(f => ({ ...f, Notes: e.target.value }))}
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text-primary)', padding: '8px 10px', fontFamily: 'DM Sans', fontSize: 13, width: '100%', outline: 'none' }} />
              </div>

              <button onClick={handleAddJob} className="btn-primary" style={{ width: '100%' }}>
                ◈  QUEUE JOB
              </button>
            </div>
          </div>

          {/* Job Queue Table */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <p className="section-title">Custom Job Queue ({sessionJobs.length})</p>
            </div>
            {sessionJobs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>
                <p style={{ fontSize: 36, marginBottom: 12 }}>◈</p>
                <p style={{ fontSize: 14 }}>No jobs queued yet — submit a job using the form.</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr><th>Job ID</th><th>Machine Type</th><th>Revenue</th><th>Priority</th><th>Process Time</th><th>Deadline</th><th>Notes</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {sessionJobs.map(j => (
                    <tr key={j.Job_ID}>
                      <td style={{ fontFamily: 'IBM Plex Mono', color: '#F59E0B', fontWeight: 700 }}>{j.Job_ID}</td>
                      <td style={{ fontSize: 12 }}>{j.Required_Machine_Type}</td>
                      <td style={{ fontFamily: 'IBM Plex Mono', color: '#10B981', fontWeight: 600 }}>₹{j.Revenue_Per_Job?.toLocaleString()}</td>
                      <td><span style={{ fontFamily: 'IBM Plex Mono', fontWeight: 700, color: PRIORITY_COLOR[j.Priority_Level] }}>P{j.Priority_Level}</span></td>
                      <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }}>{j.Processing_Time_Hours}h</td>
                      <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }}>{j.Deadline_Hours}h</td>
                      <td style={{ fontSize: 11, color: 'var(--text-secondary)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.Notes || '—'}</td>
                      <td>
                        <button onClick={() => handleDeleteJob(j.Job_ID)}
                          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 3, color: '#EF4444', padding: '3px 10px', cursor: 'pointer', fontSize: 11, fontFamily: 'IBM Plex Mono' }}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {sessionJobs.length > 0 && (
              <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(245,158,11,0.06)', borderRadius: 3, borderLeft: '2px solid var(--amber)' }}>
                <p style={{ fontSize: 12, color: 'var(--amber)', fontFamily: 'IBM Plex Mono' }}>
                  ⬡ These {sessionJobs.length} jobs are included in the live schedule. Go to the Optimization Engine and move any slider to trigger re-allocation.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ ADD MACHINE ══════════════════════════════════════════ */}
      {section === 'addmach' && (
        <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 20 }}>
          <div className="card-teal" style={{ padding: 22 }}>
            <p className="section-title" style={{ color: 'var(--teal)', marginBottom: 16 }}>⬡  Add Machine to Fleet</p>

            {/* Type */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, display: 'block', marginBottom: 6 }}>Machine Type *</label>
              <select value={machForm.Machine_Type} onChange={e => setMachForm(f => ({ ...f, Machine_Type: e.target.value }))}>
                {MACHINE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>

            {/* Numeric fields */}
            {[
              { label: 'Machine Age (years)', key: 'Machine_Age', min: 0, max: 50, step: 0.5 },
              { label: 'Daily Operating Hours', key: 'Daily_Operating_Hours', min: 1, max: 24, step: 0.5 },
              { label: 'Avg Load %', key: 'Avg_Load_Percentage', min: 0, max: 100, step: 1 },
              { label: 'Avg Vibration (m/s²)', key: 'Avg_Vibration', min: 0, max: 15, step: 0.1 },
              { label: 'Avg Temperature (°C)', key: 'Avg_Temperature', min: 20, max: 200, step: 1 },
              { label: 'Last Maintenance (days ago)', key: 'Last_Maintenance_Days', min: 0, max: 365, step: 1 },
              { label: 'Failure History Count', key: 'Failure_History_Count', min: 0, max: 20, step: 1 },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{f.label}</label>
                  <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: 'var(--teal)' }}>{machForm[f.key]}</span>
                </div>
                <input type="range" min={f.min} max={f.max} step={f.step} value={machForm[f.key]}
                  style={{ accentColor: '#06B6D4' }}
                  onChange={e => setMachForm(v => ({ ...v, [f.key]: parseFloat(e.target.value) }))} />
              </div>
            ))}

            {/* Risk Preview */}
            {(() => {
              const fp = Math.min(((machForm.Machine_Age / 50) * 0.4 + (machForm.Avg_Vibration / 15) * 0.4 + (machForm.Failure_History_Count / 20) * 0.2) * 0.3, 1);
              const color = fp > 0.4 ? '#EF4444' : fp > 0.2 ? '#F59E0B' : '#10B981';
              return (
                <div style={{ marginTop: 14, padding: '10px 14px', background: `${color}10`, borderLeft: `2px solid ${color}`, borderRadius: 3, marginBottom: 14 }}>
                  <p style={{ fontSize: 11, fontFamily: 'IBM Plex Mono', color }}>
                    Estimated Failure Prob: {(fp * 100).toFixed(1)}% — {fp > 0.4 ? 'High Risk' : fp > 0.2 ? 'At Risk' : 'Healthy'}
                  </p>
                </div>
              );
            })()}

            <button onClick={handleAddMachine} className="btn-primary" style={{ width: '100%', background: '#06B6D4', color: '#0D1117' }}>
              ⬡  ADD TO FLEET
            </button>
          </div>

          {/* Machine queue display */}
          <div className="card" style={{ padding: 20 }}>
            <p className="section-title" style={{ marginBottom: 14 }}>Custom Machines in Fleet ({sessionMach.length})</p>
            {sessionMach.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>
                <p style={{ fontSize: 36, marginBottom: 12 }}>⬡</p>
                <p style={{ fontSize: 14 }}>No custom machines added yet.</p>
                <p style={{ fontSize: 12, marginTop: 8 }}>New machines are automatically included in the next schedule run.</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr><th>Machine ID</th><th>Type</th><th>Age</th><th>Daily Hours</th><th>Vibration</th><th>Failure History</th><th>Est. Risk</th><th>Risk Tier</th><th>×</th></tr>
                </thead>
                <tbody>
                  {sessionMach.map(m => (
                    <tr key={m.Machine_ID}>
                      <td style={{ fontFamily: 'IBM Plex Mono', color: '#06B6D4', fontWeight: 700 }}>{m.Machine_ID}</td>
                      <td style={{ fontSize: 12 }}>{m.Machine_Type}</td>
                      <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }}>{m.Machine_Age}yr</td>
                      <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }}>{m.Daily_Operating_Hours}h</td>
                      <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }}>{m.Avg_Vibration}</td>
                      <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: m.Failure_History_Count > 2 ? '#EF4444' : 'var(--text-muted)' }}>{m.Failure_History_Count}</td>
                      <td style={{ fontFamily: 'IBM Plex Mono', color: '#10B981' }}>{(m.Failure_Prob * 100).toFixed(1)}%</td>
                      <td><span className="badge badge-healthy">{m.Risk_Tier}</span></td>
                      <td>
                        <button onClick={() => handleDeleteMachine(m.Machine_ID)}
                          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 3, color: '#EF4444', padding: '3px 8px', cursor: 'pointer', fontSize: 11 }}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ═══ MANUAL ALLOCATION ═══════════════════════════════════ */}
      {section === 'allocate' && (
        <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="card" style={{ padding: 22 }}>
              <p className="section-title" style={{ marginBottom: 16 }}>◉  Manual Job Allocation Override</p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
                Force-assign a custom job to a specific machine. The system will validate constraints and provide a risk assessment.
              </p>

              {/* Job selector */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, display: 'block', marginBottom: 6 }}>Select Custom Job</label>
                <select value={allocForm.job_id} onChange={e => setAllocForm(f => ({ ...f, job_id: e.target.value }))}>
                  <option value="">— Select a queued custom job —</option>
                  {sessionJobs.map(j => (
                    <option key={j.Job_ID} value={j.Job_ID}>
                      {j.Job_ID} — ₹{j.Revenue_Per_Job?.toLocaleString()} — P{j.Priority_Level} — {j.Required_Machine_Type}
                    </option>
                  ))}
                </select>
              </div>

              {/* Machine selector */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, display: 'block', marginBottom: 6 }}>Select Target Machine</label>
                <select value={allocForm.machine_id} onChange={e => setAllocForm(f => ({ ...f, machine_id: e.target.value }))}>
                  <option value="">— Select a machine —</option>
                  {/* Filter by selected job's machine type */}
                  {(() => {
                    const selJob = sessionJobs.find(j => j.Job_ID === allocForm.job_id);
                    const filtered = selJob
                      ? [...(Array.isArray(machines) ? machines : []), ...sessionMach].filter(m => m.Machine_Type === selJob.Required_Machine_Type)
                      : [...(Array.isArray(machines) ? machines : []), ...sessionMach];
                    return filtered.slice(0, 50).map(m => (
                      <option key={m.Machine_ID} value={m.Machine_ID}>
                        {m.Machine_ID} — {m.Machine_Type} [{m.Risk_Tier}] (Risk {((m.Failure_Prob || 0) * 100).toFixed(0)}%)
                      </option>
                    ));
                  })()}
                </select>
              </div>

              <button onClick={handleManualAllocate} disabled={!allocForm.job_id || !allocForm.machine_id}
                className="btn-primary" style={{ width: '100%' }}>
                ◉  ALLOCATE NOW
              </button>
            </div>
          </div>

          {/* Result panel */}
          <div>
            {!allocResult && (
              <div className="card" style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
                <p style={{ fontSize: 40, marginBottom: 12 }}>◉</p>
                <p style={{ fontFamily: 'Rajdhani', fontSize: 18, fontWeight: 600 }}>Manual Allocation Engine</p>
                <p style={{ fontSize: 13, marginTop: 8 }}>Select a job and a machine, then click Allocate Now to see the risk assessment.</p>
                {sessionJobs.length === 0 && (
                  <p style={{ marginTop: 16, fontSize: 12, color: '#F59E0B', fontFamily: 'IBM Plex Mono' }}>
                    ⚠ Add custom jobs first using the "Add Job" section.
                  </p>
                )}
              </div>
            )}

            {allocResult?.error && (
              <div className="card-red" style={{ padding: 24 }}>
                <p style={{ color: '#EF4444', fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 18, marginBottom: 8 }}>✗ Allocation Failed</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{allocResult.error}</p>
              </div>
            )}

            {allocResult?.success && allocResult.allocation && (
              <div>
                <div style={{ padding: 24, borderRadius: 4, border: '1px solid rgba(6,182,212,0.3)', background: 'rgba(6,182,212,0.05)', marginBottom: 16 }}>
                  <p style={{ fontFamily: 'Rajdhani', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#06B6D4', marginBottom: 12 }}>Allocation Result</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 16 }}>
                    {[
                      { label: 'Job ID', value: allocResult.allocation.Job_ID, color: '#F59E0B' },
                      { label: 'Machine ID', value: allocResult.allocation.Machine_ID, color: '#06B6D4' },
                      { label: 'Machine Type', value: allocResult.allocation.Machine_Type, color: 'var(--text-primary)' },
                      { label: 'Start Hour', value: `${allocResult.allocation.Start_Hour}h`, color: '#10B981' },
                      { label: 'End Hour', value: `${allocResult.allocation.End_Hour}h`, color: '#10B981' },
                      { label: 'Revenue', value: `₹${allocResult.allocation.Revenue?.toLocaleString()}`, color: '#F59E0B' },
                    ].map(d => (
                      <div key={d.label} className="card" style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)' }}>
                        <p style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, marginBottom: 4 }}>{d.label}</p>
                        <p style={{ fontFamily: 'IBM Plex Mono', fontSize: 18, fontWeight: 700, color: d.color }}>{d.value}</p>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: '12px 16px', borderRadius: 3, background: allocResult.warning ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)', borderLeft: `2px solid ${allocResult.warning ? '#EF4444' : '#10B981'}` }}>
                    <p style={{ fontFamily: 'IBM Plex Mono', fontSize: 13, fontWeight: 700, color: allocResult.warning ? '#EF4444' : '#10B981' }}>
                      {allocResult.allocation.Risk_Assessment}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                      Machine Failure Risk: {allocResult.allocation.Machine_Failure_Risk}
                    </p>
                    {allocResult.warning && (
                      <p style={{ fontSize: 12, color: '#EF4444', marginTop: 6 }}>⚠ {allocResult.warning}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
