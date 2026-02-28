import { useMemo, useState } from 'react';

const PRIORITY_COLORS = { 1: '#EF4444', 2: '#F97316', 3: '#EAB308', 4: '#10B981', 5: '#22C55E' };
const RISK_COLORS = { Critical: '#EF4444', 'High Risk': '#F97316', 'At Risk': '#EAB308', Monitor: '#06B6D4', Healthy: '#10B981' };

// Simple Gantt using SVG
function GanttChart({ schedule }) {
    const [tooltip, setTooltip] = useState(null);
    const HORIZON = 168;
    const ROW_H = 36;
    const LABEL_W = 100;
    const BAR_H = 20;
    const BAR_PAD = 8;

    // Group by machine — take first 30 machines that have jobs
    const machineGroups = useMemo(() => {
        const groups = {};
        schedule.forEach(j => {
            if (!groups[j.Machine_ID]) groups[j.Machine_ID] = { mid: j.Machine_ID, type: j.Machine_Type, risk: j.Risk_Tier, jobs: [] };
            groups[j.Machine_ID].jobs.push(j);
        });
        return Object.values(groups).slice(0, 25);
    }, [schedule]);

    const svgH = ROW_H * machineGroups.length + 40;
    const svgW = 900;
    const chartW = svgW - LABEL_W - 20;

    const xScale = (h) => (h / HORIZON) * chartW;

    // Day labels (0-168 → Day 1-7)
    const dayLabels = [0, 24, 48, 72, 96, 120, 144, 168].map(h => ({
        h, x: xScale(h), label: h === 0 ? 'Day 1' : h === 168 ? '' : `Day ${h / 24 + 1}`
    }));

    return (
        <div style={{ position: 'relative', overflowX: 'auto' }}>
            <svg width={svgW} height={svgH} style={{ fontFamily: 'IBM Plex Mono', fontSize: 10 }}>
                {/* Background grid lines */}
                {dayLabels.map(d => (
                    <line key={d.h} x1={LABEL_W + d.x} y1={20} x2={LABEL_W + d.x} y2={svgH}
                        stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
                ))}
                {/* Day labels */}
                {dayLabels.map(d => (
                    <text key={d.h} x={LABEL_W + d.x + 2} y={14} fill="#484F58" fontSize={9}>{d.label}</text>
                ))}

                {/* Machine rows */}
                {machineGroups.map((mg, rowIdx) => {
                    const y = 20 + rowIdx * ROW_H;
                    const riskColor = RISK_COLORS[mg.risk] || '#8B949E';
                    return (
                        <g key={mg.mid}>
                            {/* Row bg */}
                            <rect x={0} y={y} width={svgW} height={ROW_H}
                                fill={rowIdx % 2 === 0 ? 'rgba(255,255,255,0.008)' : 'transparent'} />
                            {/* Machine label */}
                            <text x={4} y={y + ROW_H / 2 + 3} fill={riskColor} fontSize={9.5} fontWeight={600}>
                                {mg.mid}
                            </text>
                            <text x={4} y={y + ROW_H / 2 + 14} fill="#484F58" fontSize={8}>
                                {mg.type}
                            </text>
                            {/* Job bars */}
                            {mg.jobs.map(job => {
                                const barX = LABEL_W + xScale(job.Start_Hour);
                                const barW = Math.max(xScale(job.End_Hour - job.Start_Hour), 4);
                                const color = PRIORITY_COLORS[job.Priority_Level] || '#8B949E';
                                return (
                                    <g key={job.Job_ID}
                                        onMouseEnter={(e) => setTooltip({ job, x: e.clientX, y: e.clientY })}
                                        onMouseLeave={() => setTooltip(null)}
                                        style={{ cursor: 'pointer' }}>
                                        <rect x={barX} y={y + BAR_PAD / 2} width={barW} height={BAR_H}
                                            rx={2} fill={color} opacity={0.85}
                                            style={{ transition: 'opacity 0.15s' }} />
                                        {barW > 30 && (
                                            <text x={barX + 4} y={y + BAR_PAD / 2 + 13} fill="white" fontSize={8} fontWeight={600}>
                                                {job.Job_ID}
                                            </text>
                                        )}
                                    </g>
                                );
                            })}
                        </g>
                    );
                })}
            </svg>

            {/* Tooltip */}
            {tooltip && (
                <div style={{
                    position: 'fixed', left: tooltip.x + 12, top: tooltip.y - 10,
                    background: '#161B22', border: '1px solid rgba(245,158,11,0.25)',
                    borderRadius: 3, padding: '10px 14px', fontSize: 11, zIndex: 999,
                    fontFamily: 'IBM Plex Mono', pointerEvents: 'none', minWidth: 200,
                }}>
                    <p style={{ color: '#F59E0B', fontWeight: 700, marginBottom: 6 }}>{tooltip.job.Job_ID}</p>
                    <p style={{ color: '#8B949E' }}>Machine: <span style={{ color: '#E6EDF3' }}>{tooltip.job.Machine_ID}</span></p>
                    <p style={{ color: '#8B949E' }}>Hours: <span style={{ color: '#E6EDF3' }}>{tooltip.job.Start_Hour}h → {tooltip.job.End_Hour}h</span></p>
                    <p style={{ color: '#8B949E' }}>Revenue: <span style={{ color: '#10B981' }}>₹{tooltip.job.Revenue?.toFixed(0)}</span></p>
                    <p style={{ color: '#8B949E' }}>Priority: <span style={{ color: PRIORITY_COLORS[tooltip.job.Priority_Level] }}>P{tooltip.job.Priority_Level}</span></p>
                    <p style={{ color: '#8B949E' }}>Risk: <span style={{ color: RISK_COLORS[tooltip.job.Risk_Tier] || '#8B949E' }}>{tooltip.job.Risk_Tier}</span></p>
                </div>
            )}
        </div>
    );
}

