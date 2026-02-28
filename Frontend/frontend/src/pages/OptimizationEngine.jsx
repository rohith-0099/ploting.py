import { useState, useEffect, useMemo } from 'react';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts';

const PRESETS = [
    { label: 'Throughput Focus', w1: 1.00, w2: 0.00, w3: 0.00, color: '#F59E0B' },
    { label: 'Safety Focus', w1: 0.00, w2: 1.00, w3: 0.00, color: '#EF4444' },
    { label: 'Cost Focus', w1: 0.00, w2: 0.00, w3: 1.00, color: '#06B6D4' },
    { label: 'Balanced Default', w1: 0.50, w2: 0.30, w3: 0.20, color: '#10B981' },
    { label: 'Equal Weights', w1: 0.33, w2: 0.34, w3: 0.33, color: '#8B5CF6' },
];

export default function OptimizationEngine({ weights, setWeights, schedMetrics, sensitivity, schedule }) {
    const [rawW1, setRawW1] = useState(Math.round(weights.w1 * 100));
    const [rawW2, setRawW2] = useState(Math.round(weights.w2 * 100));
    const [rawW3, setRawW3] = useState(Math.round(weights.w3 * 100));

    // Normalise and push up
    function applyWeights(w1, w2, w3) {
        const total = w1 + w2 + w3 || 1;
        setWeights({ w1: w1 / total, w2: w2 / total, w3: w3 / total });
    }

    // Radar data — how much each objective is valued
    const radarData = useMemo(() => [
        { axis: 'THROUGHPUT', value: Math.round(weights.w1 * 100) },
        { axis: 'RISK AVOID', value: Math.round(weights.w2 * 100) },
        { axis: 'COST OPT', value: Math.round(weights.w3 * 100) },
    ], [weights]);

    const applyPreset = (p) => {
        setRawW1(Math.round(p.w1 * 100));
        setRawW2(Math.round(p.w2 * 100));
        setRawW3(Math.round(p.w3 * 100));
        setWeights({ w1: p.w1, w2: p.w2, w3: p.w3 });
    };

    const activePreset = PRESETS.find(p =>
        Math.abs(p.w1 - weights.w1) < 0.01 &&
        Math.abs(p.w2 - weights.w2) < 0.01 &&
        Math.abs(p.w3 - weights.w3) < 0.01
    );

    const total = rawW1 + rawW2 + rawW3;
    const norm = total > 0 ? total : 1;

    return (
        <div className="animate-in">
            <div style={{ marginBottom: 24 }}>
                <p className="section-title">Layer 2 — Multi-Objective Scheduling · Phase 4</p>
                <h1 className="page-title" style={{ marginTop: 4 }}>Optimization Engine</h1>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Adjust weights to control the trade-off between throughput, risk, and maintenance cost in real-time scheduling.
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20 }}>

                {/* LEFT — Controls */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                    {/* Objective Formula */}
                    <div className="card-amber" style={{ padding: 18 }}>
                        <p className="section-title" style={{ marginBottom: 10, color: 'var(--amber)' }}>Objective Function</p>
                        <div style={{ fontFamily: 'IBM Plex Mono', fontSize: 13, color: 'var(--text-primary)', lineHeight: 2 }}>
                            <span style={{ color: 'var(--amber)', fontWeight: 700 }}>Score(m,j)</span> =<br />
                            &nbsp;&nbsp;<span style={{ color: '#06B6D4' }}>w1</span> × T(m,j)<br />
                            &nbsp;&nbsp;<span style={{ color: '#EF4444' }}>− w2</span> × R(m)<br />
                            &nbsp;&nbsp;<span style={{ color: '#10B981' }}>− w3</span> × C(m)
                        </div>
                        <div className="divider" style={{ margin: '10px 0' }} />
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'DM Sans', lineHeight: 1.6 }}>
                            T(m,j) = throughput (revenue × priority)<br />
                            R(m) = failure risk (Phase 2 Failure_Prob)<br />
                            C(m) = maintenance cost (Phase 3 Expected_Cost)
                        </div>
                    </div>

                    {/* Weight Sliders */}
                    <div className="card" style={{ padding: 20 }}>
                        <p className="section-title" style={{ marginBottom: 16 }}>Weight Configuration</p>
                        {[
                            { label: '🏭 Throughput Priority', key: 'w1', raw: rawW1, set: setRawW1, color: '#06B6D4' },
                            { label: '⚠ Risk Minimization', key: 'w2', raw: rawW2, set: setRawW2, color: '#EF4444' },
                            { label: '💰 Cost Minimization', key: 'w3', raw: rawW3, set: setRawW3, color: '#10B981' },
                        ].map(s => (
                            <div key={s.key} style={{ marginBottom: 20 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                    <span style={{ fontSize: 13, fontFamily: 'DM Sans', fontWeight: 500, color: 'var(--text-primary)' }}>{s.label}</span>
                                    <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 14, fontWeight: 700, color: s.color }}>
                                        {((s.raw / norm) * 100).toFixed(0)}%
                                    </span>
                                </div>
                                <input type="range" min={0} max={100} step={1} value={s.raw}
                                    style={{ accentColor: s.color }}
                                    onChange={e => {
                                        const v = parseInt(e.target.value);
                                        s.set(v);
                                        const vals = { w1: rawW1, w2: rawW2, w3: rawW3, [s.key]: v };
                                        applyWeights(vals.w1, vals.w2, vals.w3);
                                    }} />
                            </div>
                        ))}
                        <div style={{ display: 'flex', gap: 6, borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 4 }}>
                            <div style={{ flex: 1, height: 3, background: '#06B6D4', borderRadius: 2, opacity: rawW1 / norm || 0.1, transition: 'opacity 0.3s' }} />
                            <div style={{ flex: 1, height: 3, background: '#EF4444', borderRadius: 2, opacity: rawW2 / norm || 0.1, transition: 'opacity 0.3s' }} />
                            <div style={{ flex: 1, height: 3, background: '#10B981', borderRadius: 2, opacity: rawW3 / norm || 0.1, transition: 'opacity 0.3s' }} />
                        </div>
                    </div>

                    {/* Preset Configs */}
                    <div className="card" style={{ padding: 20 }}>
                        <p className="section-title" style={{ marginBottom: 12 }}>Preset Configurations</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {PRESETS.map(p => (
                                <button key={p.label} onClick={() => applyPreset(p)}
                                    className={activePreset?.label === p.label ? 'btn-primary' : 'btn-secondary'}
                                    style={{
                                        textAlign: 'left', padding: '9px 14px',
                                        borderLeft: `3px solid ${p.color}`,
                                        fontFamily: 'DM Sans', fontSize: 12, fontWeight: 600,
                                        background: activePreset?.label === p.label ? `${p.color}20` : 'transparent',
                                        color: activePreset?.label === p.label ? p.color : 'var(--text-secondary)',
                                        border: `1px solid ${activePreset?.label === p.label ? p.color : 'rgba(255,255,255,0.08)'}`,
                                        borderRadius: 3,
                                    }}>
                                    {p.label}
                                    <span style={{ float: 'right', fontFamily: 'IBM Plex Mono', fontSize: 10, opacity: 0.6 }}>
                                        {Math.round(p.w1 * 100)}/{Math.round(p.w2 * 100)}/{Math.round(p.w3 * 100)}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Constraints */}
                    <div className="card" style={{ padding: 16 }}>
                        <p className="section-title" style={{ marginBottom: 10 }}>Hard Constraints</p>
                        {[
                            { label: 'Planning Horizon', value: '168h (1 week)' },
                            { label: 'Total Machines', value: '500' },
                            { label: 'Total Jobs', value: '200' },
                            { label: 'Type Matching', value: 'Enforced' },
                            { label: 'Deadline Check', value: 'Enforced' },
                            { label: 'Maint Windows', value: 'Blocked' },
                        ].map(c => (
                            <div key={c.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{c.label}</span>
                                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--amber)' }}>{c.value}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT — Charts + Results */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                    {/* Live Results */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
                        {[
                            { label: 'Jobs Scheduled', value: schedMetrics.jobs_scheduled ?? schedule.length ?? '—', color: '#10B981', accent: '#10B981' },
                            { label: 'Total Revenue', value: schedMetrics.total_revenue ? `₹${(schedMetrics.total_revenue / 1000).toFixed(0)}K` : '₹791K', color: '#F59E0B', accent: '#F59E0B' },
                            { label: 'Avg Risk', value: schedMetrics.avg_risk?.toFixed(3) ?? '0.008', color: schedMetrics.avg_risk > 0.2 ? '#EF4444' : '#10B981', accent: '#06B6D4' },
                        ].map(k => (
                            <div key={k.label} className="kpi-card" style={{ '--kpi-accent': k.accent }}>
                                <p className="kpi-value" style={{ color: k.color, fontSize: 24 }}>{k.value}</p>
                                <p className="kpi-label">{k.label}</p>
                                <p className="kpi-sub">w1={weights.w1.toFixed(2)} w2={weights.w2.toFixed(2)} w3={weights.w3.toFixed(2)}</p>
                            </div>
                        ))}
                    </div>

                    {/* Radar Chart */}
                    <div className="card" style={{ padding: 20, height: 280 }}>
                        <p className="section-title" style={{ marginBottom: 8 }}>Objective Balance Radar</p>
                        <ResponsiveContainer width="100%" height="85%">
                            <RadarChart data={radarData} margin={{ top: 4, right: 30, bottom: 4, left: 30 }}>
                                <PolarGrid stroke="rgba(255,255,255,0.08)" />
                                <PolarAngleAxis dataKey="axis" tick={{ fill: '#8B949E', fontSize: 11, fontFamily: 'IBM Plex Mono' }} />
                                <Radar dataKey="value" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.15} strokeWidth={2}
                                    dot={{ r: 4, fill: '#F59E0B' }} />
                                <Tooltip formatter={(v) => [`${v}%`]} contentStyle={{ background: '#161B22', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 3, fontSize: 11 }} />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Sensitivity Table */}
                    <div className="card" style={{ padding: 20 }}>
                        <p className="section-title" style={{ marginBottom: 14 }}>Weight Sensitivity Analysis — Phase 4 Results</p>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Configuration</th>
                                        <th>w1</th><th>w2</th><th>w3</th>
                                        <th>Scheduled</th>
                                        <th>Revenue</th>
                                        <th>Avg Risk</th>
                                        <th>Avg Cost</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(sensitivity.length ? sensitivity : PRESETS.map(p => ({
                                        Weight_Label: p.label, w1_throughput: p.w1, w2_risk: p.w2, w3_cost: p.w3,
                                        Jobs_Scheduled: 200, Total_Revenue: 791125, Avg_Machine_Risk: p.w2 === 1 ? 0.005 : p.w1 === 1 ? 0.238 : 0.008,
                                        Avg_Machine_Cost_Norm: p.w3 === 1 ? 0.358 : 0.67,
                                    }))).map((row, i) => {
                                        const isActive = activePreset?.label === row.Weight_Label;
                                        return (
                                            <tr key={i} style={{ background: isActive ? 'rgba(245,158,11,0.05)' : undefined }}>
                                                <td style={{ fontWeight: isActive ? 700 : 400, color: isActive ? 'var(--amber)' : 'var(--text-primary)' }}>
                                                    {isActive && '▶ '}{row.Weight_Label}
                                                </td>
                                                <td style={{ fontFamily: 'IBM Plex Mono', color: '#06B6D4' }}>{(row.w1_throughput || 0).toFixed(2)}</td>
                                                <td style={{ fontFamily: 'IBM Plex Mono', color: '#EF4444' }}>{(row.w2_risk || 0).toFixed(2)}</td>
                                                <td style={{ fontFamily: 'IBM Plex Mono', color: '#10B981' }}>{(row.w3_cost || 0).toFixed(2)}</td>
                                                <td style={{ fontFamily: 'IBM Plex Mono' }}>{row.Jobs_Scheduled}</td>
                                                <td style={{ fontFamily: 'IBM Plex Mono', color: '#F59E0B' }}>₹{((row.Total_Revenue || 0) / 1000).toFixed(0)}K</td>
                                                <td style={{ fontFamily: 'IBM Plex Mono', color: (row.Avg_Machine_Risk || 0) > 0.15 ? '#EF4444' : '#10B981' }}>
                                                    {(row.Avg_Machine_Risk || 0).toFixed(3)}
                                                </td>
                                                <td style={{ fontFamily: 'IBM Plex Mono' }}>{(row.Avg_Machine_Cost_Norm || 0).toFixed(3)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
