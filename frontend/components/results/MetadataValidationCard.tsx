
import React from 'react';
import { Metadata } from '../../types';
import Card from './Card';
import { ShieldCheck, AlertTriangle, XCircle, CheckCircle2 } from '../icons';

interface MetadataValidationCardProps {
    metadata: Metadata;
}

const MetadataValidationCard: React.FC<MetadataValidationCardProps> = ({ metadata }) => {
    const report = metadata.validation_report;

    if (!report || Object.keys(report).length === 0) {
        return (
            <Card className="border-l-4 border-l-slate-300">
                <div className="flex items-center gap-3">
                    <ShieldCheck className="w-6 h-6 text-slate-400" />
                    <div>
                        <h3 className="text-sm font-bold">Validation Status</h3>
                        <p className="text-xs text-slate-500">No validation report available for this track.</p>
                    </div>
                </div>
            </Card>
        );
    }

    const { score, status, issues, warnings } = report;

    const getStatusConfig = () => {
        switch (status) {
            case 'valid':
                return { color: 'text-emerald-500', icon: <CheckCircle2 className="w-6 h-6" />, border: 'border-l-emerald-500', bg: 'bg-emerald-50 content-[""]' };
            case 'uncertain':
                return { color: 'text-amber-500', icon: <AlertTriangle className="w-6 h-6" />, border: 'border-l-amber-500', bg: 'bg-amber-50' };
            case 'inconsistent':
                return { color: 'text-red-500', icon: <XCircle className="w-6 h-6" />, border: 'border-l-red-500', bg: 'bg-red-50' };
            default:
                return { color: 'text-slate-500', icon: <ShieldCheck className="w-6 h-6" />, border: 'border-l-slate-300', bg: 'bg-slate-50' };
        }
    };

    const config = getStatusConfig();

    return (
        <Card className={`border-l-4 ${config.border} overflow-hidden`}>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className={`${config.color}`}>{config.icon}</div>
                    <div>
                        <h3 className="text-lg font-bold capitalize">{status} Analysis</h3>
                        <p className="text-xs text-slate-500">Cross-check logic score: {score}%</p>
                    </div>
                </div>
                <div className="text-2xl font-black opacity-20 select-none">VALIDATION</div>
            </div>

            <div className="space-y-3">
                {issues && issues.length > 0 && (
                    <div className="bg-red-50 dark:bg-red-900/10 p-3 rounded-lg border border-red-100 dark:border-red-900/20">
                        <h4 className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <XCircle className="w-3 h-3" /> Critical Issues
                        </h4>
                        <ul className="space-y-1">
                            {issues.map((issue: string, i: number) => (
                                <li key={i} className="text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                                    <span className="mt-1 w-1 h-1 rounded-full bg-red-400 shrink-0" />
                                    {issue}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {warnings && warnings.length > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-900/10 p-3 rounded-lg border border-amber-100 dark:border-amber-900/20">
                        <h4 className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <AlertTriangle className="w-3 h-3" /> Quality Warnings
                        </h4>
                        <ul className="space-y-1">
                            {warnings.map((warning: string, i: number) => (
                                <li key={i} className="text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                                    <span className="mt-1 w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                                    {warning}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {status === 'valid' && issues.length === 0 && warnings.length === 0 && (
                    <div className="bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-lg flex flex-col items-center text-center">
                        <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-2 opacity-20" />
                        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                            Perfect technical consistency! All fields match the detected sonic patterns.
                        </p>
                    </div>
                )}
            </div>
        </Card>
    );
};

export default MetadataValidationCard;
