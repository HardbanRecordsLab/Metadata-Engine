import React, { useState, useCallback, useRef } from 'react';
import { Upload, Music, Download, Globe, Zap, BrainCircuit, Shield, LayoutGrid, X, ArrowRight, Sparkles } from './icons';
import Button from './Button';
import { BatchItem, UserTier } from '../types';
import BatchQueueItem from './BatchQueueItem';
import { readMetadataFromFile } from '../services/taggingService';

interface InputSectionProps {
    batch: BatchItem[];
    setBatch: React.Dispatch<React.SetStateAction<BatchItem[]>>;
    onAnalyze: (modelPreference: 'flash' | 'pro') => void;
    isProMode: boolean;
    setIsProMode: (isPro: boolean) => void;
    isProcessingBatch: boolean;
    onViewResults: (itemId: string) => void;
    onExportBatch: () => void;
    showToast: (message: string, type: 'success' | 'error' | 'info') => void;
    userTier: UserTier;
    userCredits: number;
    onOpenPricing: () => void;
    onOpenCloudImport: () => void;
    onOpenBulkEdit: () => void;
    isFresh: boolean;
    setIsFresh: (isFresh: boolean) => void;
    onRetry: (id: string) => void;
}

const InputSection: React.FC<InputSectionProps> = ({
    batch, setBatch, onAnalyze, isProMode, setIsProMode, isProcessingBatch, onViewResults, onRetry, onExportBatch, userTier, userCredits, onOpenPricing, onOpenCloudImport, showToast, onOpenBulkEdit, isFresh, setIsFresh
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const dragCounter = useRef(0);

    const isStarter = userTier === 'starter';
    const completedCount = batch.filter(i => i.status === 'completed').length;
    const pendingItemsCount = batch.filter(item => item.status === 'pending').length;

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault(); e.stopPropagation(); dragCounter.current += 1;
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) setIsDragging(true);
    };
    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault(); e.stopPropagation(); dragCounter.current -= 1;
        if (dragCounter.current === 0) setIsDragging(false);
    };
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault(); e.stopPropagation();
    };

    const addFilesToBatch = useCallback(async (files: FileList | File[]) => {
        const rawFiles = Array.from(files);
        const audioFiles = rawFiles.filter(f => f.type.startsWith('audio/') || f.name.match(/\.(mp3|wav|flac|aiff|m4a|ogg)$/i));

        if (audioFiles.length === 0) {
            showToast("Please drop valid audio files only.", 'error');
            return;
        }

        const uniqueFiles = audioFiles.filter(file => {
            return !batch.some(b => b.file.name === file.name && b.file.size === file.size);
        });

        const newItems: BatchItem[] = [];
        for (const file of uniqueFiles) {
            const { metadata } = await readMetadataFromFile(file);
            newItems.push({
                id: `${file.name}-${Date.now()}-${Math.random()}`,
                file,
                status: 'pending',
                metadata: Object.keys(metadata).length > 0 ? (metadata as any) : undefined
            });
        }
        setBatch(prev => [...prev, ...newItems]);
    }, [setBatch, batch, showToast]);

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault(); e.stopPropagation(); setIsDragging(false); dragCounter.current = 0;
        if (e.dataTransfer.files?.length > 0) addFilesToBatch(e.dataTransfer.files);
    }, [addFilesToBatch]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.length > 0) { addFilesToBatch(e.target.files); e.target.value = ''; }
    };

    const progress = batch.length > 0 ? (completedCount / batch.length) * 100 : 0;

    return (
        <div className="space-y-8 animate-fade-in pb-10">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-2">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-accent-violet">
                        <Sparkles className="w-5 h-5 fill-accent-violet/20" />
                        <span className="text-xs font-black uppercase tracking-[0.2em]">Lossless Tagging Engine</span>
                    </div>
                    <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">
                        Smart <span className="text-transparent bg-clip-text grad-lab">Laboratory</span>
                    </h2>
                    <p className="text-slate-500 font-medium">Inject professional metadata into your master stems.</p>
                </div>

                <div className="hidden md:flex items-center gap-3 bg-white/5 backdrop-blur-md p-2 rounded-2xl border border-white/10">
                    <button onClick={onOpenCloudImport} className="flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-white/10 transition-all text-xs font-bold text-slate-400">
                        <Globe className="w-4 h-4" /> Import Cloud
                    </button>
                    <div className="w-px h-4 bg-white/10"></div>
                </div>
            </div>

            {/* Premium Dropzone */}
            <div
                onDrop={handleDrop} onDragOver={handleDragOver} onDragEnter={handleDragEnter} onDragLeave={handleDragLeave}
                className={`group relative flex flex-col items-center justify-center w-full min-h-[340px] rounded-[3rem] transition-all duration-700 overflow-hidden border-2 border-dashed
                ${isDragging ? 'border-accent-violet bg-accent-violet/5 scale-[0.98] shadow-2xl' : 'border-slate-300 dark:border-white/10 bg-slate-50/50 dark:bg-slate-950/30'}`}
            >
                {/* Background Visual Enhancements */}
                <div className="absolute inset-0 opacity-10 pointer-events-none group-hover:opacity-20 transition-opacity">
                    <img src="/assets/analysis_visual.png" className="w-full h-full object-cover grayscale mix-blend-overlay" />
                </div>

                <input id="dropzone-file" type="file" className="hidden" onChange={handleFileChange} accept="audio/*" multiple={!isStarter} />

                <label htmlFor="dropzone-file" className="relative z-10 flex flex-col items-center justify-center w-full h-full cursor-pointer p-10 text-center">
                    <div className="w-24 h-24 rounded-[2rem] grad-lab flex items-center justify-center mb-8 shadow-2xl shadow-accent-violet/40 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                        <Upload className="w-10 h-10 text-white" />
                    </div>

                    <h4 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
                        Drop High-Resolution Audio
                    </h4>
                    <p className="text-slate-500 dark:text-slate-400 font-medium max-w-sm mx-auto mb-8">
                        Our engine automatically detects BPM, Key, Genre, and mood-vibe for your tracks.
                    </p>

                    <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-white dark:bg-slate-900 shadow-xl border border-slate-100 dark:border-white/5 opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-500">
                        <span className="text-sm font-black text-slate-900 dark:text-white">BROWSE FILES</span>
                        <ArrowRight className="w-4 h-4 text-accent-violet" />
                    </div>
                </label>

                {isDragging && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-accent-violet/10 backdrop-blur-md z-20 animate-fade-in">
                        <div className="w-32 h-32 border-4 border-accent-violet border-dashed rounded-full animate-spin-slow flex items-center justify-center">
                            <Download className="w-12 h-12 text-accent-violet" />
                        </div>
                    </div>
                )}
            </div>

            {/* Mode & Refinement Controls */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="md:col-span-8 flex flex-wrap gap-4">
                    <div className="bg-slate-100/50 dark:bg-white/5 backdrop-blur-md rounded-[2rem] p-1.5 flex items-center border border-slate-200 dark:border-white/10 shadow-inner">
                        <button
                            onClick={() => setIsProMode(false)}
                            className={`flex items-center gap-2 px-8 py-3 rounded-[1.5rem] text-sm font-black transition-all ${!isProMode ? 'bg-white dark:bg-white text-slate-900 shadow-xl' : 'text-slate-500 hover:text-slate-700 dark:hover:text-white'}`}
                        >
                            <Zap className={`w-4 h-4 ${!isProMode ? 'fill-accent-blue text-accent-blue' : ''}`} /> Standard
                        </button>
                        <button
                            onClick={() => setIsProMode(true)}
                            className={`flex items-center gap-2 px-8 py-3 rounded-[1.5rem] text-sm font-black transition-all ${isProMode ? 'bg-white dark:bg-white text-slate-900 shadow-xl' : 'text-slate-500 hover:text-slate-700 dark:hover:text-white'}`}
                        >
                            <BrainCircuit className={`w-4 h-4 ${isProMode ? 'fill-accent-violet text-accent-violet' : ''}`} /> Pro Core
                        </button>
                    </div>

                    <button
                        onClick={() => setIsFresh(!isFresh)}
                        className={`flex items-center gap-4 px-6 py-3 rounded-[2rem] border transition-all duration-300 font-black text-sm shadow-sm ${isFresh ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-600 shadow-emerald-500/10' : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400'}`}
                    >
                        <Shield className={`w-5 h-5 ${isFresh ? 'text-emerald-500' : ''}`} />
                        Fresh Accuracy
                        <div className={`w-10 h-5 rounded-full relative transition-colors ${isFresh ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'}`}>
                            <div className={`absolute top-1 w-3 h-3 rounded-full bg-white shadow-sm transition-all ${isFresh ? 'left-6' : 'left-1'}`}></div>
                        </div>
                    </button>
                </div>

                <div className="md:col-span-4 flex items-center justify-end">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                        Processing Power: <br /> <span className="text-white">Gemini 1.5 {isProMode ? 'Pro' : 'Flash'}</span>
                    </p>
                </div>
            </div>

            {/* Queue Visualization */}
            {batch.length > 0 && (
                <div className="panel-card bg-white/5 backdrop-blur-xl border border-white/10 !p-8 animate-slide-up space-y-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Ingest Queue</h3>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{batch.length} Tracks Identified</p>
                        </div>
                        <button onClick={() => setBatch([])} disabled={isProcessingBatch} className="p-2 hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-500 transition-all font-bold text-xs flex items-center gap-1">
                            <X className="w-4 h-4" /> Purge
                        </button>
                    </div>

                    <div className="w-full bg-slate-200 dark:bg-white/5 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-accent-violet h-full transition-all duration-1000 shadow-[0_0_10px_rgba(139,92,246,0.5)]" style={{ width: `${progress}%` }}></div>
                    </div>

                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
                        {batch.map(item => (
                            <BatchQueueItem
                                key={item.id}
                                item={item}
                                onRemove={() => setBatch(b => b.filter(i => i.id !== item.id))}
                                onRetry={onRetry}
                                onViewResults={onViewResults}
                                isProcessingBatch={isProcessingBatch}
                                onDragStart={() => { }}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={() => { }}
                            />
                        ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                        <Button onClick={onExportBatch} variant="outline" size="lg" disabled={isProcessingBatch || completedCount === 0 || isStarter} className="rounded-3xl border-slate-200 dark:border-white/10 dark:text-white">
                            <Download className="w-5 h-5 text-accent-violet" /> Institutional CSV
                        </Button>
                        <Button
                            onClick={() => onAnalyze(isProMode ? 'pro' : 'flash')}
                            variant="primary"
                            size="lg"
                            disabled={isProcessingBatch || pendingItemsCount === 0}
                            className="rounded-3xl grad-violet font-black"
                        >
                            {isProcessingBatch ? 'Mastering Tracks...' : `Execute Analysis ${pendingItemsCount > 0 ? `(${pendingItemsCount})` : ''}`}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InputSection;
