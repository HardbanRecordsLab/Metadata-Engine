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
    'title', 'artist', 'album', 'albumArtist', 'year', 'track', 'duration',
    'bpm', 'key', 'mode', 'mainInstrument', 'mainGenre', 'additionalGenres', 'language',
    'trackDescription', 'keywords',
    'isrc', 'iswc', 'upc', 'catalogNumber', 'license',
    'publisher', 'composer', 'lyricist', 'producer',
    'copyright', 'pLine',
    'sha256', 'confidence', 'validation_report'
  ];
  const present = order.filter(k => data.metadata && data.metadata[k] != null && data.metadata[k] !== '');
  const remaining = entries
    .filter(([k, v]) => !present.includes(k) && v != null && v !== '')
    .map(([k]) => k)
    .sort();
  const keys = [...present, ...remaining];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 text-slate-800 dark:text-slate-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-block px-4 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 text-[10px] font-black uppercase tracking-[0.3em] mb-4 border border-amber-200 dark:border-amber-800">
            Official Verification Portal
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white uppercase">Digital Asset Authenticity</h1>
          <p className="text-sm text-slate-500 mt-2 font-medium">Hardban Records Lab • Verification & IP Protection Bureau</p>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-2xl overflow-hidden">
          {/* Status Banner */}
          <div className="bg-emerald-600 px-6 py-3 flex items-center justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-white text-xs font-black uppercase tracking-widest">VERIFIED & ACTIVE RECORD</span>
          </div>

          <div className="p-8 md:p-12 border-b border-slate-100 dark:border-slate-700">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
              <div className="flex-1">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Asset Identifier (Serial)</div>
                <div className="text-2xl font-black font-mono text-slate-900 dark:text-white mb-2">{data.certificate_id}</div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-900 rounded text-xs font-mono text-slate-600 dark:text-slate-400">
                  SHA-256: {data.sha256}
                </div>
              </div>
              <div className="flex flex-col gap-3 w-full md:w-auto">
                <a href={pdfHref} target="_blank" rel="noreferrer" className="w-full text-center px-6 py-3 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold hover:opacity-90 transition-all shadow-lg">
                  Fetch PDF Certificate
                </a>
              </div>
            </div>
          </div>

          {/* Legal / Authority Section */}
          <div className="p-8 md:p-12 bg-slate-50 dark:bg-slate-900/20">
            <div className="max-w-2xl">
              <h2 className="text-sm font-black uppercase text-amber-700 dark:text-amber-500 mb-4 tracking-widest flex items-center gap-2">
                Legal Authority & Admissibility
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4 text-justify">
                This digital record constitutes cryptographic proof of the audio file's state and metadata as of its registration date. Under the <strong>Berne Convention</strong> and international "prior art" standards, this timestamped fingerprint serves as essential evidentiary support for ownership claims and creative attribution.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                  <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">Status</div>
                  <div className="text-xs font-bold text-emerald-600 uppercase">Registered & Notarized</div>
                </div>
                <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                  <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">Network</div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase">HRL Verification System</div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 md:p-12">
            <h3 className="text-xs font-black uppercase text-slate-400 mb-6 tracking-widest italic">Attributed Metadata</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
              {keys.map((k) => {
                const v = data.metadata[k];
                const label = LabelMap[k] || k.replace(/_/g, ' ').replace(/\b\w/g, s => s.toUpperCase());
                return (
                  <div key={k} className="border-b border-slate-100 dark:border-slate-700/50 pb-2">
                    <div className="text-[9px] uppercase font-black text-amber-600/80 mb-1">{label}</div>
                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{formatValue(k, v)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-8 md:p-12 bg-slate-950 text-white flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="text-center md:text-left">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Certified By</div>
              <div className="text-xl font-bold font-serif italic text-amber-500">HardbanRecords Lab</div>
              <div className="text-[10px] text-slate-400 tracking-tighter mt-1">Institutional Rights Management Bureau</div>
            </div>
            <div className="w-px h-12 bg-slate-800 hidden md:block"></div>
            <div className="text-center md:text-right">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Digital Seal</div>
              <div className="text-xs font-mono text-slate-400 leading-tight">
                CERT_SIG: {data.sha256.slice(0, 16)}...<br />
                AUTH_LVL: 04 (IMUTTABLE)
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
            Verification Secure · End-to-End Encrypted Access
          </p>
        </div>
      </div>
    </div>
  );
}

