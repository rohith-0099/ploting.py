const fmt  = n => (n ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
const fmtD = n => (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CARDS = [
  {
    key: 'totalRevenue',
    label: 'Total Revenue',
    prefix: '₹',
    icon: '📈',
    gradient: 'from-emerald-600 to-teal-700',
    glow: 'rgba(16,185,129,0.25)',
    format: fmt,
  },
  {
    key: 'netProfit',
    label: 'Net Profit',
    prefix: '₹',
    icon: '💰',
    gradient: 'from-violet-600 to-purple-700',
    glow: 'rgba(139,92,246,0.25)',
    format: fmt,
  },
  {
    key: 'jobsScheduled',
    label: 'Jobs Scheduled',
    prefix: '',
    suffix: ' jobs',
    icon: '✅',
    gradient: 'from-blue-600 to-indigo-700',
    glow: 'rgba(99,102,241,0.25)',
    format: x => x,
  },
  {
    key: 'jobsDeferred',
    label: 'Jobs Deferred',
    prefix: '',
    suffix: ' jobs',
    icon: '⏸️',
    gradient: 'from-amber-600 to-orange-700',
    glow: 'rgba(245,158,11,0.25)',
    format: x => x,
  },
  {
    key: 'throughputRate',
    label: 'Throughput Rate',
    prefix: '',
    suffix: '%',
    icon: '⚡',
    gradient: 'from-cyan-600 to-sky-700',
    glow: 'rgba(6,182,212,0.25)',
    format: fmtD,
  },
  {
    key: 'avgRisk',
    label: 'Avg Machine Risk',
    prefix: '',
    suffix: '',
    icon: '⚠️',
    gradient: 'from-rose-600 to-red-700',
    glow: 'rgba(239,68,68,0.25)',
    format: x => ((x ?? 0) * 100).toFixed(1) + '%',
  },
];

export default function MetricsKPI({ metrics = {}, loading = false }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {CARDS.map(c => (
          <div key={c.key} className="glass p-4 space-y-2">
            <div className="skeleton h-4 w-16 rounded" />
            <div className="skeleton h-7 w-24 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-400 tracking-widest uppercase pl-1">Key Performance Indicators</h3>
      <div className="grid grid-cols-2 gap-3">
        {CARDS.map(({ key, label, prefix, suffix, icon, gradient, glow, format }) => {
          const value = metrics[key];
          const display = value !== undefined ? format(value) : '—';
          return (
            <div
              key={key}
              className={`relative overflow-hidden glass p-4 rounded-2xl animate-fade-in hover:scale-[1.02] transition-all duration-200 cursor-default`}
              style={{ boxShadow: `0 0 20px ${glow}` }}
            >
              {/* Gradient bg accent */}
              <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-10 pointer-events-none`} />
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-400 leading-tight">{label}</span>
                  <span className="text-lg">{icon}</span>
                </div>
                <div className="text-xl font-bold text-white font-mono tracking-tight">
                  {prefix}{display}{suffix}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Throughput bar */}
      {metrics.throughputRate !== undefined && (
        <div className="glass p-3 rounded-xl">
          <div className="flex justify-between text-xs text-slate-400 mb-1.5">
            <span>Schedule Efficiency</span>
            <span className="text-emerald-400 font-mono font-semibold">{fmtD(metrics.throughputRate)}%</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(metrics.throughputRate || 0, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
