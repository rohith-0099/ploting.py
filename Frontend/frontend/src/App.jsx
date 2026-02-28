import { useState, useEffect, useCallback, useRef } from 'react';
import './index.css';
import Overview from './pages/Overview';
import OperatorIntelligence from './pages/OperatorIntelligence';
import MaintenanceSimulation from './pages/MaintenanceSimulation';
import OptimizationEngine from './pages/OptimizationEngine';
import ProductionSchedule from './pages/ProductionSchedule';
import ManagementDashboard from './pages/ManagementDashboard';
import { getHealth, getMachines, getJobs, getSummary, getPhase4Schedule, getPhase4Sensitivity } from './api';

const TABS = [
  { id: 'overview', icon: '⬡', label: 'Overview', sub: 'Platform Dashboard' },
  { id: 'operator', icon: '◈', label: 'Operator Interface', sub: 'Layer 1 — Job Submission' },
  { id: 'maintenance', icon: '◉', label: 'Maintenance Sim', sub: 'Layer 1 — Simulation' },
  { id: 'optimization', icon: '◎', label: 'Optimization Engine', sub: 'Layer 2 — Scheduling' },
  { id: 'schedule', icon: '▦', label: 'Production Schedule', sub: 'Layer 2 — Gantt View' },
  { id: 'management', icon: '◧', label: 'Management Dashboard', sub: 'Fleet · Job Allocator' },
];

