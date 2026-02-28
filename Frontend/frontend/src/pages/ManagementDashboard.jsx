import HighRisk from '../components/HighRisk';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend,
  PieChart, Pie,
} from 'recharts';

const MACHINE_TYPE_COLORS = { CNC: '#6366f1', Milling: '#10b981', Lathe: '#f59e0b' };

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass p-3 text-xs shadow-2xl">
      <p className="font-bold text-white mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-bold text-white">{title}</h2>
      {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}

export default function ManagementDashboard({
  schedule, deferred, metrics, highRisk,
  loading, lastUpdated, onRefresh, onExport,
}) {
  // Revenue by machine type
  const revenueByType = ['CNC', 'Milling', 'Lathe'].map(t => ({
    name: t,
    Revenue:  Math.round(schedule.filter(j => j.RequiredMachineType === t).reduce((s, j) => s + (j.Revenue ?? 0), 0)),
    Jobs:     schedule.filter(j => j.RequiredMachineType === t).length,
    Deferred: deferred.filter(j => j.RequiredMachineType === t).length,
  }));

  // Priority breakdown for pie
  const priorityCounts = ['Critical', 'High', 'Medium', 'Low'].map((p, i) => ({
    name: p,
    value: schedule.filter(j => j.Priority === p).length,
    fill: ['#ef4444', '#f59e0b', '#6366f1', '#64748b'][i],
  }));

  // Radar: system health per machine type
  const radarData = ['CNC', 'Milling', 'Lathe'].map(t => {
    const typeJobs = schedule.filter(j => j.RequiredMachineType === t);
    const avgRisk  = typeJobs.length ? typeJobs.reduce((s, j) => s + (j.FailureProb ?? 0), 0) / typeJobs.length : 0;
    const avgScore = typeJobs.length ? typeJobs.reduce((s, j) => s + (j.Score ?? 0), 0) / typeJobs.length : 0;
    return {
      machine:    t,
      Throughput: Math.round((1 - avgRisk) * 100),
      Score:      Math.round(Math.max(0, avgScore) * 200),
      Utilization: Math.round((typeJobs.length / Math.max(schedule.length, 1)) * 100),
    };
  });

  const totalRevenue  = metrics?.totalRevenue ?? 0;
  const totalCost     = metrics?.totalCost ?? 0;
  const netProfit     = metrics?.netProfit ?? 0;
  const avgRisk       = ((metrics?.avgRisk ?? 0) * 100).toFixed(1);
  const criticalCount = highRisk.filter(m => m.Failure_Prob >= 0.8).length;

  return (
    <div className="p-6 space-y-8 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">📊 Management Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">
            Executive overview · Cost, throughput &amp; risk analytics
          </p>
        </div>
        <div className="flex gap-3">
          {lastUpdated && <span className="text-xs text-slate-500 font-mono self-center">Updated: {lastUpdated}</span>}
          <button onClick={onRefresh} className="px-4 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/35 text-indigo-300 text-sm font-semibold transition-all border border-indigo-500/30">
            🔄 Refresh
          </button>
          <button onClick={onExport} className="px-4 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/35 text-emerald-300 text-sm font-semibold transition-all border border-emerald-500/30">
            ⬇️ Export
          </button>
        </div>
      </div>

      {/* ── Executive KPI strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue',  val: `₹${Math.round(totalRevenue).toLocaleString()}`,  icon: '📈', grad: 'from-emerald-600/20 to-teal-600/10',      border: 'border-emerald-500/20' },
          { label: 'Net Profit',     val: `₹${Math.round(netProfit).toLocaleString()}`,     icon: '💰', grad: 'from-violet-600/20 to-purple-600/10',     border: 'border-violet-500/20'  },
          { label: 'Avg Machine Risk',val: `${avgRisk}%`,                                    icon: '⚠️', grad: 'from-rose-600/20 to-red-600/10',          border: 'border-rose-500/20'    },
          { label: 'Critical Alerts',val: criticalCount,                                     icon: '🚨', grad: 'from-orange-600/20 to-amber-600/10',      border: 'border-orange-500/20'  },
        ].map(({ label, val, icon, grad, border }) => (
          <div key={label} className={`glass p-5 bg-gradient-to-br ${grad} border ${border} rounded-2xl hover:scale-[1.02] transition-all`}>
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs text-slate-400 font-medium">{label}</span>
              <span className="text-xl">{icon}</span>
            </div>
            <div className="text-2xl font-bold text-white font-mono">{val}</div>
          </div>
        ))}
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue by machine type */}
        <div className="glass p-5 lg:col-span-2">
          <SectionHeader title="Revenue & Jobs by Machine Type" subtitle="Scheduled production breakdown" />
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenueByType} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left"  tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 12 }} />
              <Bar yAxisId="left"  dataKey="Revenue"  name="Revenue (₹)" radius={[6,6,0,0]}>
                {revenueByType.map((e, i) => <Cell key={i} fill={MACHINE_TYPE_COLORS[e.name]} />)}
              </Bar>
              <Bar yAxisId="right" dataKey="Jobs"     name="Jobs Scheduled"  fill="#6366f130" radius={[4,4,0,0]} />
              <Bar yAxisId="right" dataKey="Deferred" name="Jobs Deferred"   fill="#f59e0b30" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Priority pie */}
        <div className="glass p-5">
          <SectionHeader title="Priority Mix" subtitle="Scheduled jobs by priority" />
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={priorityCounts}
                cx="50%" cy="50%"
                innerRadius={55} outerRadius={85}
                paddingAngle={4}
                dataKey="value"
                label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}
                labelLine={false}
              >
                {priorityCounts.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Bottom row: Radar + High Risk ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* System health radar */}
        <div className="glass p-5">
          <SectionHeader title="Machine Type Health" subtitle="Throughput vs Utilization vs Score" />
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(255,255,255,0.08)" />
              <PolarAngleAxis dataKey="machine" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
              <Radar name="Throughput"  dataKey="Throughput"  stroke="#10b981" fill="#10b981" fillOpacity={0.15} dot={false} />
              <Radar name="Utilization" dataKey="Utilization" stroke="#6366f1" fill="#6366f1" fillOpacity={0.15} dot={false} />
              <Legend wrapperStyle={{ color: '#94a3b8', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* High-risk machines column */}
        <div className="lg:col-span-2 overflow-auto" style={{ maxHeight: '320px' }}>
          <SectionHeader title="⚠️ High-Risk Machine Alerts" subtitle={`${highRisk.length} machines above threshold — immediate action required`} />
          <HighRisk machines={highRisk} loading={loading} />
        </div>
      </div>

      {/* ── Cost & Downtime analysis ── */}
      <div className="glass p-5">
        <SectionHeader title="Cost & Downtime Summary" subtitle="Production cost breakdown and efficiency metrics" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Machining Cost',   val: `₹${Math.round(totalCost).toLocaleString()}`,                                              icon: '🔧', note: '@₹85/hr' },
            { label: 'Revenue/Cost Ratio', val: totalCost > 0 ? `${(totalRevenue / totalCost).toFixed(2)}x` : '—',                     icon: '📊', note: 'Higher is better' },
            { label: 'Jobs Scheduled',   val: metrics?.jobsScheduled ?? 0,                                                              icon: '✅', note: `of ${(metrics?.jobsScheduled ?? 0) + (metrics?.jobsDeferred ?? 0)} total` },
            { label: 'Throughput Rate',  val: `${metrics?.throughputRate ?? 0}%`,                                                       icon: '⚡', note: 'Schedule efficiency' },
          ].map(({ label, val, icon, note }) => (
            <div key={label} className="bg-white/4 rounded-xl p-4 border border-white/6">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs text-slate-500">{label}</span>
                <span className="text-lg">{icon}</span>
              </div>
              <div className="text-xl font-bold font-mono text-white">{val}</div>
              <div className="text-xs text-slate-500 mt-1">{note}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
