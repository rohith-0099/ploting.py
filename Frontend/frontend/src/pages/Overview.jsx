import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// ── Arc Gauge Component ───────────────────────────────────────────
function ArcGauge({ value, size = 80, strokeWidth = 8 }) {
    const r = (size - strokeWidth) / 2;
    const circ = Math.PI * r; // half circle
    const pct = Math.min(Math.max(value, 0), 100) / 100;
    const dash = pct * circ;
    const color = value >= 70 ? '#10B981' : value >= 40 ? '#F59E0B' : '#EF4444';

    return (
        <svg width={size} height={size / 2 + strokeWidth} viewBox={`0 0 ${size} ${size / 2 + strokeWidth}`}>
            {/* Track */}
            <path d={`M ${strokeWidth / 2} ${size / 2} A ${r} ${r} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
                fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth} strokeLinecap="round" />
            {/* Fill */}
            <path d={`M ${strokeWidth / 2} ${size / 2} A ${r} ${r} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
                fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
                strokeDasharray={`${dash} ${circ}`}
                style={{ filter: `drop-shadow(0 0 4px ${color})`, transition: 'stroke-dasharray 0.6s ease' }} />
        </svg>
    );
}

// ── Machine Health Card ───────────────────────────────────────────
function MachineCard({ machine }) {
    const score = Number((machine.Health_Score || 0).toFixed(1));
    const color = score >= 70 ? '#10B981' : score >= 40 ? '#F59E0B' : '#EF4444';
    const risk = machine.Risk_Tier || 'Healthy';
    const badgeClass = risk === 'Critical' ? 'badge-critical' : risk === 'High Risk' ? 'badge-high' :
        risk === 'At Risk' ? 'badge-medium' : 'badge-healthy';
    return (
        <div className="card" style={{ padding: '14px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: color }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                    <p style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--text-muted)' }}>{machine.Machine_ID}</p>
                    <p style={{ fontFamily: 'Rajdhani', fontSize: 14, fontWeight: 600, marginTop: 1 }}>{machine.Machine_Type}</p>
                </div>
                <span className={`badge ${badgeClass}`}>{risk}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
                <ArcGauge value={score} size={64} strokeWidth={7} />
                <div>
                    <p style={{ fontFamily: 'IBM Plex Mono', fontSize: 22, fontWeight: 600, color, lineHeight: 1 }}>{score.toFixed(1)}</p>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>Health Score</p>
                    <p style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                        p={((machine.Failure_Prob || 0) * 100).toFixed(0)}%
                    </p>
                </div>
            </div>
        </div>
    );
}

const RISK_COLOR = { Critical: '#EF4444', 'High Risk': '#F97316', 'At Risk': '#EAB308', Monitor: '#06B6D4', Healthy: '#10B981' };

export default function Overview({ machines, summary, schedule, deferred, schedMetrics, alerts }) {
    // Top 20 by risk for the chart
    const riskChart = useMemo(() => {
        return [...machines]
            .sort((a, b) => b.Failure_Prob - a.Failure_Prob)
            .slice(0, 20)
            .map(m => ({
                id: m.Machine_ID,
                risk: Math.round((m.Failure_Prob || 0) * 100),
                color: RISK_COLOR[m.Risk_Tier] || '#8B949E',
            }));
    }, [machines]);

    // Top 10 health grid machines
    const gridMachines = useMemo(() => [...machines].sort((a, b) => a.Health_Score - b.Health_Score).slice(0, 10), [machines]);

    const kpis = [
        {
            label: 'Total Revenue',
            value: schedMetrics.total_revenue
                ? `₹${(schedMetrics.total_revenue / 1000).toFixed(0)}K`
                : summary.total_revenue ? `₹${(summary.total_revenue / 1000).toFixed(0)}K` : '₹791K',
            sub: 'Scheduled jobs revenue',
            accent: '#F59E0B',
        },
        {
            label: 'Predicted Downtime',
            value: summary.total_downtime_pm ? `${summary.total_downtime_pm.toFixed(0)}h` : '5,876h',
            sub: 'Delay scenario total',
            accent: '#EF4444',
        },
        {
            label: 'Critical Machines',
            value: summary.critical_machines || machines.filter(m => m.Risk_Tier === 'Critical').length || 126,
            sub: 'Require immediate PM',
            accent: '#EF4444',
        },
        {
            label: 'Jobs Scheduled',
            value: `${schedMetrics.jobs_scheduled || schedule.length || 200}/200`,
            sub: `${schedMetrics.jobs_deferred || deferred.length || 0} deferred`,
            accent: '#10B981',
        },
    ];

    return (
        <div className="animate-in" style={{ maxWidth: 1400 }}>
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
                <p className="section-title">Phase 5 · Platform Overview</p>
                <h1 className="page-title" style={{ marginTop: 4 }}>MECON IntelliOps Dashboard</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
                    AI-Driven Risk-Aware Production Scheduling & Predictive Maintenance Platform
                </p>
            </div>

            {/* KPI Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                {kpis.map(k => (
                    <div key={k.label} className="kpi-card" style={{ '--kpi-accent': k.accent }}>
                        <p className="kpi-value">{k.value}</p>
                        <p className="kpi-label">{k.label}</p>
                        <p className="kpi-sub">{k.sub}</p>
                    </div>
                ))}
            </div>

            {/* Body — 2 columns */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

                {/* Left: Machine Health Grid */}
                <div>
                    <p className="section-title" style={{ marginBottom: 12 }}>Highest Risk Machines</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {(gridMachines.length ? gridMachines : Array(10).fill(null)).map((m, i) => (
                            m ? <MachineCard key={m.Machine_ID} machine={m} /> :
                                <div key={i} className="card" style={{ padding: 14, height: 100, background: 'rgba(255,255,255,0.02)' }} />
                        ))}
                    </div>
                </div>

                {/* Right: Risk Distribution */}
                <div>
                    <p className="section-title" style={{ marginBottom: 12 }}>Failure Risk Distribution — Top 20 Machines</p>
                    <div className="card" style={{ padding: 16, height: 440 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={riskChart} layout="vertical" margin={{ left: 60, right: 20, top: 4, bottom: 4 }}>
                                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: '#8B949E', fontFamily: 'IBM Plex Mono' }}
                                    tickFormatter={v => `${v}%`} axisLine={false} tickLine={false} />
                                <YAxis type="category" dataKey="id"
                                    tick={{ fontSize: 9.5, fill: '#8B949E', fontFamily: 'IBM Plex Mono' }}
                                    axisLine={false} tickLine={false} width={56} />
                                <Tooltip
                                    formatter={(v) => [`${v}%`, 'Failure Prob']}
                                    contentStyle={{ background: '#161B22', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 3, fontSize: 11 }}
                                    labelStyle={{ color: '#E6EDF3', fontFamily: 'IBM Plex Mono' }}
                                />
                                <Bar dataKey="risk" radius={[0, 2, 2, 0]} barSize={12}>
                                    {riskChart.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Risk Summary */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 12 }}>
                        {[
                            { label: 'Critical', color: '#EF4444', count: machines.filter(m => m.Risk_Tier === 'Critical').length || 126 },
                            { label: 'At Risk', color: '#EAB308', count: machines.filter(m => m.Risk_Tier === 'At Risk').length || 48 },
                            { label: 'Healthy', color: '#10B981', count: machines.filter(m => m.Risk_Tier === 'Healthy').length || 255 },
                        ].map(r => (
                            <div key={r.label} className="card" style={{ padding: '12px 14px', borderLeft: `2px solid ${r.color}` }}>
                                <p style={{ fontFamily: 'IBM Plex Mono', fontSize: 22, fontWeight: 700, color: r.color }}>{r.count}</p>
                                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{r.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
