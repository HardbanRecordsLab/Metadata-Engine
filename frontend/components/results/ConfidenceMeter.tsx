import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Shield } from '../icons';
import Tooltip from '../Tooltip';

interface ConfidenceMeterProps {
    score: number;
    issues: string[];
}

const ConfidenceMeter: React.FC<ConfidenceMeterProps> = ({ score, issues }) => {
    const getColor = (s: number) => {
        if (s > 85) return 'from-emerald-400 to-emerald-600';
        if (s > 60) return 'from-yellow-400 to-orange-500';
        return 'from-red-500 to-red-700';
    };
    
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setTimeout(() => setMounted(true), 200); }, []);

    return (
        <div className="mb-8 p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-100 dark:border-slate-800 shadow-sm animate-fade-in relative overflow-hidden">
            {/* Background Texture */}
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <Shield className="w-24 h-24" />
            </div>

            <div className="flex items-center justify-between mb-3 relative z-10">
                <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${score > 80 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600'}`}>
                        <Shield className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="font-bold text-sm text-slate-800 dark:text-white leading-none">AI Confidence Score</h4>
                        <p className="text-[10px] text-slate-500 mt-0.5 font-medium">Cross-Verification System</p>
                    </div>
                </div>
                <div className="flex items-end gap-1">
                    <span className="text-2xl font-black text-slate-800 dark:text-white leading-none">{score}</span>
                    <span className="text-xs font-bold text-slate-400 mb-0.5">/100</span>
                </div>
            </div>

            <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden mb-4 relative z-10 box-border border border-slate-200 dark:border-slate-700">
                <div 
                    className={`h-full transition-all duration-1000 ease-out bg-gradient-to-r ${getColor(score)} shadow-[0_0_10px_rgba(0,0,0,0.1)]`} 
                    style={{ width: `${mounted ? score : 0}%` }}
                >
                    <div className="w-full h-full opacity-30 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] animate-shimmer" />
                </div>
            </div>

            {issues.length > 0 ? (
                <div className="space-y-2 relative z-10">
                    {issues.map((issue, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400 bg-red-50 dark:bg-red-900/10 p-2 rounded-lg border border-red-100 dark:border-red-900/20">
                            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /> 
                            <span>{issue}</span>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-900/10 p-2 rounded-lg border border-emerald-100 dark:border-emerald-900/20 relative z-10">
                    <CheckCircle2 className="w-4 h-4 shrink-0" /> All data points are consistent (AI vs DSP analysis).
                </div>
            )}
        </div>
    );
};

export default ConfidenceMeter;