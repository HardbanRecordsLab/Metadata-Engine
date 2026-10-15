import React, { useState } from 'react';
import Card from './Card';
import { API_BASE_URL } from '../../apiConfig';
import { Metadata } from '../../types';

/**
 * Engine 3.0 panel: how much to trust the result and why (trust layer), what the audio model heard, tempo consensus,
 * sync-readiness (technical QC) and the signed Metadata Passport. Renders nothing for analyses without these fields.
 */
const FLAG_TEXT: Record<string, string> = {
    'genre:llm_vs_hearing': 'The AI text model and the audio model disagree about the genre family.',
    'genre:llm_vs_context': 'The genre contradicts the context you provided.',
    'tempo:estimators_disagree': 'The tempo estimators disagree – check the BPM.',
    'tempo:octave_ambiguous': 'The tempo could also be felt at half or double speed.',
    'tempo:half_double_ambiguity': 'Unusual tempo – may be half/double of the real one.',
    'tempo:slow_for_dance_context': 'Slow for a dance track – maybe double time.',
    'energy:llm_vs_dsp': 'The stated energy does not match the measured level.',
    'vocals:sources_disagree': 'Sources disagree about whether there are vocals.',
};
const flagText = (f: string) => FLAG_TEXT[f] || (f.startsWith('vocals:') ? 'Vocals conflict with what you declared.' : f);

const gradeColor = (g?: string) =>
    g === 'A' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
    : g === 'B' ? 'bg-sky-500/15 text-sky-400 border-sky-500/40'
    : g === 'C' ? 'bg-amber-500/15 text-amber-400 border-amber-500/40'
    : 'bg-red-500/15 text-red-400 border-red-500/40';

const Engine3Card: React.FC<{ metadata: Metadata }> = ({ metadata }) => {
    const m = metadata as any;
    const { trust, hearing, tempoAnalysis, syncReadiness, passport, genreCorrected } = m;
    const [verify, setVerify] = useState<{ valid: boolean; reason?: string } | null>(null);
    const [busy, setBusy] = useState(false);
    if (!trust && !hearing && !syncReadiness && !passport) return null;

    const runVerify = async () => {
        setBusy(true);
        try {
            const r = await fetch(`${API_BASE_URL}/intelligence/passport/verify`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passport }),
            });
            setVerify(await r.json());
        } catch { setVerify({ valid: false, reason: 'verification service unreachable' }); }
        setBusy(false);
    };
    const download = () => {
        const blob = new Blob([JSON.stringify(passport, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${(m.title || 'track').toString().replace(/[^\w.-]+/g, '_')}.passport.json`;
        a.click();
        URL.revokeObjectURL(a.href);
    };

    const vv = hearing?.vocal_verdict;
    const singer = vv?.hasVocals === false ? 'Instrumental' : vv?.hasVocals === true ? `Vocals${vv.gender ? ` (${vv.gender})` : ''}` : 'Unclear';

    return (
        <Card>
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Engine 3.0 · Verified analysis</h3>
                {trust && (
                    <div className="flex items-center gap-2">
                        {trust.needsReview && <span className="text-xs px-2 py-1 rounded-full border border-amber-500/40 text-amber-400">Needs review</span>}
                        <span className={`text-sm font-bold px-3 py-1 rounded-full border ${gradeColor(trust.grade)}`} title="Cross-source agreement">
                            Trust {trust.grade} · {Math.round((trust.score || 0) * 100)}%
                        </span>
                    </div>
                )}
            </div>

            {genreCorrected && (
                <p className="text-sm mb-3 text-slate-600 dark:text-slate-300">
                    Genre corrected from <b>{genreCorrected.from}</b> to <b>{genreCorrected.to}</b> ({String(genreCorrected.reason).replace('+', ' + ')}).
                </p>
            )}
            {trust?.flags?.length > 0 && (
                <ul className="mb-4 space-y-1">
                    {trust.flags.map((f: string) => <li key={f} className="text-sm text-amber-400">⚠ {flagText(f)}</li>)}
                </ul>
            )}

            <div className="grid md:grid-cols-2 gap-4">
                {hearing && (
                    <div>
                        <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">What the audio model hears</p>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                            {(hearing.genre || []).slice(0, 4).map((g: any) => (
                                <span key={g.label} className="text-xs px-2 py-1 rounded-full bg-accent-violet/15 text-accent-violet">{g.label} {Math.round(g.p * 100)}%</span>
                            ))}
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                            Mood: {(hearing.mood || []).slice(0, 3).map((x: any) => x.label).join(', ') || '–'}<br />
                            Instruments: {(hearing.instrument || []).slice(0, 3).map((x: any) => x.label).join(', ') || '–'}<br />
                            Voice: {singer}
                        </p>
                    </div>
                )}
                {tempoAnalysis && (
                    <div>
                        <p className="text-xs uppercase tracking-wider text-slate-500 mb-2">Tempo consensus</p>
                        <p className="text-2xl font-mono font-bold text-slate-800 dark:text-slate-100">{tempoAnalysis.bpm} <span className="text-sm font-normal text-slate-500">BPM</span></p>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                            {Math.round((tempoAnalysis.agreement || 0) * 100)}% of estimators agree
                            {tempoAnalysis.alternatives?.length ? ` · also read as ${tempoAnalysis.alternatives.join(' / ')}` : ''}
                        </p>
                    </div>
                )}
            </div>

            {syncReadiness && (
                <div className="mt-5">
                    <div className="flex items-center gap-2 mb-2">
                        <p className="text-xs uppercase tracking-wider text-slate-500">Sync readiness</p>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${gradeColor(syncReadiness.grade)}`}>{syncReadiness.grade} · {Math.round(syncReadiness.score * 100)}%</span>
                    </div>
                    <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
                        {(syncReadiness.checks || []).map((c: any) => (
                            <li key={c.id} className="text-sm flex gap-2" title={c.note}>
                                <span className={c.ok ? 'text-emerald-400' : 'text-red-400'}>{c.ok ? '✓' : '✗'}</span>
                                <span className="text-slate-600 dark:text-slate-300">{c.id.replace(/_/g, ' ')}{c.value !== null && c.value !== undefined ? ` (${c.value})` : ''}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {passport && (
                <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center gap-3 flex-wrap">
                    <span className="text-xs text-slate-500">Metadata Passport · key {passport.keyId} · {passport.alg}</span>
                    <button onClick={runVerify} disabled={busy} className="text-xs px-3 py-1.5 rounded-lg border border-accent-violet/40 text-accent-violet hover:bg-accent-violet/10 disabled:opacity-50">
                        {busy ? 'Verifying…' : 'Verify signature'}
                    </button>
                    <button onClick={download} className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">Download passport</button>
                    {verify && <span className={`text-xs font-semibold ${verify.valid ? 'text-emerald-400' : 'text-red-400'}`}>{verify.valid ? '✓ Signature valid – metadata unchanged since analysis' : `✗ ${verify.reason || 'invalid'}`}</span>}
                </div>
            )}
        </Card>
    );
};

export default Engine3Card;
