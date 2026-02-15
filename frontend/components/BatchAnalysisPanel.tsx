import React, { useState } from 'react';
import Button from './Button';
import { Download, Upload } from './icons';

interface BatchItem {
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  resultUrl?: string;
  error?: string;
}

const toArray = (fl: FileList | null) => {
  if (!fl) return [];
  const arr: File[] = [];
  for (let i = 0; i < fl.length; i++) arr.push(fl.item(i)!);
  return arr;
};

export default function BatchAnalysisPanel() {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [processing, setProcessing] = useState(false);

  const handleFiles = (files: FileList | null) => {
    const newItems = toArray(files).map(f => ({ file: f, status: 'pending' as const }));
    setItems(prev => [...prev, ...newItems]);
  };

  const startBatch = async () => {
    if (!items.length) return;
    setProcessing(true);
    try {
      const form = new FormData();
      items.forEach(item => form.append('files', item.file));
      form.append('user', 'anonymous');

      const res = await fetch('/api/batch/analyze', { method: 'POST', body: form });
      if (!res.ok) throw new Error(`Batch analyze failed: ${res.status}`);
      const data = await res.json();

      const mapped: BatchItem[] = items.map((it, idx) => {
        const d = data.results?.[idx];
        return {
          ...it,
          status: 'done',
          resultUrl: d?.downloadUrl || d?.resultUrl || undefined
        };
      });
      setItems(mapped);
    } catch (e: any) {
      setItems(prev => prev.map(it => ({ ...it, status: it.status === 'pending' ? 'error' : it.status, error: e.message })));
    } finally {
      setProcessing(false);
    }
  };

  const clearAll = () => setItems([]);

  return (
    <div className="bg-white dark:bg-[#0f111a] rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-black">Batch Analysis</h2>
        <div className="flex gap-2">
          <Button onClick={clearAll} variant="secondary" size="sm">Clear</Button>
          <Button onClick={startBatch} disabled={processing || !items.length} size="sm"><Upload className="w-4 h-4" /> Start</Button>
        </div>
      </div>

      <div
        className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 text-center cursor-pointer"
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
        onClick={() => document.getElementById('batch-input')?.click()}
      >
        <input id="batch-input" type="file" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
        <p className="text-slate-600 dark:text-slate-400">Drop audio files here or click to select</p>
      </div>

      <ul className="mt-6 space-y-3">
        {items.map((it, idx) => (
          <li key={idx} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold">{it.file.name}</span>
              <span className="text-xs uppercase font-black text-slate-500">
                {it.status}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {it.resultUrl && (
                <a href={it.resultUrl} download className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
                  <Download className="w-4 h-4" /> Download
                </a>
              )}
              {it.error && <span className="text-xs text-red-500">{it.error}</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
