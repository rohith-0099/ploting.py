import { useState, useEffect } from 'react';

const SLIDERS = [
  { key: 'w1', label: 'Throughput / Revenue', desc: 'Prioritize high-revenue jobs', color: 'from-indigo-500 to-violet-600', track: '#4f46e5' },
  { key: 'w2', label: 'Risk Avoidance',       desc: 'Avoid high-failure machines',  color: 'from-rose-500 to-pink-600',   track: '#e11d48' },
  { key: 'w3', label: 'Cost Efficiency',       desc: 'Minimize machining time/cost', color: 'from-amber-500 to-orange-600', track: '#d97706' },
];

export default function WeightSliders({ weights, onChange }) {
  const [local, setLocal] = useState(weights);

  // Sync from parent (when weights reset)
  useEffect(() => { setLocal(weights); }, [weights]);

  const debounceRef = {};

  const handleChange = (key, raw) => {
    const val = parseFloat(raw);
    const next = { ...local, [key]: val };
    setLocal(next);

    clearTimeout(debounceRef[key]);
    debounceRef[key] = setTimeout(() => {
      // Normalize so w1+w2+w3 = 1
      const sum = Object.values(next).reduce((a, b) => a + b, 0) || 1;
      const normalized = {};
      Object.keys(next).forEach(k => { normalized[k] = +(next[k] / sum).toFixed(3); });
      onChange(normalized);
    }, 300);
  };

  const sum = Object.values(local).reduce((a, b) => a + b, 0) || 1;

  const handleReset = () => {
    const def = { w1: 0.5, w2: 0.3, w3: 0.2 };
    setLocal(def);
    onChange(def);
  };

  return (
    <div className="glass p-5 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white tracking-wide">Weight Sliders</h3>
          <p className="text-xs text-slate-400 mt-0.5">Adjust scheduling priorities</p>
        </div>
        <button
          onClick={handleReset}
          className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all border border-white/10"
        >
          Reset
        </button>
      </div>

      {/* Sliders */}
      {SLIDERS.map(({ key, label, desc, color, track }) => {
        const val = local[key] ?? 0;
        const pct = ((val / sum) * 100).toFixed(1);
        return (
          <div key={key} className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-slate-200">{label}</span>
                <p className="text-xs text-slate-500">{desc}</p>
              </div>
              <div className="text-right">
                <span className={`text-base font-bold font-mono bg-gradient-to-r ${color} bg-clip-text text-transparent`}>
                  {(val / sum).toFixed(2)}
                </span>
                <p className="text-xs text-slate-500">{pct}%</p>
              </div>
            </div>
            <input
              id={`slider-${key}`}
              type="range"
              min="0.01"
              max="1"
              step="0.01"
              value={val}
              style={{ background: `linear-gradient(to right, ${track} 0%, ${track} ${(val / 1) * 100}%, rgba(255,255,255,0.1) ${(val / 1) * 100}%, rgba(255,255,255,0.1) 100%)` }}
              onChange={e => handleChange(key, e.target.value)}
              className="w-full cursor-pointer"
            />
          </div>
        );
      })}

      {/* Normalized bar */}
      <div>
        <p className="text-xs text-slate-500 mb-2">Effective weight distribution</p>
        <div className="flex rounded-full overflow-hidden h-2.5">
          {SLIDERS.map(({ key, track }, i) => (
            <div
              key={key}
              style={{ width: `${(local[key] / sum) * 100}%`, background: track, transition: 'width 0.3s ease' }}
              title={SLIDERS[i].label}
            />
          ))}
        </div>
        <div className="flex justify-between text-xs text-slate-500 mt-1 font-mono">
          {SLIDERS.map(({ key }) => (
            <span key={key}>{((local[key] / sum) * 100).toFixed(0)}%</span>
          ))}
        </div>
      </div>
    </div>
  );
}
