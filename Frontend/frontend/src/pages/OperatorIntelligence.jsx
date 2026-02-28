import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getShap, submitJob, findBestMachine, deleteCustomJob, getSessionJobs } from '../api';

// ── Circular Health Gauge ─────────────────────────────────────────
function CircleGauge({ value, size = 160 }) {
    const r = (size - 20) / 2;
    const circ = 2 * Math.PI * r;
    const pct = Math.min(Math.max(value, 0), 100) / 100;
    const color = value >= 70 ? '#10B981' : value >= 40 ? '#F59E0B' : '#EF4444';
    return (
        <div style={{ position: 'relative', width: size, height: size }}>
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={12} />
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={12}
                    strokeLinecap="round" strokeDasharray={`${pct * circ} ${circ}`}
                    style={{ filter: `drop-shadow(0 0 8px ${color})`, transition: 'stroke-dasharray 0.8s ease' }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 32, fontWeight: 700, color, lineHeight: 1 }}>{value}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Health Score</span>
            </div>
        </div>
    );
}

const SHAP_COLORS = ['#F59E0B', '#D97706', '#B45309', '#92400E', '#78350F'];
const MACHINE_TYPES = ['Hydraulic Press', 'CNC Mill', 'Welding Unit', 'Conveyor', 'Lathe'];
const PRIORITY_COLOR = { 1: '#EF4444', 2: '#F97316', 3: '#EAB308', 4: '#10B981', 5: '#22C55E' };

