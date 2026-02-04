import React, { useState, useEffect } from 'react';
import { Metadata } from '../../types';
import Card from './Card';
import { Activity, Sparkles, Mic, BarChart, Info } from '../icons';
import { detectInstrumentsWithGenre } from '../../services/enhanced/instrumentDetectionService';
import Tooltip from '../Tooltip';

interface ProAnalysisCardProps {
    metadata: Metadata;
    audioFeatures?: any; // Expanded features from AudioAnalysisService
}

const ProAnalysisCard: React.FC<ProAnalysisCardProps> = ({ metadata, audioFeatures }) => {
    const [detectedInstruments, setDetectedInstruments] = useState<string[]>([]);
    const [confidence, setConfidence] = useState(0);

    useEffect(() => {
        if (audioFeatures?.balance) {
            const { instruments, confidence: conf } = detectInstrumentsWithGenre(
                audioFeatures.balance,
                audioFeatures.bpm || metadata.bpm || 120,
                (metadata as any).energy_level || 'Medium',
                audioFeatures.stereo?.width || 0.5,
                audioFeatures.loudnessDb || -14,
                metadata.mainGenre
            );
            setDetectedInstruments(instruments);
            setConfidence(conf);
        }
    }, [audioFeatures, metadata]);

    if (!audioFeatures?.balance) return null;

    return (
        <Card className="border-l-4 border-l-cyan-500">
            <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4 mb-6">
                <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20">
                    <BarChart className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-light-text dark:text-dark-text">Acoustic fingerprint & DSP</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Deep engineering analysis results.</p>
                </div>
            </div>

            <div className="space-y-6">
                {/* Spectral Balance */}
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Frequency Response</label>
                        <span className="text-[10px] font-mono text-slate-400">{audioFeatures.balance.character}</span>
                    </div>
                    <div className="h-4 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex shadow-inner">
                        <Tooltip text={`Low: ${audioFeatures.balance.low}%`}>
                            <div className="h-full bg-cyan-500 transition-all duration-1000" style={{ width: `${audioFeatures.balance.low}%` }}></div>
                        </Tooltip>
                        <Tooltip text={`Mid: ${audioFeatures.balance.mid}%`}>
                            <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${audioFeatures.balance.mid}%` }}></div>
                        </Tooltip>
                        <Tooltip text={`High: ${audioFeatures.balance.high}%`}>
                            <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${audioFeatures.balance.high}%` }}></div>
                        </Tooltip>
                    </div>
                    <div className="flex justify-between mt-1 text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                        <span>Low</span>
                        <span>Mid</span>
                        <span>High</span>
                    </div>
                </div>

                {/* Detected Instruments */}
                <div className="bg-slate-50 dark:bg-slate-900/30 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400">
                            <Mic className="w-4 h-4" />
                            <h4 className="font-bold text-xs uppercase tracking-wide">DSP Instrument Detection</h4>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full ${confidence > 70 ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                            <span className="text-[10px] font-bold text-slate-500">{confidence}% Match</span>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {detectedInstruments.map((inst, i) => (
                            <span key={i} className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-cyan-200 dark:border-cyan-900 text-cyan-700 dark:text-cyan-300 rounded-lg text-xs font-medium shadow-sm animate-fade-in">
                                {inst}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Technical Specs Grid */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 dark:bg-slate-900/30 rounded-lg border border-slate-100 dark:border-slate-800">
                        <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">Integrated Loudness</div>
                        <div className="text-sm font-mono font-bold text-slate-800 dark:text-slate-200">{audioFeatures.loudnessDb} LUFS</div>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-900/30 rounded-lg border border-slate-100 dark:border-slate-800">
                        <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">True Peak</div>
                        <div className="text-sm font-mono font-bold text-slate-800 dark:text-slate-200">{audioFeatures.truePeak} dBTP</div>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-900/30 rounded-lg border border-slate-100 dark:border-slate-800">
                        <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">Stereo Width</div>
                        <div className="text-sm font-mono font-bold text-slate-800 dark:text-slate-200">{(audioFeatures.stereo?.width * 100).toFixed(0)}%</div>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-900/30 rounded-lg border border-slate-100 dark:border-slate-800">
                        <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">Correlation</div>
                        <div className="text-sm font-mono font-bold text-slate-800 dark:text-slate-200">{audioFeatures.stereo?.correlation}</div>
                    </div>
                </div>
            </div>
        </Card>
    );
};

export default ProAnalysisCard;
