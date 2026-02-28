import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getShap } from '../api';

// ── Large Circular Gauge ──────────────────────────────────────────
function CircleGauge({ value, size = 160 }) {
    const r = (size - 20) / 2;
    const circ = 2 * Math.PI * r;
    const pct = Math.min(Math.max(value, 0), 100) / 100;
    const dash = pct * circ;
    const color = value >= 70 ? '#10B981' : value >= 40 ? '#F59E0B' : '#EF4444';
    return (
        <div style={{ position: 'relative', width: size, height: size }}>
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={12} />
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={12}
                    strokeLinecap="round" strokeDasharray={`${dash} ${circ}`}
                    style={{ filter: `drop-shadow(0 0 8px ${color})`, transition: 'stroke-dasharray 0.8s ease' }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 32, fontWeight: 700, color, lineHeight: 1 }}>{value}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Health Score</span>
            </div>
        </div>
    );
}

const SHAP_COLOR = ['#F59E0B', '#D97706', '#B45309', '#92400E', '#78350F'];

export default function OperatorIntelligence({ machines }) {
    const [selectedId, setSelectedId] = useState('');
    const [selected, setSelected] = useState(null);
    const [shapData, setShapData] = useState([]);

    useEffect(() => { getShap().then(setShapData).catch(() => { }); }, []);

    useEffect(() => {
        if (!selectedId) { setSelected(null); return; }
        const m = machines.find(m => m.Machine_ID === selectedId);
        setSelected(m || null);
    }, [selectedId, machines]);

    const featureImportance = useMemo(() => {
        if (shapData.length) return shapData.slice(0, 5);
        return [
            { feature: 'Last_Maintenance_Days', importance: 0.2968 },
            { feature: 'Failure_History_Count', importance: 0.1879 },
            { feature: 'Machine_Age', importance: 0.1548 },
            { feature: 'Risk_Score', importance: 0.1048 },
            { feature: 'Avg_Vibration', importance: 0.0942 },
        ];
    }, [shapData]);

    const maxImp = Math.max(...featureImportance.map(f => f.importance));

    const health = selected ? Math.round(selected.Health_Score || 0) : null;
    const risk = selected ? selected.Risk_Tier : null;
    const failProb = selected ? ((selected.Failure_Prob || 0) * 100).toFixed(1) : null;

    const recommendation = !selected ? null :
        health < 40 ? { type: 'critical', text: 'IMMEDIATE preventive maintenance required. Machine at critical failure risk.', color: '#EF4444' } :
            health < 60 ? { type: 'warning', text: 'Schedule preventive maintenance within 48–72 hours.', color: '#F59E0B' } :
                health < 80 ? { type: 'monitor', text: 'Monitor closely. Run predictive check in 7 days.', color: '#EAB308' } :
                    { type: 'ok', text: 'Machine is in good health. Proceed with normal operations.', color: '#10B981' };

    const badgeClass = risk === 'Critical' ? 'badge-critical' : risk === 'High Risk' ? 'badge-high' :
        risk === 'At Risk' ? 'badge-medium' : 'badge-healthy';

    const FIELDS = [
        { label: 'Machine Type', key: 'Machine_Type' },
        { label: 'Machine Age (years)', key: 'Machine_Age' },
        { label: 'Total Run Hours', key: 'Total_Run_Hours' },
        { label: 'Avg Load %', key: 'Avg_Load_Percentage' },
        { label: 'Avg Temperature °C', key: 'Avg_Temperature' },
        { label: 'Avg Vibration', key: 'Avg_Vibration' },
        { label: 'Energy Rate', key: 'Energy_Consumption_Rate' },
        { label: 'Last Maintenance', key: 'Last_Maintenance_Days', suffix: ' days' },
        { label: 'Failure History', key: 'Failure_History_Count', suffix: ' incidents' },
        { label: 'Daily Op Hours', key: 'Daily_Operating_Hours' },
    ];

    return (
        <div className="animate-in">
            <div style={{ marginBottom: 24 }}>
                <p className="section-title">Layer 1 — Operator Intelligence</p>
                <h1 className="page-title" style={{ marginTop: 4 }}>Machine Failure Predictor</h1>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Select a machine to view Phase 2 ML predictions, health scores, and maintenance recommendations.
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

                {/* LEFT — Input Panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                    {/* Machine Selector */}
                    <div className="card" style={{ padding: 20 }}>
                        <p className="section-title" style={{ marginBottom: 12 }}>Select Machine</p>
                        <select value={selectedId} onChange={e => setSelectedId(e.target.value)}>
                            <option value="">— Choose Machine ID —</option>
                            {machines.map(m => (
                                <option key={m.Machine_ID} value={m.Machine_ID}>
                                    {m.Machine_ID} — {m.Machine_Type} ({m.Risk_Tier})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Machine Fields */}
                    <div className="card" style={{ padding: 20 }}>
                        <p className="section-title" style={{ marginBottom: 14 }}>Machine Parameters</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
                            {FIELDS.map(f => (
                                <div key={f.key}>
                                    <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3, fontFamily: 'DM Sans', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}>{f.label}</p>
                                    <p style={{ fontFamily: 'IBM Plex Mono', fontSize: 13, color: selected ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                        {selected ? `${selected[f.key] ?? '—'}${f.suffix || ''}` : '—'}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* SHAP Feature Importance */}
                    <div className="card" style={{ padding: 20 }}>
                        <p className="section-title" style={{ marginBottom: 14 }}>Top 5 Failure Drivers (SHAP)</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {featureImportance.map((f, i) => (
                                <div key={f.feature}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>
                                            {i + 1}. {f.feature.replace(/_/g, ' ')}
                                        </span>
                                        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: SHAP_COLOR[i] }}>
                                            {f.importance.toFixed(4)}
                                        </span>
                                    </div>
                                    <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%',
                                            width: `${(f.importance / maxImp) * 100}%`,
                                            background: SHAP_COLOR[i],
                                            borderRadius: 2,
                                            transition: 'width 0.5s ease',
                                        }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* RIGHT — Prediction Output */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                    {/* Health Gauge */}
                    <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <p className="section-title" style={{ marginBottom: 16 }}>ML Prediction Output</p>
                        {selected ? (
                            <>
                                <CircleGauge value={health} />
                                <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
                                    <span className={`badge ${badgeClass}`}>{risk}</span>
                                    <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: 'var(--text-secondary)' }}>
                                        p(failure) = {failProb}%
                                    </span>
                                </div>
                            </>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                                <p style={{ fontSize: 40, marginBottom: 12 }}>◎</p>
                                <p style={{ fontFamily: 'DM Sans', fontSize: 13 }}>Select a machine to run prediction</p>
                            </div>
                        )}
                    </div>

                    {/* Prediction Details */}
                    {selected && (
                        <>
                            <div className="card" style={{ padding: 20 }}>
                                <p className="section-title" style={{ marginBottom: 14 }}>Prediction Details</p>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                                    {[
                                        { label: 'Failure Probability', value: `${failProb}%`, color: health < 40 ? '#EF4444' : '#F59E0B' },
                                        { label: 'Health Score', value: health, color: health >= 70 ? '#10B981' : health >= 40 ? '#F59E0B' : '#EF4444' },
                                        { label: 'Predicted Failure', value: selected.Failure_Predicted ? 'YES' : 'NO', color: selected.Failure_Predicted ? '#EF4444' : '#10B981' },
                                        { label: 'RUL (hours)', value: `${selected.Remaining_Useful_Life_Hours?.toFixed(0) ?? '—'}h`, color: 'var(--text-primary)' },
                                    ].map(d => (
                                        <div key={d.label} className="card" style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.02)' }}>
                                            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'DM Sans', fontWeight: 600 }}>{d.label}</p>
                                            <p style={{ fontFamily: 'IBM Plex Mono', fontSize: 20, fontWeight: 700, color: d.color }}>{d.value}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Recommendation */}
                            <div className="card" style={{ padding: 20, borderColor: recommendation.color, borderWidth: 1, background: `${recommendation.color}10` }}>
                                <p style={{ fontSize: 12, fontFamily: 'IBM Plex Mono', fontWeight: 700, color: recommendation.color, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                                    ◉ AI Recommendation
                                </p>
                                <p style={{ fontSize: 14, color: 'var(--text-primary)', fontFamily: 'DM Sans', lineHeight: 1.6 }}>
                                    {recommendation.text}
                                </p>
                                <p style={{ marginTop: 10, fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'IBM Plex Mono' }}>
                                    Based on: Last_Maintenance={selected.Last_Maintenance_Days}d · Vibration={selected.Avg_Vibration?.toFixed(2)} · Age={selected.Machine_Age}yr
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
