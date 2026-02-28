import { useState, useRef } from 'react';

const PRIORITY_COLOR = {
  Critical: 'bg-rose-500/20 text-rose-400 border border-rose-500/30',
  High:     'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  Medium:   'bg-blue-500/20  text-blue-400  border border-blue-500/30',
  Low:      'bg-slate-500/20 text-slate-400 border border-slate-500/30',
};

function RiskDot({ prob }) {
  const pct = Math.round((prob ?? 0) * 100);
  const cls =
    pct >= 80 ? 'bg-rose-500' :
    pct >= 60 ? 'bg-orange-500' :
    pct >= 40 ? 'bg-amber-500' :
               'bg-emerald-500';
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block w-2 h-2 rounded-full ${cls}`} />
      <span className="font-mono text-xs">{pct}%</span>
    </span>
  );
}

function ScoreTooltip({ breakdown }) {
  if (!breakdown) return null;
  return (
    <div className="tooltip-content text-slate-300">
      <p className="font-semibold text-white text-xs mb-2">Score Breakdown</p>
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-emerald-400">Throughput</span>
          <span className="font-mono">{breakdown.throughput?.toFixed(4)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-rose-400">Risk Penalty</span>
          <span className="font-mono">{breakdown.risk?.toFixed(4)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-amber-400">Cost Penalty</span>
          <span className="font-mono">{breakdown.cost?.toFixed(4)}</span>
        </div>
        <div className="flex justify-between text-xs border-t border-white/10 pt-1 mt-1">
          <span className="text-white font-semibold">Total Score</span>
          <span className="font-mono text-indigo-400 font-bold">{breakdown.total?.toFixed(4)}</span>
        </div>
      </div>
    </div>
  );
}

export default function JobTable({ schedule = [], deferred = [], loading = false }) {
  const [tab, setTab] = useState('scheduled');
  const [sortKey, setSortKey] = useState('Score');
  const [sortAsc, setSortAsc] = useState(false);
  const [filter, setFilter] = useState('All');

  const handleSort = key => {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(false); }
  };

  const priorities = ['All', 'Critical', 'High', 'Medium', 'Low'];

  const filtered = schedule.filter(j => filter === 'All' || j.Priority === filter);
  const sorted = [...filtered].sort((a, b) => {
    const av = a[sortKey] ?? 0, bv = b[sortKey] ?? 0;
    if (typeof av === 'string') return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    return sortAsc ? av - bv : bv - av;
  });

  const SortIcon = ({ k }) =>
    sortKey === k ? <span className="text-indigo-400">{sortAsc ? '↑' : '↓'}</span> : <span className="text-slate-600">↕</span>;

  return (
    <div className="glass flex flex-col animate-fade-in" style={{ maxHeight: '420px' }}>
      {/* Tabs */}
      <div className="flex gap-1 p-3 border-b border-white/8">
        {['scheduled', 'deferred'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
              tab === t
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {t === 'scheduled' ? `✅ Scheduled (${schedule.length})` : `⏸️ Deferred (${deferred.length})`}
          </button>
        ))}
      </div>

      {tab === 'scheduled' && (
        <>
          {/* Filter pills */}
          <div className="flex gap-1.5 px-3 py-2.5 flex-wrap border-b border-white/5">
            {priorities.map(p => (
              <button
                key={p}
                onClick={() => setFilter(p)}
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-all ${
                  filter === p
                    ? 'bg-indigo-500/30 text-indigo-300 border border-indigo-500/40'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="overflow-auto flex-1">
            {loading ? (
              <div className="p-4 space-y-2">
                {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-8 w-full rounded" />)}
              </div>
            ) : (
              <table className="mecon-table">
                <thead className="sticky top-0 bg-slate-900/90 backdrop-blur-sm">
                  <tr>
                    {['JobID', 'Priority', 'AssignedMachine', 'Revenue', 'Score'].map(col => (
                      <th key={col} onClick={() => handleSort(col)} className="cursor-pointer hover:text-slate-200 transition-colors select-none">
                        <span className="flex items-center gap-1">{col} <SortIcon k={col} /></span>
                      </th>
                    ))}
                    <th>Risk</th>
                    <th>Window</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(job => (
                    <tr key={job.JobID} className="tooltip-trigger">
                      <ScoreTooltip breakdown={job.ScoreBreakdown} />
                      <td className="font-mono text-indigo-300 font-medium">{job.JobID}</td>
                      <td><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${PRIORITY_COLOR[job.Priority]}`}>{job.Priority}</span></td>
                      <td className="text-cyan-300 font-mono text-xs">{job.AssignedMachine}</td>
                      <td className="text-emerald-400 font-mono text-xs">₹{(job.Revenue ?? 0).toLocaleString()}</td>
                      <td className="font-mono text-indigo-400 font-bold text-xs">{job.Score?.toFixed(3)}</td>
                      <td><RiskDot prob={job.FailureProb} /></td>
                      <td className="text-slate-400 text-xs font-mono whitespace-nowrap">{job.StartTime?.toFixed(1)}h–{job.EndTime?.toFixed(1)}h</td>
                    </tr>
                  ))}
                  {sorted.length === 0 && (
                    <tr><td colSpan={7} className="text-center text-slate-500 py-8">No jobs match filter</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === 'deferred' && (
        <div className="overflow-auto flex-1">
          <table className="mecon-table">
            <thead className="sticky top-0 bg-slate-900/90 backdrop-blur-sm">
              <tr>
                <th>JobID</th>
                <th>Type</th>
                <th>Priority</th>
                <th>Revenue</th>
                <th>Category</th>
                <th>Justification</th>
              </tr>
            </thead>
            <tbody>
              {deferred.map(job => (
                <tr key={job.JobID}>
                  <td className="font-mono text-rose-300 font-medium">{job.JobID}</td>
                  <td className="text-slate-300 text-xs">{job.RequiredMachineType}</td>
                  <td><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${PRIORITY_COLOR[job.Priority]}`}>{job.Priority}</span></td>
                  <td className="text-slate-400 font-mono text-xs">₹{(job.Revenue ?? 0).toLocaleString()}</td>
                  <td>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      job.DeferCategory === 'Deadline Conflict'
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-rose-500/20 text-rose-400'
                    }`}>
                      {job.DeferCategory || 'Deferred'}
                    </span>
                  </td>
                  <td className="text-slate-500 text-xs max-w-xs truncate" title={job.DeferReason}>{job.DeferReason}</td>
                </tr>
              ))}
              {deferred.length === 0 && (
                <tr><td colSpan={6} className="text-center text-emerald-400 py-8">🎉 All jobs successfully scheduled!</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