const ALERTS = [
  '⚠ MCH-098 Failure Probability 99% — Immediate PM Required',
  '⚠ MCH-144 Hydraulic Press — Vibration spike detected at 8.7 m/s²',
  '◉ Phase 4 Scheduler: 200/200 jobs allocated — 0 deferred',
  '⚠ MCH-162 Welding Unit — Last maintenance 347 days ago',
  '✓ Phase 2 Model: AUC-ROC 0.977 — High confidence predictions',
  '⚠ MCH-254 Welding Unit — Risk tier: Critical (p=0.97)',
  '◉ System Status: All models loaded and online · FastAPI v5.1',
  '⚠ MCH-465 Welding Unit — Failure History Count: 4 incidents',
  '✓ Management Dashboard: Fleet & Job Allocator now active',
];

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [weights, setWeights] = useState({ w1: 0.50, w2: 0.30, w3: 0.20 });
  const [machines, setMachines] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [summary, setSummary] = useState({});
  const [schedule, setSchedule] = useState([]);
  const [deferred, setDeferred] = useState([]);
  const [schedMetrics, setSchedMetrics] = useState({});
  const [sensitivity, setSensitivity] = useState([]);
  const [backendOnline, setBackendOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef(null);

  // Bootstrap
  useEffect(() => {
    async function boot() {
      try {
        await getHealth();
        setBackendOnline(true);
        const [m, j, s] = await Promise.all([getMachines(), getJobs(), getSummary()]);
        setMachines(m); setJobs(j); setSummary(s);
      } catch { setBackendOnline(false); }
      setLoading(false);
    }
    boot();
  }, []);

  // Schedule on weight change (debounced 400ms)
  const runSchedule = useCallback(async (w) => {
    if (!backendOnline) return;
    try {
      const res = await getPhase4Schedule(w.w1, w.w2, w.w3);
      setSchedule(res.schedule || []);
      setDeferred(res.deferred || []);
      setSchedMetrics(res.metrics || {});
    } catch { }
  }, [backendOnline]);

  useEffect(() => {
    if (!backendOnline) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSchedule(weights), 400);
    return () => clearTimeout(debounceRef.current);
  }, [weights, backendOnline, runSchedule]);

  useEffect(() => {
    if (!backendOnline) return;
    getPhase4Sensitivity().then(setSensitivity).catch(() => { });
  }, [backendOnline]);

  const sharedProps = {
    machines, jobs, summary, schedule, deferred, schedMetrics,
    sensitivity, weights, setWeights, backendOnline, loading,
    refreshSchedule: () => runSchedule(weights),
  };

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-app)' }}>

      {/* ── Sidebar ───────────────────────────────────────────── */}
      <aside className="sidebar flex flex-col"
        style={{ width: 228, flexShrink: 0, position: 'sticky', top: 0, height: '100vh' }}>

        {/* Logo */}
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid rgba(245,158,11,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 3,
              background: 'linear-gradient(135deg, #F59E0B, #D97706)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 16px rgba(245,158,11,0.3)', flexShrink: 0
            }}>
              <span style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 16, color: '#0D1117' }}>M</span>
            </div>
            <div>
              <p style={{ fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 15, letterSpacing: '0.06em', color: '#E6EDF3' }}>MECON</p>
              <p style={{ fontFamily: 'IBM Plex Mono', fontSize: 9.5, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>IntelliOps v5.1</p>
            </div>
          </div>
        </div>

        {/* Layer 1 */}
        <div style={{ padding: '10px 16px 4px' }}>
          <span className="section-title" style={{ fontSize: 9, color: '#06B6D4' }}>Layer 1 — Operator</span>
        </div>
        <nav style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {TABS.slice(0, 3).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}>
              <span className="nav-icon" style={{ fontSize: 13 }}>{tab.icon}</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{tab.label}</div>
                <div style={{ fontSize: 9, opacity: 0.55, fontFamily: 'IBM Plex Mono' }}>{tab.sub}</div>
              </div>
            </button>
          ))}
        </nav>

        {/* Layer 2 */}
        <div style={{ padding: '10px 16px 4px', marginTop: 6 }}>
          <span className="section-title" style={{ fontSize: 9, color: '#F59E0B' }}>Layer 2 — Management</span>
        </div>
        <nav style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {TABS.slice(3).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}>
              <span className="nav-icon" style={{ fontSize: 13 }}>{tab.icon}</span>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{tab.label}</div>
                <div style={{ fontSize: 9, opacity: 0.55, fontFamily: 'IBM Plex Mono' }}>{tab.sub}</div>
              </div>
            </button>
          ))}
        </nav>

        {/* Sidebar stats */}
        <div style={{ flex: 1 }} />
        <div style={{ padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {[
            { label: 'Machines', val: machines.length || 500, color: 'var(--text-primary)' },
            { label: 'Scheduled', val: schedMetrics.jobs_scheduled ?? schedule.length ?? '—', color: '#10B981' },
            { label: 'Deferred', val: schedMetrics.jobs_deferred ?? deferred.length ?? '—', color: '#F59E0B' },
            { label: 'Critical', val: summary.critical_machines ?? '—', color: '#EF4444' },
            { label: 'Custom Jobs', val: schedMetrics.custom_jobs_scheduled ?? 0, color: '#06B6D4' },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 4px' }}>
              <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{r.label}</span>
              <span style={{ fontSize: 11.5, fontFamily: 'IBM Plex Mono', fontWeight: 600, color: r.color }}>{r.val}</span>
            </div>
          ))}
        </div>

        {/* Backend status */}
        <div style={{ padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>API v5.1</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div className={backendOnline ? 'status-live' : 'status-offline'} />
              <span style={{ fontSize: 11, fontFamily: 'IBM Plex Mono', color: backendOnline ? '#10B981' : '#F59E0B' }}>
                {backendOnline ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main Content ──────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <main style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }} className="animate-fade">
          {activeTab === 'overview' && <Overview     {...sharedProps} alerts={ALERTS} />}
          {activeTab === 'operator' && <OperatorIntelligence {...sharedProps} />}
          {activeTab === 'maintenance' && <MaintenanceSimulation {...sharedProps} />}
          {activeTab === 'optimization' && <OptimizationEngine {...sharedProps} />}
          {activeTab === 'schedule' && <ProductionSchedule {...sharedProps} />}
          {activeTab === 'management' && <ManagementDashboard {...sharedProps} />}
        </main>

        {/* ── Alert Ticker ──────────────────────────────────────── */}
        <div style={{
          background: 'rgba(239,68,68,0.04)', borderTop: '1px solid rgba(239,68,68,0.12)',
          height: 30, display: 'flex', alignItems: 'center', overflow: 'hidden',
          padding: '0 12px', flexShrink: 0,
        }}>
          <span style={{
            fontFamily: 'IBM Plex Mono', fontSize: 10, fontWeight: 600, letterSpacing: '0.12em',
            color: '#EF4444', marginRight: 16, flexShrink: 0, borderRight: '1px solid rgba(239,68,68,0.3)', paddingRight: 12
          }}>
            ALERTS
          </span>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div className="ticker-track" style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: '#8B949E' }}>
              {[...ALERTS, ...ALERTS].map((a, i) => (
                <span key={i} style={{ marginRight: 60, color: a.startsWith('✓') ? '#10B981' : '#8B949E' }}>{a}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
