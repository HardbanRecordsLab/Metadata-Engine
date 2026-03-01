import React, { useState } from 'react';
import { ValidationReport, ValidationIssue } from '../../services/releaseValidationService';
import Card from './Card';
import { CheckCircle2, AlertTriangle, Info, XCircle, Download, FileText, ChevronDown, ChevronUp } from '../icons';

interface ValidationReportCardProps {
    report: ValidationReport;
    onExportReport?: () => void;
}

const ValidationReportCard: React.FC<ValidationReportCardProps> = ({ report, onExportReport }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const getScoreColor = (score: number) => {
        if (score >= 90) return 'text-emerald-500';
        if (score >= 70) return 'text-amber-500';
        if (score >= 50) return 'text-orange-500';
        return 'text-red-500';
    };

    const getScoreBgColor = (score: number) => {
        if (score >= 90) return 'bg-emerald-500/10 border-emerald-500/30';
        if (score >= 70) return 'bg-amber-500/10 border-amber-500/30';
        if (score >= 50) return 'bg-orange-500/10 border-orange-500/30';
        return 'bg-red-500/10 border-red-500/30';
    };

    const groupedIssues = {
        errors: report.issues.filter(i => i.severity === 'error'),
        warnings: report.issues.filter(i => i.severity === 'warning'),
        infos: report.issues.filter(i => i.severity === 'info')
    };

    return (
        <Card className="border-l-4 border-l-blue-500">
            <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4 mb-6">
                <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/20">
                    <FileText className="w-6 h-6" />
                </div>
                <div className="flex-1">
                    <h3 className="text-lg font-bold text-light-text dark:text-dark-text">Release Readiness Report</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Professional quality validation</p>
                </div>
                <div className="flex items-center gap-2">
                    {onExportReport && (
                        <button
                            onClick={onExportReport}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500"
                            title="Export PDF Report"
                        >
                            <Download className="w-5 h-5" />
                        </button>
                    )}
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500"
                    >
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            {/* Score Display */}
            <div className={`p-6 rounded-2xl border ${getScoreBgColor(report.score)} transition-all duration-300`}>
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="text-center md:text-left">
                        <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Quality Score</div>
                        <div className={`text-6xl font-black ${getScoreColor(report.score)} tabular-nums`}>
                            {report.score}
                            <span className="text-2xl opacity-50 ml-1">/100</span>
                        </div>
                    </div>

                    <div className="flex flex-col items-center md:items-end gap-2">
                        {report.readyForDistribution ? (
                            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-full font-bold shadow-lg shadow-emerald-500/30">
                                <CheckCircle2 className="w-5 h-5" />
                                Ready for HQ Release
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-full font-bold shadow-lg shadow-red-500/30">
                                <XCircle className="w-5 h-5" />
                                Optimization Required
                            </div>
                        )}
                        <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mt-2">
                            {report.summary.errors} errors · {report.summary.warnings} warnings · {report.summary.infos} info
                        </div>
                    </div>
                </div>
            </div>

            {isExpanded && (
                <div className="mt-8 space-y-8 animate-slide-down">
                    {/* Platform Compatibility */}
                    <div>
                        <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                            Platform Submission Compatibility
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                            {Object.entries(report.platformCompatibility).map(([platform, compatible]) => (
                                <div
                                    key={platform}
                                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${compatible
                                        ? 'bg-slate-50 dark:bg-slate-800/50 border-emerald-500/20'
                                        : 'bg-slate-50 dark:bg-slate-800/50 border-red-500/20'
                                        }`}
                                >
                                    <div className={`text-[10px] font-bold uppercase tracking-tight ${compatible ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {platform === 'appleMusic' ? 'Apple Music' : platform === 'soundcloud' ? 'SoundCloud' : platform.charAt(0).toUpperCase() + platform.slice(1)}
                                    </div>
                                    <div className="text-xl">
                                        {compatible ? '✅' : '❌'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Issues List */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                            Issues & Recommendations
                        </h4>

                        {report.issues.length === 0 ? (
                            <div className="flex flex-col items-center py-8 text-slate-400">
                                <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-2 opacity-50" />
                                <p className="font-bold">Flawless Metadata</p>
                                <p className="text-xs">No issues were found in this analysis.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {report.issues.map((issue, idx) => (
                                    <div
                                        key={idx}
                                        className={`p-4 rounded-xl border flex gap-4 transition-all ${issue.severity === 'error'
                                            ? 'bg-red-500/5 border-red-500/10'
                                            : issue.severity === 'warning'
                                                ? 'bg-amber-500/5 border-amber-500/10'
                                                : 'bg-blue-500/5 border-blue-500/10'
                                            }`}
                                    >
                                        <div className="shrink-0 pt-0.5">
                                            {issue.severity === 'error' ? <XCircle className="w-5 h-5 text-red-500" /> :
                                                issue.severity === 'warning' ? <AlertTriangle className="w-5 h-5 text-amber-500" /> :
                                                    <Info className="w-5 h-5 text-blue-500" />}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${issue.severity === 'error' ? 'bg-red-500/10 text-red-500' :
                                                    issue.severity === 'warning' ? 'bg-amber-500/10 text-amber-500' :
                                                        'bg-blue-500/10 text-blue-500'
                                                    }`}>
                                                    {issue.category}
                                                </span>
                                                <h5 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                                    {issue.message}
                                                </h5>
                                            </div>
                                            {issue.recommendation && (
                                                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed italic border-l-2 border-slate-200 dark:border-slate-800 pl-3 mt-2">
                                                    {issue.recommendation}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </Card>
    );
};

export default ValidationReportCard;
