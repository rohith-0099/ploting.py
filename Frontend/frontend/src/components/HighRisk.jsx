const RISK_TIERS = [
  { label: 'Critical', min: 0.8, color: 'from-rose-900/50 to-rose-800/30',   border: 'border-rose-500/40',   badge: 'bg-rose-500/25 text-rose-300',   dot: 'bg-rose-500',   pulse: true  },
  { label: 'High',     min: 0.6, color: 'from-orange-900/50 to-orange-800/30', border: 'border-orange-500/40', badge: 'bg-orange-500/25 text-orange-300', dot: 'bg-orange-500', pulse: false },
  { label: 'Medium',   min: 0.4, color: 'from-amber-900/40 to-amber-800/20',  border: 'border-amber-500/30',  badge: 'bg-amber-500/25 text-amber-300',  dot: 'bg-amber-400',  pulse: false },
];

function getTier(prob) {
  return RISK_TIERS.find(t => prob >= t.min) || { label: 'Low', color: 'from-slate-800/40 to-slate-700/20', border: 'border-slate-600/20', badge: 'bg-slate-500/20 text-slate-400', dot: 'bg-emerald-500', pulse: false };
}

function RiskBar({ prob }) {
  const pct = Math.round((prob ?? 0) * 100);
  const color =
    pct >= 80 ? 'from-rose-500 to-rose-600' :
    pct >= 60 ? 'from-orange-500 to-amber-500' :
    pct >= 40 ? 'from-amber-500 to-yellow-500' :
               'from-emerald-500 to-teal-500';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-500">Failure probability</span>
        <span className="font-mono font-bold text-slate-200">{pct}%</span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${color} rounded-full transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function HighRisk({ machines = [], loading = false }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="glass p-4 space-y-2">
            <div className="skeleton h-4 w-24 rounded" />
            <div className="skeleton h-3 w-full rounded" />
          </div>
        ))}
      </div>
    );
  }

  const sorted = [...machines].sort((a, b) => (b.Failure_Prob ?? 0) - (a.Failure_Prob ?? 0));

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">⚠️ High-Risk Machines</h3>
        <span className="text-xs text-slate-500">{machines.length} flagged</span>
      </div>

      {sorted.length === 0 && (
        <div className="glass p-6 text-center text-emerald-400 text-sm">
          ✅ No machines above risk threshold
        </div>
      )}

      {sorted.map(machine => {
        const tier = getTier(machine.Failure_Prob ?? 0);
        return (
          <div
            key={machine.MachineID}
            className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${tier.color} border ${tier.border} p-4 space-y-3 hover:scale-[1.01] transition-all duration-200`}
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="relative flex">
                  <span className={`w-3 h-3 rounded-full ${tier.dot}`} />
                  {tier.pulse && (
                    <span className={`absolute w-3 h-3 rounded-full ${tier.dot} animate-ping opacity-75`} />
                  )}
                </div>
                <div>
                  <span className="font-bold text-white font-mono text-sm">{machine.MachineID}</span>
                  <span className="text-slate-400 text-xs ml-2">· {machine.MachineType}</span>
                </div>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${tier.badge}`}>
                {tier.label}
              </span>
            </div>

            {/* Risk bar */}
            <RiskBar prob={machine.Failure_Prob} />

            {/* Sensor readings */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-black/20 rounded-lg py-1.5 px-2">
                <div className="text-slate-500 text-[10px] mb-0.5">Vibration</div>
                <div className={`font-mono font-bold ${(machine.VibrationLevel ?? 0) > 3 ? 'text-rose-400' : 'text-slate-300'}`}>
                  {(machine.VibrationLevel ?? 0).toFixed(1)}
                </div>
              </div>
              <div className="bg-black/20 rounded-lg py-1.5 px-2">
                <div className="text-slate-500 text-[10px] mb-0.5">Temp °C</div>
                <div className={`font-mono font-bold ${(machine.TempLevel ?? 0) > 90 ? 'text-rose-400' : 'text-slate-300'}`}>
                  {(machine.TempLevel ?? 0).toFixed(0)}
                </div>
              </div>
              <div className="bg-black/20 rounded-lg py-1.5 px-2">
                <div className="text-slate-500 text-[10px] mb-0.5">Svc Days</div>
                <div className={`font-mono font-bold ${(machine.LastMaintenanceDays ?? 0) > 200 ? 'text-rose-400' : 'text-slate-300'}`}>
                  {machine.LastMaintenanceDays ?? '—'}
                </div>
              </div>
            </div>

            {/* Action */}
            {machine.Recommended_Action && (
              <div className="flex items-start gap-2 text-xs text-slate-400 bg-black/20 rounded-lg p-2">
                <span className="text-amber-400 mt-0.5 flex-shrink-0">→</span>
                <span>{machine.Recommended_Action}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
