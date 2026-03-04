import React, { useEffect, useState } from 'react';
import { getFullUrl } from '../apiConfig';

type CertData = {
  certificate_id: string;
  file_name: string;
  sha256: string;
  verification_status: string;
  metadata: Record<string, any>;
};

const LabelMap: Record<string, string> = {
  title: 'Track Title',
  artist: 'Artist',
  album: 'Album',
  albumArtist: 'Album Artist',
  year: 'Year',
  track: 'Track',
  duration: 'Duration',
  bpm: 'BPM',
  key: 'Key',
  mode: 'Mode',
  mainInstrument: 'Main Instrument',
  mainGenre: 'Main Genre',
  additionalGenres: 'Additional Genres',
  language: 'Language',
  trackDescription: 'Description',
  keywords: 'Keywords',
  isrc: 'ISRC',
  iswc: 'ISWC',
  upc: 'UPC',
  catalogNumber: 'Catalog Number',
  license: 'License',
  publisher: 'Publisher',
  composer: 'Composer',
  lyricist: 'Lyricist',
  producer: 'Producer',
  copyright: 'Copyright',
  pLine: '(P) Line',
  confidence: 'AI Confidence',
  validation_report: 'Validation Report',
  sha256: 'SHA-256',
};

function formatValue(k: string, v: any): string {
  if (v == null) return '';
  if (k === 'duration') {
    const total = parseInt(String(v), 10);
    if (!isNaN(total)) {
      const m = Math.floor(total / 60);
      const s = total % 60;
      return `${m}:${String(s).padStart(2, '0')}`;
    }
  }
  if (k === 'validation_report' && typeof v === 'object') {
    const score = v.score;
    const status = v.status;
    const issues = (v.issues || []).length;
    const warnings = (v.warnings || []).length;
    const parts = [];
    if (status != null) parts.push(`status:${status}`);
    if (score != null) parts.push(`score:${score}`);
    parts.push(`issues:${issues}`);
    parts.push(`warnings:${warnings}`);
    return parts.join(', ');
  }
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'object') return Object.entries(v).map(([kk, vv]) => `${kk}:${vv}`).join(', ');
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

export default function VerifyCertificatePage() {
  const [data, setData] = useState<CertData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const path = window.location.pathname; // /verify/:id
    const id = decodeURIComponent(path.split('/')[2] || '');
    const token = new URLSearchParams(window.location.search).get('token') || '';
    if (!id) {
      setError('Missing certificate id');
      setLoading(false);
      return;
    }
    const run = async () => {
      try {
        const url = getFullUrl(`/certificate/verify/${id}`) + (token ? `?token=${encodeURIComponent(token)}` : '');
        const res = await fetch(url);
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || `HTTP ${res.status}`);
        }
        const json = await res.json();
        setData(json);
      } catch (e: any) {
        setError(e.message || 'Verification failed');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const pdfHref = data ? getFullUrl(`/certificate/pdf/${encodeURIComponent(data.certificate_id)}`) : '#';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-accent-violet border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <div className="text-sm opacity-80">Verifying certificate…</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200">
        <div className="max-w-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-md">
          <h1 className="text-xl font-bold mb-2">Verification</h1>
          <p className="text-sm text-red-600 dark:text-red-400">{error || 'Unknown error'}</p>
        </div>
      </div>
    );
  }

  const entries = Object.entries(data.metadata || {});
  const order: string[] = [
    'title','artist','album','albumArtist','year','track','duration',
    'bpm','key','mode','mainInstrument','mainGenre','additionalGenres','language',
    'trackDescription','keywords',
    'isrc','iswc','upc','catalogNumber','license',
    'publisher','composer','lyricist','producer',
    'copyright','pLine',
    'sha256','confidence','validation_report'
  ];
  const present = order.filter(k => data.metadata && data.metadata[k] != null && data.metadata[k] !== '');
  const remaining = entries
    .filter(([k, v]) => !present.includes(k) && v != null && v !== '')
    .map(([k]) => k)
    .sort();
  const keys = [...present, ...remaining];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 text-slate-800 dark:text-slate-100 py-10">
      <div className="max-w-5xl mx-auto px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tight">Digital Certificate Verification</h1>
          <p className="text-sm text-slate-500 mt-1">Hardban Records Lab</p>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl">
          <div className="p-6 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase text-slate-400">Certificate</div>
                <div className="text-lg font-bold">{data.certificate_id}</div>
                <div className="text-xs text-slate-500">{data.file_name}</div>
              </div>
              <div className="flex items-center gap-2">
                <a href={pdfHref} target="_blank" rel="noreferrer" className="px-4 py-2 rounded-lg bg-accent-violet text-white font-bold hover:opacity-90">
                  Download PDF
                </a>
              </div>
            </div>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {keys.map((k) => {
              const v = data.metadata[k];
              const label = LabelMap[k] || k.replace(/_/g, ' ').replace(/\b\w/g, s => s.toUpperCase());
              return (
                <div key={k} className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                  <div className="text-xs uppercase font-bold text-slate-500 mb-1">{label}</div>
                  <div className="text-sm">{formatValue(k, v)}</div>
                </div>
              );
            })}
          </div>
          <div className="p-6 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-500">
            Verified by Hardban Records Lab · Read-only view
          </div>
        </div>
      </div>
    </div>
  );
}

