import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { getPhase3 } from '../api';

export default function MaintenanceSimulation({ machines }) {
    const [selectedId, setSelectedId] = useState('');
    const [scenarios, setScenarios] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!selectedId) { setScenarios([]); return; }
        setLoading(true);
        getPhase3(selectedId)
            .then(data => setScenarios(data))
            .catch(() => setScenarios([]))
            .finally(() => setLoading(false));
    }, [selectedId]);

    const scenA = scenarios.find(s => s.Scenario_Name === 'Preventive Now');
    const scenB = scenarios.find(s => s.Scenario_Name === 'Delay 72h');

    const compData = scenA && scenB ? [
        { name: 'Maint Cost', A: Math.round(scenA.Expected_Maintenance_Cost), B: Math.round(scenB.Expected_Maintenance_Cost) },
        { name: 'Downtime Cost', A: Math.round(scenA.Expected_Downtime_Cost), B: Math.round(scenB.Expected_Downtime_Cost) },
        { name: 'Prod Loss', A: Math.round(scenA.Expected_Production_Loss), B: Math.round(scenB.Expected_Production_Loss) },
        { name: 'Total Cost', A: Math.round(scenA.Expected_Total_Cost), B: Math.round(scenB.Expected_Total_Cost) },
    ] : [];

    const fmt = v => v >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : v >= 1000 ? `₹${(v / 1000).toFixed(0)}K` : `₹${v}`;

    return (
        <div className="animate-in">
            <div style={{ marginBottom: 24 }}>
                <p className="section-title">Layer 1 — Maintenance Simulation · Phase 3</p>
                <h1 className="page-title" style={{ marginTop: 4 }}>Maintenance Scenario Comparator</h1>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Compare Preventive Now vs Delay 72h scenarios using Phase 2 risk × Phase 3 cost models.
                </p>
            </div>

            {/* Machine selector */}
            <div className="card" style={{ padding: 20, marginBottom: 20 }}>
                <p className="section-title" style={{ marginBottom: 10 }}>Select Machine</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
                    <select value={selectedId} onChange={e => setSelectedId(e.target.value)}>
                        <option value="">— Choose Machine ID to simulate —</option>
                        {machines.map(m => (
                            <option key={m.Machine_ID} value={m.Machine_ID}>
                                {m.Machine_ID} — {m.Machine_Type} — {m.Risk_Tier} (p={((m.Failure_Prob || 0) * 100).toFixed(0)}%)
                            </option>
                        ))}
                    </select>
                    {selectedId && <span style={{ display: 'flex', alignItems: 'center', fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        Phase 3 Simulation
                    </span>}
                </div>
            </div>

            {loading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading simulation data...</div>}

            {!selectedId && !loading && (
                <div className="card" style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
                    <p style={{ fontSize: 36, marginBottom: 12 }}>◉</p>
                    <p style={{ fontFamily: 'DM Sans', fontSize: 14 }}>Select a machine above to view scenario comparison</p>
                </div>
            )}

            {scenA && scenB && (
                <>
                    {/* Two scenario cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

                        {/* Scenario A */}
                        <div style={{ border: '1px solid rgba(6,182,212,0.3)', borderRadius: 4, background: 'rgba(6,182,212,0.05)', padding: 24 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                                <div>
                                    <p style={{ fontFamily: 'Rajdhani', fontSize: 18, fontWeight: 700, color: '#06B6D4' }}>SCENARIO A</p>
                                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>Preventive Now — Immediate PM</p>
                                </div>
                                <span className="badge badge-teal">RECOMMENDED</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                {[
                                    { label: 'Maintenance Start', value: `Hour ${scenA.Maintenance_Start_Hour}` },
                                    { label: 'Expected Downtime', value: `${scenA.Expected_Downtime_Hours?.toFixed(1)}h` },
                                    { label: 'Maintenance Cost', value: fmt(scenA.Expected_Maintenance_Cost) },
                                    { label: 'Downtime Cost', value: fmt(scenA.Expected_Downtime_Cost) },
                                    { label: 'Production Loss', value: fmt(scenA.Expected_Production_Loss) },
                                    { label: 'TOTAL COST', value: fmt(scenA.Expected_Total_Cost), bold: true },
                                ].map(r => (
                                    <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 10 }}>
                                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>{r.label}</span>
                                        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: r.bold ? 16 : 14, fontWeight: r.bold ? 700 : 600, color: r.bold ? '#06B6D4' : 'var(--text-primary)' }}>{r.value}</span>
                                    </div>
                                ))}
                            </div>
                            <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(6,182,212,0.08)', borderRadius: 3, borderLeft: '2px solid #06B6D4' }}>
                                <p style={{ fontSize: 11, color: '#06B6D4', fontFamily: 'DM Sans', lineHeight: 1.5 }}>
                                    {scenA.Decision_Reason}
                                </p>
                            </div>
                        </div>

                        {/* Scenario B */}
                        <div style={{ border: '1px solid rgba(239,68,68,0.3)', borderRadius: 4, background: 'rgba(239,68,68,0.04)', padding: 24 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                                <div>
                                    <p style={{ fontFamily: 'Rajdhani', fontSize: 18, fontWeight: 700, color: '#EF4444' }}>SCENARIO B</p>
                                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>Delay 72h — Corrective Risk</p>
                                </div>
                                <span className="badge badge-critical">HIGH RISK</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                {[
                                    { label: 'Delay Window', value: '72 hours' },
                                    { label: 'Expected Downtime', value: `${scenB.Expected_Downtime_Hours?.toFixed(1)}h` },
                                    { label: 'Corrective Cost', value: fmt(scenB.Expected_Maintenance_Cost) },
                                    { label: 'Downtime Cost', value: fmt(scenB.Expected_Downtime_Cost) },
                                    { label: 'Production Loss', value: fmt(scenB.Expected_Production_Loss) },
                                    { label: 'TOTAL COST', value: fmt(scenB.Expected_Total_Cost), bold: true },
                                ].map(r => (
                                    <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 10 }}>
                                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'DM Sans' }}>{r.label}</span>
                                        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: r.bold ? 16 : 14, fontWeight: r.bold ? 700 : 600, color: r.bold ? '#EF4444' : 'var(--text-primary)' }}>{r.value}</span>
                                    </div>
                                ))}
                            </div>
                            <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(239,68,68,0.07)', borderRadius: 3, borderLeft: '2px solid #EF4444' }}>
                                <p style={{ fontSize: 11, color: '#EF4444', fontFamily: 'DM Sans', lineHeight: 1.5 }}>
                                    Failure Prob = {((scenB.Failure_Prob || 0) * 100).toFixed(1)}% — Emergency corrective repair risk is high.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Comparison Chart */}
                    <div className="card" style={{ padding: 20 }}>
                        <p className="section-title" style={{ marginBottom: 16 }}>Cost Comparison — Preventive vs Corrective</p>
                        <div style={{ height: 260 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={compData} margin={{ left: 20, right: 20, top: 4, bottom: 4 }}>
                                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#8B949E', fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 10, fill: '#8B949E', fontFamily: 'IBM Plex Mono' }} tickFormatter={v => fmt(v)} axisLine={false} tickLine={false} />
                                    <Tooltip formatter={(v, n) => [fmt(v), n === 'A' ? 'Preventive Now' : 'Delay 72h']}
                                        contentStyle={{ background: '#161B22', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 3, fontSize: 11 }} />
                                    <Legend formatter={v => v === 'A' ? 'Preventive Now' : 'Delay 72h'} wrapperStyle={{ fontSize: 11 }} />
                                    <Bar dataKey="A" fill="#06B6D4" radius={[2, 2, 0, 0]} name="A" />
                                    <Bar dataKey="B" fill="#EF4444" radius={[2, 2, 0, 0]} name="B" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
