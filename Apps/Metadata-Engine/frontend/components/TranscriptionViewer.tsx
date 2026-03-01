import React from 'react';

interface Props {
  transcript?: string;
  onClose?: () => void;
}

export default function TranscriptionViewer({ transcript, onClose }: Props) {
  if (!transcript) return null;
  return (
    <div className="bg-white dark:bg-[#0f111a] rounded-2xl border border-slate-200 dark:border-slate-800 p-6 mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-black">Transcription</h3>
        {onClose && (
          <button onClick={onClose} className="text-xs font-bold text-slate-500 hover:text-slate-700">Hide</button>
        )}
      </div>
      <pre className="text-sm whitespace-pre-wrap leading-6 text-slate-700 dark:text-slate-300">
        {transcript}
      </pre>
    </div>
  );
}
