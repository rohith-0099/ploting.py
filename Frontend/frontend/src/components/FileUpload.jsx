import { useState, useRef } from 'react';

export default function FileUpload({ onUpload, backendOnline }) {
  const [dragging, setDragging]  = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage]    = useState(null);
  const inputRef = useRef();

  const handleFiles = async files => {
    if (!files?.length) return;
    setUploading(true);
    setMessage(null);
    try {
      const fd = new FormData();
      Array.from(files).forEach(f => fd.append('files', f));
      const res = await fetch('/api/process-files', { method: 'POST', body: fd });
      if (res.ok) {
        setMessage({ type: 'success', text: `✅ ${files.length} file(s) processed — refreshing schedule...` });
        onUpload && onUpload();
      } else {
        throw new Error('Server error');
      }
    } catch {
      setMessage({ type: 'error', text: '⚠️ Could not reach backend. Using existing data.' });
    }
    setUploading(false);
    setTimeout(() => setMessage(null), 4000);
  };

  return (
    <div className="glass p-5 space-y-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Upload CSV Data</h3>
          <p className="text-xs text-slate-400 mt-0.5">machines.csv · jobs.csv · predictions.csv</p>
        </div>
        <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${
          backendOnline
            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${backendOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
          {backendOnline ? 'Backend Live' : 'Offline Mode'}
        </span>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-300 ${
          dragging
            ? 'border-indigo-400 bg-indigo-500/10 scale-[1.01]'
            : 'border-white/15 hover:border-indigo-500/60 hover:bg-white/5'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          multiple
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
        <div className="text-3xl mb-2">{uploading ? '⏳' : '📂'}</div>
        <p className="text-sm text-slate-300 font-medium">
          {uploading ? 'Processing files...' : dragging ? 'Drop to upload' : 'Drop CSVs or click to browse'}
        </p>
        <p className="text-xs text-slate-500 mt-1">Phase 1–3 output files</p>
        {uploading && (
          <div className="mt-3 h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full animate-pulse w-3/4" />
          </div>
        )}
      </div>

      {/* Status message */}
      {message && (
        <div className={`text-xs px-3 py-2 rounded-lg animate-slide-in ${
          message.type === 'success'
            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
            : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
        }`}>
          {message.text}
        </div>
      )}
    </div>
  );
}
