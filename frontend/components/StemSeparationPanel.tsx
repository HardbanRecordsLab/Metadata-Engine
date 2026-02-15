import React, { useState } from 'react';
import Button from './Button';
import { Play, Pause, Download } from './icons';
import { getFullUrl } from '../apiConfig';

interface StemsResponse {
  stems: {
    vocals?: string;
    drums?: string;
    bass?: string;
    other?: string;
  };
}

const StemSeparationPanel: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [separating, setSeparating] = useState(false);
  const [stems, setStems] = useState<StemsResponse['stems'] | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  const handleSeparate = async () => {
    if (!file) return;
    setSeparating(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(getFullUrl('/analysis/separate-stems'), {
        method: 'POST',
        body: formData
      });
      if (!res.ok) throw new Error(`Separation failed: ${res.status}`);
      const data: StemsResponse = await res.json();
      setStems(data.stems);
    } finally {
      setSeparating(false);
    }
  };

  const stemTypes = [
    { key: 'vocals', label: 'Vocals', icon: '🎤' },
    { key: 'drums', label: 'Drums', icon: '🥁' },
    { key: 'bass', label: 'Bass', icon: '🎸' },
    { key: 'other', label: 'Other', icon: '🎹' }
  ] as const;

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Stem Separation</h2>

      <input
        type="file"
        accept="audio/*"
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] || null)}
        className="mb-4"
      />

      <Button onClick={handleSeparate} disabled={!file || separating}>
        {separating ? 'Separating...' : 'Separate Stems'}
      </Button>

      {stems && (
        <div className="mt-6 space-y-4">
          {stemTypes.map((stem) => {
            const url = (stems as any)[stem.key] as string | undefined;
            if (!url) return null;
            return (
              <div key={stem.key} className="p-4 bg-gray-50 dark:bg-slate-900/40 rounded border border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{stem.icon}</span>
                    <h3 className="font-semibold">{stem.label}</h3>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="p-2 hover:bg-gray-200 dark:hover:bg-slate-800 rounded"
                      onClick={() => setPlayingKey((prev: string | null) => prev === stem.key ? null : stem.key)}
                      title={playingKey === stem.key ? 'Pause' : 'Play'}
                    >
                      {playingKey === stem.key ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </button>
                    <a
                      href={url}
                      download={`${stem.key}.wav`}
                      className="p-2 hover:bg-gray-200 dark:hover:bg-slate-800 rounded"
                      title="Download stem"
                    >
                      <Download className="w-5 h-5" />
                    </a>
                  </div>
                </div>
                <audio src={url} controls className="w-full mt-2">
                  <track kind="metadata" src="" label="No captions" />
                </audio>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StemSeparationPanel;