export default function ProductionSchedule({ schedule, deferred, schedMetrics, machines, weights }) {
    const highRisk = useMemo(() =>
        [...machines].filter(m => m.Risk_Tier === 'Critical' || m.Risk_Tier === 'High Risk')
            .sort((a, b) => a.Health_Score - b.Health_Score)
            .slice(0, 10),
        [machines]);

    const totalRevenue = schedMetrics.total_revenue || schedule.reduce((s, j) => s + (j.Revenue || 0), 0);
    const avgRisk = schedMetrics.avg_risk || 0;
    const scheduled = schedMetrics.jobs_scheduled || schedule.length;
    const deferredCnt = schedMetrics.jobs_deferred || deferred.length;

    return (
        <div className="animate-in">
            <div style={{ marginBottom: 24 }}>
                <p className="section-title">Layer 2 — Production Schedule · Phase 4</p>
                <h1 className="page-title" style={{ marginTop: 4 }}>Optimized Production Schedule — Week View</h1>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Balanced: w1={weights.w1.toFixed(2)} · w2={weights.w2.toFixed(2)} · w3={weights.w3.toFixed(2)} &nbsp;|&nbsp;
                    Horizon: 168 hours (7 days)
                </p>
            </div>

            {/* Top KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
                {[
                    { label: 'Jobs Scheduled', value: `${scheduled}/200`, color: '#10B981', accent: '#10B981' },
                    { label: 'Total Revenue', value: `₹${(totalRevenue / 1000).toFixed(0)}K`, color: '#F59E0B', accent: '#F59E0B' },
                    { label: 'Jobs Deferred', value: deferredCnt, color: deferredCnt > 0 ? '#EF4444' : '#10B981', accent: '#EF4444' },
                    { label: 'Avg Machine Risk', value: avgRisk.toFixed(4), color: avgRisk > 0.2 ? '#EF4444' : '#10B981', accent: '#06B6D4' },
                ].map(k => (
                    <div key={k.label} className="kpi-card" style={{ '--kpi-accent': k.accent }}>
                        <p className="kpi-value" style={{ fontSize: 24, color: k.color }}>{k.value}</p>
                        <p className="kpi-label">{k.label}</p>
                    </div>
                ))}
            </div>

            {/* Priority Legend */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Sans' }}>Priority:</span>
                {[1, 2, 3, 4, 5].map(p => (
                    <span key={p} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 14, height: 8, borderRadius: 1, background: PRIORITY_COLORS[p], display: 'inline-block' }} />
                        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: 10, color: '#8B949E' }}>P{p}</span>
                    </span>
                ))}
            </div>

            {/* Gantt Chart */}
            <div className="card" style={{ padding: 16, marginBottom: 20, overflowX: 'auto' }}>
                <p className="section-title" style={{ marginBottom: 14 }}>
                    Schedule Gantt — {Math.min(schedule.length, 25)} machines shown · Y=Machine · X=Hours (0–168)
                </p>
                {schedule.length > 0 ? (
                    <GanttChart schedule={schedule} />
                ) : (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                        Schedule loading or backend offline — adjust weights to trigger refresh
                    </div>
                )}
            </div>

            {/* Bottom — two tables */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

                {/* High Risk Machines */}
                <div className="card" style={{ padding: 20 }}>
                    <p className="section-title" style={{ marginBottom: 14 }}>High-Risk Machines</p>
                    <table className="data-table">
                        <thead>
                            <tr><th>Machine</th><th>Type</th><th>Health</th><th>Risk</th><th>Action</th></tr>
                        </thead>
                        <tbody>
                            {(highRisk.length ? highRisk : [{ Machine_ID: '—', Machine_Type: '—', Health_Score: 0, Risk_Tier: '—' }]).map((m, i) => {
                                const h = Math.round(m.Health_Score || 0);
                                const c = h < 40 ? '#EF4444' : '#F97316';
                                return (
                                    <tr key={i}>
                                        <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }}>{m.Machine_ID}</td>
                                        <td style={{ fontSize: 12 }}>{m.Machine_Type}</td>
                                        <td><span style={{ fontFamily: 'IBM Plex Mono', fontSize: 12, color: c, fontWeight: 700 }}>{h}</span></td>
                                        <td><span className={`badge ${m.Risk_Tier === 'Critical' ? 'badge-critical' : 'badge-high'}`}>{m.Risk_Tier}</span></td>
                                        <td style={{ fontSize: 11, color: '#EF4444', fontFamily: 'DM Sans', fontWeight: 500 }}>
                                            {h < 40 ? 'Immediate PM' : 'Schedule PM'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Deferred Jobs */}
                <div className="card" style={{ padding: 20 }}>
                    <p className="section-title" style={{ marginBottom: 14 }}>
                        Deferred Jobs {deferred.length > 0 && <span className="badge badge-critical" style={{ marginLeft: 8 }}>{deferred.length}</span>}
                    </p>
                    {deferred.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '30px 20px', color: 'var(--text-muted)' }}>
                            <p style={{ fontSize: 28, marginBottom: 8 }}>✓</p>
                            <p style={{ fontFamily: 'DM Sans', fontSize: 13 }}>All 200 jobs successfully allocated</p>
                        </div>
                    ) : (
                        <table className="data-table">
                            <thead>
                                <tr><th>Job ID</th><th>Machine Type</th><th>Priority</th><th>Reason</th></tr>
                            </thead>
                            <tbody>
                                {deferred.map((d, i) => (
                                    <tr key={i}>
                                        <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }}>{d.Job_ID}</td>
                                        <td style={{ fontSize: 12 }}>{d.Required_Machine_Type}</td>
                                        <td><span style={{ fontFamily: 'IBM Plex Mono', color: PRIORITY_COLORS[d.Priority_Level] || '#8B949E' }}>P{d.Priority_Level}</span></td>
                                        <td style={{ fontSize: 11, color: '#F97316', fontFamily: 'DM Sans' }}>{d.Reason}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
