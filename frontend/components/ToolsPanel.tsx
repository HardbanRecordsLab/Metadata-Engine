import React, { useRef, useState } from 'react';
import { Wrench, Zap, Trash2, Search, FileJson, Music, Shield, AlertTriangle, CheckCircle2, XCircle } from './icons';
import Button from './Button';
import { getFullUrl } from '../apiConfig';

const ToolCard: React.FC<{
    title: string;
    description: string;
    icon: React.ReactNode;
    isPro?: boolean;
    onClick: () => void;
}> = ({ title, description, icon, isPro, onClick }) => (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all group">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 ${isPro ? 'bg-accent-violet/10 text-accent-violet' : 'bg-blue-500/10 text-blue-500'}`}>
            {icon}
        </div>
        <div className="flex items-center gap-2 mb-2">
            <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100">{title}</h4>
            {isPro && <span className="text-[10px] font-bold bg-accent-violet text-white px-2 py-0.5 rounded-full uppercase tracking-tighter">PRO</span>}
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
            {description}
        </p>
        <Button
            variant={isPro ? 'primary' : 'outline'}
            size="sm"
            fullWidth
            onClick={onClick}
            className={isPro ? 'grad-violet border-none' : ''}
        >
            Launch Tool
        </Button>
    </div>
);

const ToolsPanel: React.FC<{
    onOpenPricing: () => void;
    showToast: (msg: string, type?: any) => void;
    userTier: string;
}> = ({ onOpenPricing, showToast, userTier }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [currentTool, setCurrentTool] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const isProUser = userTier === 'pro';

    const [showOptionsModal, setShowOptionsModal] = useState(false);
    const [showResultsModal, setShowResultsModal] = useState(false);
    const [toolResult, setToolResult] = useState<any>(null);
    const [selectedFormat, setSelectedFormat] = useState('mp3');
    const tools = [
        {
            title: "Audio Fingerprinting",
            description: "Check if your track matches any existing songs in institutional registries to avoid copyright claims.",
            icon: <Search className="w-6 h-6" />,
            isPro: true
        },
        {
            title: "Metadata Stripper",
            description: "Clean all ID3/Ape tags from your files for a fresh start. Ideal for protecting private data.",
            icon: <Trash2 className="w-6 h-6" />,
            isPro: false
        },
        {
            title: "Stem Separation",
            description: "Separate vocals, drums, and bass from any track using AI-driven isolation. (High-Compute)",
            icon: <Zap className="w-6 h-6" />,
            isPro: true
        },
        {
            title: "Bulk License Export",
            description: "Generate a single master document containing all IPFS fingerprints for your recent analyses.",
            icon: <FileJson className="w-6 h-6" />,
            isPro: true
        },
        {
            title: "Music Validator",
            description: "Run a professional health check on your music files to ensure they meet store requirements.",
            icon: <Shield className="w-6 h-6" />,
            isPro: false
        },
        {
            title: "Format Converter",
            description: "High-quality conversion between WAV, FLAC, AIFF and high-bitrate MP3.",
            icon: <Music className="w-6 h-6" />,
            isPro: false
        }
    ];

    const handleAction = (isPro: boolean, title: string) => {
        if (isPro && !isProUser) {
            onOpenPricing();
            return;
        }

        // For tools with options, show options modal first
        if (title === 'Format Converter') {
            setCurrentTool(title);
            setShowOptionsModal(true);
            return;
        }

        // Open file picker
        setCurrentTool(title);
        fileInputRef.current?.click();
    };

    const handleActionWithOptions = () => {
        setShowOptionsModal(false);
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !currentTool) return;

        setIsProcessing(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            let endpoint = '';
            const method = 'POST';

            if (currentTool === 'Metadata Stripper') endpoint = '/tools/strip-metadata';
            else if (currentTool === 'Music Validator') endpoint = '/tools/validate';
            else if (currentTool === 'Format Converter') {
                endpoint = '/tools/convert';
                formData.append('target_format', selectedFormat);
            }
            else if (currentTool === 'Audio Fingerprinting') endpoint = '/tools/fingerprint';
            else if (currentTool === 'Bulk License Export') {
                // This tool doesn't need an uploaded file, it uses historical IDs
                // But for now, we'll mockup the ID collection
                endpoint = '/tools/bulk-export';
                formData.append('job_ids', 'batch-1,batch-2'); // Placeholder
            }
            else if (currentTool === 'Stem Separation') {
                showToast("Stem separation is a high-compute task. Preparing backend workers...", 'info');
                setIsProcessing(false);
                return;
            }

            if (!endpoint) {
                showToast("Tool logic not implemented yet.", 'info');
                setIsProcessing(false);
                return;
            }

            const response = await fetch(getFullUrl(endpoint), {
                method,
                body: formData
            });

            if (!response.ok) throw new Error("Tool execution failed.");

            // Handle file download if response is a file
            const contentType = response.headers.get('Content-Type');
            if (contentType === 'application/octet-stream') {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `mme_${currentTool.replace(/\s+/g, '_').toLowerCase()}_${file.name}`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                showToast(`${currentTool} completed! File downloaded.`, 'success');
            } else {
                const data = await response.json();
                setToolResult(data);
                setShowResultsModal(true);
                showToast(`${currentTool} complete. Report generated.`, 'success');
            }

        } catch (err) {
            showToast(`Error: ${(err as Error).message}`, 'error');
        } finally {
            setIsProcessing(false);
            setCurrentTool(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="animate-fade-in py-6">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="audio/*"
            />

            {isProcessing && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center">
                    <div className="bg-white dark:bg-slate-900 p-10 rounded-[2.5rem] shadow-2xl flex flex-col items-center border border-white/10">
                        <div className="w-16 h-16 border-4 border-accent-violet border-t-transparent rounded-full animate-spin mb-6"></div>
                        <h3 className="text-xl font-bold dark:text-white">Laboratory Working...</h3>
                        <p className="text-slate-500 text-sm mt-2">{currentTool} in progress</p>
                    </div>
                </div>
            )}

            {/* Options Modal */}
            {showOptionsModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] p-8 shadow-2xl border border-slate-200 dark:border-slate-800 animate-scale-up">
                        <h3 className="text-2xl font-bold mb-6 dark:text-white">Tool Options: {currentTool}</h3>

                        {currentTool === 'Format Converter' && (
                            <div className="space-y-4 mb-8">
                                <label className="block text-sm font-bold text-slate-500 uppercase">Target Format</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {['mp3', 'wav', 'flac', 'aiff'].map(fmt => (
                                        <button
                                            key={fmt}
                                            onClick={() => setSelectedFormat(fmt)}
                                            className={`py-3 rounded-xl border-2 transition-all font-bold uppercase ${selectedFormat === fmt ? 'border-accent-violet bg-accent-violet/10 text-accent-violet' : 'border-slate-100 dark:border-slate-800 text-slate-400'}`}
                                        >
                                            {fmt}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex gap-4">
                            <Button variant="outline" className="flex-1" onClick={() => setShowOptionsModal(false)}>Cancel</Button>
                            <Button variant="primary" className="flex-1 grad-violet" onClick={handleActionWithOptions}>Pick File & Launch</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Results Modal (Lab Report) */}
            {showResultsModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] p-8 shadow-2xl border border-slate-200 dark:border-slate-800 animate-scale-up max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-black dark:text-white flex items-center gap-2">
                                <Shield className="text-accent-emerald w-6 h-6" /> Lab Report: {currentTool}
                            </h3>
                            <span className="text-xs bg-accent-emerald/10 text-accent-emerald px-3 py-1 rounded-full font-bold">SUCCESS</span>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-950/50 rounded-3xl p-8 mb-8 border border-slate-100 dark:border-slate-800/50">
                            {/* Validation Result UI */}
                            {toolResult?.validation_report ? (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-1">
                                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Global Health Score</p>
                                            <div className="flex items-baseline gap-2">
                                                <span className={`text-5xl font-black ${toolResult.validation_report.score > 80 ? 'text-accent-emerald' : toolResult.validation_report.score > 50 ? 'text-yellow-500' : 'text-red-500'}`}>
                                                    {toolResult.validation_report.score}
                                                </span>
                                                <span className="text-slate-500 font-bold">/ 100</span>
                                            </div>
                                        </div>
                                        <div className={`px-4 py-2 rounded-xl border-2 font-black uppercase tracking-tighter ${toolResult.validation_report.status === 'valid' ? 'border-accent-emerald/30 text-accent-emerald bg-accent-emerald/5' : 'border-red-500/30 text-red-500 bg-red-500/5'}`}>
                                            {toolResult.validation_report.status}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-3">
                                            <h4 className="flex items-center gap-2 text-xs font-black text-red-500 uppercase tracking-wider">
                                                <XCircle className="w-4 h-4" /> Critical Issues
                                            </h4>
                                            <div className="space-y-2">
                                                {toolResult.validation_report.issues.map((issue: string, i: number) => (
                                                    <div key={i} className="flex gap-2 text-sm text-slate-600 dark:text-slate-400 bg-red-500/5 p-3 rounded-xl border border-red-500/10">
                                                        <span className="text-red-500 mt-1">•</span>
                                                        {issue}
                                                    </div>
                                                ))}
                                                {toolResult.validation_report.issues.length === 0 && (
                                                    <p className="text-slate-400 text-sm italic p-3">No critical issues found.</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <h4 className="flex items-center gap-2 text-xs font-black text-yellow-500 uppercase tracking-wider">
                                                <AlertTriangle className="w-4 h-4" /> Distribution Warnings
                                            </h4>
                                            <div className="space-y-2">
                                                {toolResult.validation_report.warnings.map((warn: string, i: number) => (
                                                    <div key={i} className="flex gap-2 text-sm text-slate-600 dark:text-slate-400 bg-yellow-500/5 p-3 rounded-xl border border-yellow-500/10">
                                                        <span className="text-yellow-500 mt-1">•</span>
                                                        {warn}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : toolResult?.fingerprint_short ? (
                                <div className="space-y-4">
                                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Acoustic Fingerprint (SHA-256)</p>
                                    <div className="font-mono text-xs break-all bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-accent-violet">
                                        {toolResult.fingerprint_short}...
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                                        <span>Provider: {toolResult.provider}</span>
                                        <span className="text-accent-emerald">READY FOR REGISTRY</span>
                                    </div>
                                </div>
                            ) : (
                                <pre className="text-sm font-mono text-slate-700 dark:text-slate-300 overflow-x-auto">
                                    {JSON.stringify(toolResult, null, 2)}
                                </pre>
                            )}
                        </div>

                        <Button variant="primary" fullWidth className="grad-violet" onClick={() => setShowResultsModal(false)}>Close Report</Button>
                    </div>
                </div>
            )}

            <div className="text-center mb-10 relative py-12 px-6 overflow-hidden rounded-[2.5rem] bg-slate-900/40 border border-white/5">
                <div className="absolute inset-0 opacity-20 pointer-events-none">
                    <img src="assets/pro_mic.png" className="w-full h-full object-cover blur-sm" alt="Pro Mic" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent"></div>
                </div>
                <div className="relative z-10">
                    <h2 className="text-4xl font-black text-white mb-3 tracking-tighter">Pro Production Tools</h2>
                    <p className="text-slate-400 max-w-2xl mx-auto font-medium">
                        A suite of professional utilities designed to streamline your studio workflow and protect your intellectual property.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tools.map((tool, index) => (
                    <ToolCard
                        key={index}
                        {...tool}
                        onClick={() => handleAction(tool.isPro, tool.title)}
                    />
                ))}
            </div>

            <div className="mt-12 p-8 rounded-3xl bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                    <h4 className="text-xl font-bold dark:text-white">Need a custom tool?</h4>
                    <p className="text-slate-500 text-sm">We are constantly expanding our Laboratory. Request a specific engine update.</p>
                </div>
                <Button variant="outline" className="text-accent-violet border-accent-violet/30 hover:bg-accent-violet hover:text-white">
                    Request Feature
                </Button>
            </div>
        </div>
    );
};

export default ToolsPanel;