export default function OperatorIntelligence({ machines, weights }) {
    // Machine inspection state
    const [selectedId, setSelectedId] = useState('');
    const [selected, setSelected] = useState(null);
    const [shapData, setShapData] = useState([]);
    // Job submission state
    const [jobForm, setJobForm] = useState({
        Revenue_Per_Job: 8000, Priority_Level: 1, Required_Machine_Type: 'Hydraulic Press',
        Processing_Time_Hours: 12, Deadline_Hours: 96, Notes: ''
    });
    const [finding, setFinding] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [findResult, setFindResult] = useState(null);
    const [submitSuccess, setSubmitSuccess] = useState('');
    const [sessionJobs, setSessionJobs] = useState([]);
    const [activeSection, setActiveSection] = useState('inspect'); // 'inspect' | 'submit'
    const [deleting, setDeleting] = useState('');

    useEffect(() => { getShap().then(setShapData).catch(() => { }); }, []);
    useEffect(() => {
        if (!selectedId) { setSelected(null); return; }
        setSelected(machines.find(m => m.Machine_ID === selectedId) || null);
    }, [selectedId, machines]);

    const loadSessionJobs = () => getSessionJobs().then(setSessionJobs).catch(() => { });
    useEffect(() => { loadSessionJobs(); }, []);

    const featureImportance = useMemo(() => shapData.length ? shapData.slice(0, 5) : [
        { feature: 'Last_Maintenance_Days', importance: 0.2968 },
        { feature: 'Failure_History_Count', importance: 0.1879 },
        { feature: 'Machine_Age', importance: 0.1548 },
        { feature: 'Risk_Score', importance: 0.1048 },
        { feature: 'Avg_Vibration', importance: 0.0942 },
    ], [shapData]);
    const maxImp = Math.max(...featureImportance.map(f => f.importance));

    const health = selected ? Math.round(selected.Health_Score || 0) : null;
    const risk = selected ? selected.Risk_Tier : null;
    const failProb = selected ? ((selected.Failure_Prob || 0) * 100).toFixed(1) : null;
    const badgeClass = risk === 'Critical' ? 'badge-critical' : risk === 'High Risk' ? 'badge-high' :
        risk === 'At Risk' ? 'badge-medium' : 'badge-healthy';
    const recommendation = !selected ? null :
        health < 40 ? { text: 'IMMEDIATE preventive maintenance required. Do NOT assign new jobs.', color: '#EF4444' } :
            health < 60 ? { text: 'Schedule preventive maintenance within 48–72 hours.', color: '#F59E0B' } :
                health < 80 ? { text: 'Monitor closely. Safe for current jobs.', color: '#EAB308' } :
                    { text: 'Machine is healthy. Proceed with normal operations.', color: '#10B981' };

    async function handleFindMachine() {
        setFinding(true); setFindResult(null);
        try {
            const r = await findBestMachine(jobForm, weights.w1, weights.w2, weights.w3);
            setFindResult(r);
        } catch (e) { setFindResult({ error: e.message }); }
        setFinding(false);
    }

    async function handleSubmitJob() {
        if (!findResult?.best_machine) return;
        setSubmitting(true);
        try {
            const r = await submitJob(jobForm);
            setSubmitSuccess(`✓ ${r.job_id} submitted successfully to the queue!`);
            setFindResult(null);
            loadSessionJobs();
        } catch (e) { setSubmitSuccess(`✗ Error: ${e.message}`); }
        setSubmitting(false);
        setTimeout(() => setSubmitSuccess(''), 4000);
    }

    async function handleDeleteJob(id) {
        setDeleting(id);
        try { await deleteCustomJob(id); loadSessionJobs(); }
        catch (e) { }
        setDeleting('');
    }

    const FIELDS_INSPECT = [
        { label: 'Machine Type', key: 'Machine_Type' },
        { label: 'Age (years)', key: 'Machine_Age' },
        { label: 'Run Hours', key: 'Total_Run_Hours' },
        { label: 'Avg Load %', key: 'Avg_Load_Percentage' },
        { label: 'Avg Temp °C', key: 'Avg_Temperature' },
        { label: 'Avg Vibration', key: 'Avg_Vibration' },
        { label: 'Last Maintenance', key: 'Last_Maintenance_Days', suffix: 'd' },
        { label: 'Failure History', key: 'Failure_History_Count', suffix: ' inc.' },
        { label: 'Daily Hours', key: 'Daily_Operating_Hours' },
        { label: 'Energy Rate', key: 'Energy_Consumption_Rate' },
    ];

    return (
        <div className="animate-in">
            <div style={{ marginBottom: 20 }}>
                <p className="section-title">Layer 1 — Operator Intelligence</p>
                <h1 className="page-title" style={{ marginTop: 4 }}>Operator Interface</h1>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Inspect machine health predictions — or submit new revenue/priority-oriented jobs for AI allocation.
                </p>
            </div>

            {/* Tab Switcher */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {[['inspect', '◉  Machine Inspector'], ['submit', '◈  Job Submission (Revenue · Priority)']].map(([key, lbl]) => (
                    <button key={key} onClick={() => setActiveSection(key)}
                        style={{
                            fontFamily: 'Rajdhani', fontSize: 14, fontWeight: 700, letterSpacing: '0.05em',
                            padding: '8px 20px', border: '1px solid', borderRadius: 3, cursor: 'pointer',
                            background: activeSection === key ? 'rgba(245,158,11,0.12)' : 'transparent',
                            color: activeSection === key ? '#F59E0B' : 'var(--text-secondary)',
                            borderColor: activeSection === key ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.08)',
                        }}>
                        {lbl}
                    </button>
                ))}
            </div>

            {/* ── SECTION: Machine Inspector ──────────────────────────── */}
            {activeSection === 'inspect' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    {/* Left */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div className="card" style={{ padding: 20 }}>
                            <p className="section-title" style={{ marginBottom: 12 }}>Select Machine</p>
                            <select value={selectedId} onChange={e => setSelectedId(e.target.value)}>
                                <option value="">— Select Machine ID —</option>
                                {machines.map(m => (
                                    <option key={m.Machine_ID} value={m.Machine_ID}>
                                        {m.Machine_ID} — {m.Machine_Type} ({m.Risk_Tier}) p={((m.Failure_Prob || 0) * 100).toFixed(0)}%
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="card" style={{ padding: 20 }}>
                            <p className="section-title" style={{ marginBottom: 14 }}>Machine Parameters</p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
                                {FIELDS_INSPECT.map(f => (
                                    <div key={f.key}>
                                        <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{f.label}</p>
                                        <p style={{ fontFamily: 'IBM Plex Mono', fontSize: 13, color: selected ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                            {selected ? `${selected[f.key] ?? '—'}${f.suffix || ''}` : '—'}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* SHAP */}
                        <div className="card" style={{ padding: 20 }}>
                            <p className="section-title" style={{ marginBottom: 14 }}>Top 5 Failure Drivers (SHAP)</p>
                            {featureImportance.map((f, i) => (
                                <div key={f.feature} style={{ marginBottom: 12 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{i + 1}. {f.feature.replace(/_/g, ' ')}</span>
                                        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: SHAP_COLORS[i] }}>{f.importance.toFixed(4)}</span>
                                    </div>
                                    <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                                        <div style={{ height: '100%', width: `${(f.importance / maxImp) * 100}%`, background: SHAP_COLORS[i], borderRadius: 2, transition: 'width 0.5s' }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    {/* Right */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <p className="section-title" style={{ marginBottom: 16 }}>ML Prediction Output</p>
                            {selected ? (
                                <>
                                    <CircleGauge value={health} />
                                    <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
                                        <span className={`badge ${badgeClass}`}>{risk}</span>
                                        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: 'var(--text-secondary)' }}>p(failure) = {failProb}%</span>
                                    </div>
                                </>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                                    <p style={{ fontSize: 40 }}>◎</p>
                                    <p style={{ fontSize: 13, marginTop: 12 }}>Select a machine above</p>
                                </div>
                            )}
                        </div>
                        {selected && (
                            <>
                                <div className="card" style={{ padding: 20 }}>
                                    <p className="section-title" style={{ marginBottom: 14 }}>Prediction Details</p>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                        {[
                                            { label: 'Failure Probability', value: `${failProb}%`, color: health < 40 ? '#EF4444' : '#F59E0B' },
                                            { label: 'Health Score', value: health, color: health >= 70 ? '#10B981' : health >= 40 ? '#F59E0B' : '#EF4444' },
                                            { label: 'Predicted Failure', value: selected.Failure_Predicted ? 'YES' : 'NO', color: selected.Failure_Predicted ? '#EF4444' : '#10B981' },
                                            { label: 'Last PM', value: `${selected.Last_Maintenance_Days || '—'}d ago`, color: 'var(--text-primary)' },
                                        ].map(d => (
                                            <div key={d.label} className="card" style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)' }}>
                                                <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>{d.label}</p>
                                                <p style={{ fontFamily: 'IBM Plex Mono', fontSize: 20, fontWeight: 700, color: d.color }}>{d.value}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="card" style={{ padding: 18, borderColor: recommendation.color, background: `${recommendation.color}10` }}>
                                    <p style={{ fontSize: 11, fontFamily: 'IBM Plex Mono', fontWeight: 700, color: recommendation.color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>◉ AI Recommendation</p>
                                    <p style={{ fontSize: 14, lineHeight: 1.6 }}>{recommendation.text}</p>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ── SECTION: Job Submission ──────────────────────────────── */}
            {activeSection === 'submit' && (
                <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', gap: 20 }}>
                    {/* Left — Job Form */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div className="card-amber" style={{ padding: 20 }}>
                            <p className="section-title" style={{ marginBottom: 4, color: 'var(--amber)' }}>◈  New Job Request</p>
                            <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 16, fontFamily: 'DM Sans' }}>
                                Enter revenue and priority requirements — AI will find and rank the best available machine.
                            </p>

                            {/* Revenue */}
                            <div style={{ marginBottom: 16 }}>
                                <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                                    Revenue (₹) <span style={{ color: '#F59E0B' }}>*</span>
                                </label>
                                <input type="number" min={100} max={999999} value={jobForm.Revenue_Per_Job}
                                    onChange={e => setJobForm(f => ({ ...f, Revenue_Per_Job: parseFloat(e.target.value) || 0 }))}
                                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 3, color: '#F59E0B', padding: '8px 12px', fontFamily: 'IBM Plex Mono', fontSize: 18, fontWeight: 700, width: '100%', outline: 'none' }} />
                            </div>

                            {/* Priority */}
                            <div style={{ marginBottom: 16 }}>
                                <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, display: 'block', marginBottom: 8 }}>
                                    Priority Level <span style={{ color: '#F59E0B' }}>*</span>
                                </label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {[1, 2, 3, 4, 5].map(p => (
                                        <button key={p} onClick={() => setJobForm(f => ({ ...f, Priority_Level: p }))}
                                            style={{
                                                flex: 1, padding: '8px 0', borderRadius: 3, border: '1px solid',
                                                fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 15,
                                                cursor: 'pointer', transition: 'all 0.15s',
                                                background: jobForm.Priority_Level === p ? PRIORITY_COLOR[p] : 'transparent',
                                                color: jobForm.Priority_Level === p ? '#0D1117' : PRIORITY_COLOR[p],
                                                borderColor: PRIORITY_COLOR[p],
                                            }}>P{p}</button>
                                    ))}
                                </div>
                                <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>P1 = Most Urgent · P5 = Low Priority</p>
                            </div>

                            {/* Machine Type */}
                            <div style={{ marginBottom: 16 }}>
                                <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                                    Required Machine Type <span style={{ color: '#F59E0B' }}>*</span>
                                </label>
                                <select value={jobForm.Required_Machine_Type}
                                    onChange={e => setJobForm(f => ({ ...f, Required_Machine_Type: e.target.value }))}>
                                    {MACHINE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>

                            {/* Processing Time & Deadline */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                                {[
                                    { label: 'Processing Time (h)', key: 'Processing_Time_Hours', min: 1, max: 72 },
                                    { label: 'Deadline (h from now)', key: 'Deadline_Hours', min: 1, max: 168 },
                                ].map(f => (
                                    <div key={f.key}>
                                        <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, display: 'block', marginBottom: 6 }}>{f.label}</label>
                                        <input type="number" min={f.min} max={f.max} value={jobForm[f.key]}
                                            onChange={e => setJobForm(j => ({ ...j, [f.key]: parseFloat(e.target.value) || f.min }))}
                                            style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text-primary)', padding: '8px 10px', fontFamily: 'IBM Plex Mono', fontSize: 14, width: '100%', outline: 'none' }} />
                                    </div>
                                ))}
                            </div>

                            {/* Notes */}
                            <div style={{ marginBottom: 18 }}>
                                <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, display: 'block', marginBottom: 6 }}>Notes / Description</label>
                                <input type="text" value={jobForm.Notes} placeholder="Optional notes..."
                                    onChange={e => setJobForm(f => ({ ...f, Notes: e.target.value }))}
                                    style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text-primary)', padding: '8px 10px', fontFamily: 'DM Sans', fontSize: 13, width: '100%', outline: 'none' }} />
                            </div>

                            <button onClick={handleFindMachine} disabled={finding} className="btn-primary" style={{ width: '100%', marginBottom: 8 }}>
                                {finding ? 'Searching...' : '⬡  FIND BEST MACHINE'}
                            </button>
                            {submitSuccess && (
                                <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 3, background: submitSuccess.startsWith('✓') ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${submitSuccess.startsWith('✓') ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, fontFamily: 'IBM Plex Mono', fontSize: 12, color: submitSuccess.startsWith('✓') ? '#10B981' : '#EF4444' }}>
                                    {submitSuccess}
                                </div>
                            )}
                        </div>

                        {/* Session Job Queue */}
                        {sessionJobs.length > 0 && (
                            <div className="card" style={{ padding: 16 }}>
                                <p className="section-title" style={{ marginBottom: 12 }}>Submitted Jobs Queue ({sessionJobs.length})</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {sessionJobs.map(j => (
                                        <div key={j.Job_ID} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'rgba(245,158,11,0.06)', borderRadius: 3, border: '1px solid rgba(245,158,11,0.15)' }}>
                                            <div>
                                                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: '#F59E0B', fontWeight: 700 }}>{j.Job_ID}</span>
                                                <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-secondary)' }}>{j.Required_Machine_Type} · ₹{j.Revenue_Per_Job?.toLocaleString()}</span>
                                                <span style={{ marginLeft: 8 }}><span className="badge badge-amber" style={{ fontSize: 9 }}>P{j.Priority_Level}</span></span>
                                            </div>
                                            <button onClick={() => handleDeleteJob(j.Job_ID)} disabled={deleting === j.Job_ID}
                                                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 3, color: '#EF4444', padding: '3px 8px', cursor: 'pointer', fontSize: 11, fontFamily: 'IBM Plex Mono' }}>
                                                {deleting === j.Job_ID ? '...' : '✕'}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right — AI Recommendation */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {/* Instruction state  */}
                        {!findResult && (
                            <div className="card" style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)', flex: 1 }}>
                                <p style={{ fontSize: 50, marginBottom: 12 }}>⬡</p>
                                <p style={{ fontFamily: 'Rajdhani', fontSize: 18, fontWeight: 600 }}>Revenue & Priority Oriented Allocation</p>
                                <p style={{ fontSize: 13, marginTop: 8, lineHeight: 1.7, maxWidth: 360, margin: '8px auto 0' }}>
                                    Enter the job's revenue value and priority. The AI will rank every available machine by Allocation Score: balancing throughput, failure risk, and maintenance cost.
                                </p>
                            </div>
                        )}

                        {findResult?.error && (
                            <div className="card-red" style={{ padding: 24 }}>
                                <p style={{ color: '#EF4444', fontFamily: 'IBM Plex Mono' }}>Error: {findResult.error}</p>
                            </div>
                        )}

                        {findResult && !findResult.error && (
                            <>
                                {/* Best Machine Banner */}
                                {findResult.best_machine ? (
                                    <div style={{ padding: 22, borderRadius: 4, border: '1px solid rgba(6,182,212,0.35)', background: 'rgba(6,182,212,0.06)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                                            <div>
                                                <p style={{ fontFamily: 'Rajdhani', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#06B6D4' }}>Best Allocation Match</p>
                                                <p style={{ fontFamily: 'IBM Plex Mono', fontSize: 26, fontWeight: 700, color: '#E6EDF3', marginTop: 4 }}>{findResult.best_machine.Machine_ID}</p>
                                                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{findResult.best_machine.Machine_Type} · {findResult.best_machine.Risk_Tier}</p>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <p style={{ fontFamily: 'IBM Plex Mono', fontSize: 28, fontWeight: 700, color: '#F59E0B' }}>{findResult.best_machine.Allocation_Score.toFixed(4)}</p>
                                                <p style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Allocation Score</p>
                                            </div>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
                                            {[
                                                { label: 'Health Score', value: `${findResult.best_machine.Health_Score}`, color: findResult.best_machine.Health_Score >= 70 ? '#10B981' : '#F59E0B' },
                                                { label: 'Failure Risk', value: `${findResult.best_machine.Failure_Risk}%`, color: findResult.best_machine.Failure_Risk > 30 ? '#EF4444' : '#10B981' },
                                                { label: 'Start Hour', value: `${findResult.best_machine.Earliest_Start}h`, color: '#06B6D4' },
                                                { label: 'End Hour', value: `${findResult.best_machine.Earliest_End}h`, color: '#06B6D4' },
                                            ].map(d => (
                                                <div key={d.label} className="card" style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.02)' }}>
                                                    <p style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, marginBottom: 4 }}>{d.label}</p>
                                                    <p style={{ fontFamily: 'IBM Plex Mono', fontSize: 18, fontWeight: 700, color: d.color }}>{d.value}</p>
                                                </div>
                                            ))}
                                        </div>
                                        <div style={{ padding: '10px 14px', background: 'rgba(6,182,212,0.07)', borderRadius: 3, borderLeft: '2px solid #06B6D4', marginBottom: 14 }}>
                                            <p style={{ fontSize: 12, color: '#06B6D4', fontFamily: 'DM Sans', lineHeight: 1.5 }}>
                                                ⬡ AI: {findResult.recommendation}
                                            </p>
                                        </div>
                                        <button onClick={handleSubmitJob} disabled={submitting} className="btn-primary" style={{ width: '100%' }}>
                                            {submitting ? 'Submitting...' : `◉  SUBMIT JOB TO QUEUE (₹${jobForm.Revenue_Per_Job.toLocaleString()}, P${jobForm.Priority_Level})`}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="card-red" style={{ padding: 20 }}>
                                        <p style={{ color: '#EF4444', fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 16 }}>✗ No Valid Machine Found</p>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 8 }}>No {jobForm.Required_Machine_Type} machines can meet the deadline and capacity constraints. Try extending the deadline or reducing processing time.</p>
                                    </div>
                                )}

                                {/* Ranked Machine List */}
                                {findResult.ranked_machines?.length > 0 && (
                                    <div className="card" style={{ padding: 20 }}>
                                        <p className="section-title" style={{ marginBottom: 14 }}>All Candidate Machines — Ranked by Score</p>
                                        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, fontFamily: 'DM Sans' }}>
                                            {findResult.valid_machines}/{findResult.total_candidates} {jobForm.Required_Machine_Type} machines can take this job.
                                        </p>
                                        <table className="data-table">
                                            <thead>
                                                <tr><th>#</th><th>Machine ID</th><th>Health</th><th>Risk %</th><th>Start</th><th>Score</th></tr>
                                            </thead>
                                            <tbody>
                                                {findResult.ranked_machines.map((m, i) => (
                                                    <tr key={m.Machine_ID} style={{ background: i === 0 ? 'rgba(6,182,212,0.04)' : undefined }}>
                                                        <td style={{ fontFamily: 'IBM Plex Mono', color: i === 0 ? '#06B6D4' : 'var(--text-muted)', fontWeight: i === 0 ? 700 : 400 }}>{i === 0 ? '★' : i + 1}</td>
                                                        <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: i === 0 ? '#06B6D4' : 'var(--text-primary)' }}>{m.Machine_ID}</td>
                                                        <td><span style={{ fontFamily: 'IBM Plex Mono', color: m.Health_Score >= 70 ? '#10B981' : '#F59E0B' }}>{m.Health_Score}</span></td>
                                                        <td><span style={{ fontFamily: 'IBM Plex Mono', color: m.Failure_Risk > 30 ? '#EF4444' : '#10B981', fontWeight: 600 }}>{m.Failure_Risk}%</span></td>
                                                        <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: '#06B6D4' }}>{m.Earliest_Start}h</td>
                                                        <td style={{ fontFamily: 'IBM Plex Mono', color: '#F59E0B', fontWeight: 700 }}>{m.Allocation_Score.toFixed(4)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
