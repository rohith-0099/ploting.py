import WeightSliders from '../components/WeightSliders';
import MetricsKPI    from '../components/MetricsKPI';
import JobTable      from '../components/JobTable';
import GanttChart    from '../components/GanttChart';
import FileUpload    from '../components/FileUpload';

export default function OperatorDashboard({
  weights, setWeights,
  schedule, deferred, metrics, highRisk,
  loading, backendOnline,
  onRefresh, onExport, onUpload, lastUpdated,
}) {
  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* ── Page header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            🖥️ Operator Dashboard
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time weight-based production scheduling · Phase 4 AI Engine
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-slate-500 font-mono">
              Last updated: {lastUpdated}
            </span>
          )}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/35 text-indigo-300 text-sm font-semibold transition-all border border-indigo-500/30 disabled:opacity-50"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
            ) : '🔄'} Refresh
          </button>
          <button
            onClick={onExport}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/35 text-emerald-300 text-sm font-semibold transition-all border border-emerald-500/30"
          >
            ⬇️ Export
          </button>
        </div>
      </div>

      {/* ── Checkpoint badges ── */}
      <div className="flex gap-2 flex-wrap">
        {[
          { icon: '✅', label: 'Functional operator interface' },
          { icon: '⚡', label: 'Real-time simulation' },
          { icon: '📋', label: 'Optimized schedule' },
          { icon: '⚠️', label: 'High-risk display' },
          { icon: '⏸️', label: 'Deferred + justification' },
        ].map(({ icon, label }) => (
          <span key={label} className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {icon} {label}
          </span>
        ))}
      </div>

      {/* ── Main 3-column grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: Controls */}
        <div className="space-y-4">
          <FileUpload onUpload={onUpload} backendOnline={backendOnline} />
          <WeightSliders weights={weights} onChange={setWeights} />

          {/* Quick stats */}
          <div className="glass p-4 space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Schedule Summary</h3>
            <div className="space-y-2">
              {[
                { label: 'Total Jobs', val: (schedule.length + deferred.length), color: 'text-white' },
                { label: 'Scheduled',  val: schedule.length, color: 'text-emerald-400' },
                { label: 'Deferred',   val: deferred.length, color: 'text-amber-400' },
                { label: 'Success Rate', val: `${metrics.throughputRate ?? 0}%`, color: 'text-indigo-400' },
              ].map(({ label, val, color }) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="text-xs text-slate-500">{label}</span>
                  <span className={`text-sm font-bold font-mono ${color}`}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CENTER: KPIs + Gantt */}
        <div className="space-y-4">
          <MetricsKPI metrics={metrics} loading={loading} />
          <GanttChart schedule={schedule} loading={loading} />
        </div>

        {/* RIGHT: Job Tables */}
        <div>
          <JobTable schedule={schedule} deferred={deferred} loading={loading} />
        </div>
      </div>
    </div>
  );
}
