
import React from 'react';
import { Metadata, AnalysisRecord } from '../../types';
import Card from './Card';
import Button from '../Button';
import { Share, Download, FileJson, FileType, Globe, Send } from '../icons';
import { backendService } from '../../services/backendService';

interface DistributionCardProps {
    metadata: Metadata;
    jobId?: string;
    showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

const DistributionCard: React.FC<DistributionCardProps> = ({ metadata, jobId, showToast }) => {

    const handleExportCsv = () => {
        if (!jobId) {
            showToast("Analysis record required for server-side CSV export.", 'error');
            return;
        }
        window.location.href = backendService.getExportCsvUrl(jobId);
        showToast("Exporting MP3Tag compatible CSV...", 'info');
    };

    const handleExportJson = () => {
        if (!jobId) {
            showToast("Analysis record required for JSON export.", 'error');
            return;
        }
        window.location.href = backendService.getExportJsonUrl(jobId);
        showToast("Exporting full raw JSON...", 'info');
    };

    const handleExportDdex = () => {
        if (!jobId) {
            showToast("Analysis record required for DDEX export.", 'error');
            return;
        }
        window.location.href = backendService.getExportDdexUrl(jobId);
        showToast("Generating DDEX ERN 4.3 XML...", 'info');
    };

    const handleExportCwr = () => {
        if (!jobId) {
            showToast("Analysis record required for CWR export.", 'error');
            return;
        }
        window.location.href = backendService.getExportCwrUrl(jobId);
        showToast("Generating CWR V2.1 file...", 'info');
    };

    return (
        <Card className="border-l-4 border-l-blue-500 overflow-hidden">
            <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4 mb-6">
                <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/20">
                    <Share className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-light-text dark:text-dark-text">Distribution & Export</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Global metadata standard readiness.</p>
                </div>
            </div>

            <div className="space-y-6">
                {/* ADVANCED EXPORTS */}
                <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <FileType className="w-3 h-3" /> Professional Exports
                    </h4>
                    <div className="grid grid-cols-3 gap-3">
                        <Button
                            onClick={handleExportCsv}
                            variant="secondary"
                            size="sm"
                            className="w-full justify-center group"
                            disabled={!jobId}
                        >
                            <Download className="w-4 h-4 mr-2 group-hover:translate-y-0.5 transition-transform" />
                            CSV
                        </Button>
                        <Button
                            onClick={handleExportJson}
                            variant="secondary"
                            size="sm"
                            className="w-full justify-center group"
                            disabled={!jobId}
                        >
                            <FileJson className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                            JSON
                        </Button>
                        <Button
                            onClick={handleExportCwr}
                            variant="secondary"
                            size="sm"
                            className="w-full justify-center group"
                            disabled={!jobId}
                        >
                            <FileType className="w-4 h-4 mr-2 group-hover:rotate-12 transition-transform" />
                            CWR
                        </Button>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-2 italic">
                        * CWR format required for PRO registration (ASCAP, BMI, GEMA).
                    </p>
                </div>

                {/* DISTRIBUTION PLATFORMS */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <Globe className="w-3 h-3" /> Platform Sync
                    </h4>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold text-[10px]">GS</div>
                                <span className="text-xs font-medium dark:text-emerald-400">Global Sync Ready</span>
                            </div>
                            <span className="text-[9px] bg-emerald-500/20 text-emerald-500 px-1.5 py-0.5 rounded font-bold uppercase">Optimized</span>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold text-[10px]">UF</div>
                                <span className="text-xs font-medium">Universal Format Form</span>
                            </div>
                            <span className="text-[9px] bg-indigo-500/20 text-indigo-500 px-1.5 py-0.5 rounded font-bold uppercase">Valid</span>
                        </div>
                    </div>
                </div>

                {/* PRO SERVICES */}
                <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-4 rounded-xl text-white shadow-lg shadow-indigo-600/20">
                    <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-sm">PRO Distribution (DDEX)</h4>
                        <div className="px-1.5 py-0.5 bg-white/20 rounded text-[9px] font-bold uppercase tracking-wider backdrop-blur-md">Active</div>
                    </div>
                    <p className="text-[10px] text-white/80 leading-relaxed mb-4">
                        Direct sync to DDEX repository for Recording Rights (ERN 4.3). Required for professional labels.
                    </p>
                    <Button
                        variant="primary"
                        size="sm"
                        className="w-full bg-white text-indigo-600 hover:bg-white/90 border-none font-bold text-[11px] h-8"
                        onClick={handleExportDdex}
                        disabled={!jobId}
                    >
                        <Send className="w-3 h-3 mr-2" /> Download DDEX XML
                    </Button>
                </div>
            </div>
        </Card>
    );
};

export default DistributionCard;
