import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine
} from 'recharts';

const TYPE_COLORS = {
  CNC:     '#6366f1',
  Milling: '#10b981',
  Lathe:   '#f59e0b',
};

const PRIORITY_ALPHA = { Critical: 1, High: 0.85, Medium: 0.7, Low: 0.55 };

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="glass-strong p-3 text-xs space-y-1 shadow-2xl min-w-[180px]">
      <p className="font-bold text-white text-sm">{d.JobID}</p>
      <p className="text-slate-300">{d.RequiredMachineType} → <span className="text-cyan-300 font-mono">{d.AssignedMachine}</span></p>
      <p className="text-slate-300">Priority: <span className="text-amber-400">{d.Priority}</span></p>
      <p className="text-emerald-400">Revenue: ₹{(d.Revenue ?? 0).toLocaleString()}</p>
      <p className="text-slate-400 font-mono">{d.StartTime?.toFixed(1)}h → {d.EndTime?.toFixed(1)}h</p>
      <p className="text-rose-400">Risk: {((d.FailureProb ?? 0) * 100).toFixed(0)}%</p>
      <p className="text-indigo-300">Score: {d.Score?.toFixed(4)}</p>
    </div>
  );
}

export default function GanttChart({ schedule = [], loading = false }) {
  if (loading) {
    return (
      <div className="glass p-5 space-y-3">
        <div className="skeleton h-5 w-32 rounded" />
        <div className="skeleton h-48 w-full rounded" />
      </div>
    );
  }

  // Show top 20 by score for readability
  const topJobs = [...schedule]
    .sort((a, b) => (b.Score ?? 0) - (a.Score ?? 0))
    .slice(0, 20);

  // Build chart data: for stacked bar trick, offset = start, duration = end - start
  const chartData = topJobs.map(j => ({
    ...j,
    name: j.JobID,
    offset:   +(j.StartTime ?? 0).toFixed(1),
    duration: +((j.EndTime ?? 0) - (j.StartTime ?? 0)).toFixed(1),
  }));

  const maxEnd = Math.max(...topJobs.map(j => j.EndTime ?? 0), 1);

  return (
    <div className="glass p-4 animate-fade-in space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Production Timeline</h3>
          <p className="text-xs text-slate-400">Top {topJobs.length} jobs by score</p>
        </div>
        {/* Legend */}
        <div className="flex gap-3">
          {Object.entries(TYPE_COLORS).map(([t, c]) => (
            <span key={t} className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: c }} />
              {t}
            </span>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={Math.max(topJobs.length * 24 + 40, 200)}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 16, left: 40, bottom: 0 }}
          barCategoryGap="20%"
        >
          <XAxis
            type="number"
            domain={[0, Math.ceil(maxEnd)]}
            tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono' }}
            tickFormatter={v => `${v}h`}
            axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'JetBrains Mono' }}
            width={36}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          {/* Invisible offset bar */}
          <Bar dataKey="offset" stackId="gantt" fill="transparent" radius={0} />
          {/* Visible duration bar */}
          <Bar dataKey="duration" stackId="gantt" radius={[3, 3, 3, 3]} className="gantt-bar">
            {chartData.map((entry, i) => (
              <Cell
                key={i}
                fill={TYPE_COLORS[entry.RequiredMachineType] || '#6366f1'}
                opacity={PRIORITY_ALPHA[entry.Priority] ?? 0.7}
              />
            ))}
          </Bar>
          <ReferenceLine x={0} stroke="rgba(255,255,255,0.15)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
