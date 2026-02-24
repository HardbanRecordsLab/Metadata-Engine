import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Metadata } from '../../types';
import Card from './Card';
import { Activity, Sparkles, Hash, Key, Calendar, User, Zap, Brain, ChevronDown } from '../icons';
import Tooltip from '../Tooltip';

interface SonicAnalysisDisplayProps {
    metadata: Metadata;
    isEditing: boolean;
    onFieldUpdate: (field: keyof Metadata, value: any) => void;
    refiningField: keyof Metadata | null;
    onRefine: (field: keyof Metadata) => void;
    audioFeatures?: any;
}

const EnergyMeter: React.FC<{ value: number | string }> = ({ value }) => {
    const numValue = typeof value === 'number' ? value : parseInt(String(value)) || 0;
    const percentage = Math.min(Math.max(numValue, 0), 100);

    return (
        <div className="mt-2 space-y-1">
            <div className="flex justify-between items-end">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Energy Level</span>
                <span className="text-sm font-black text-accent-violet">{percentage}%</span>
            </div>
            <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden border border-white/5">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-accent-violet via-purple-500 to-pink-500 relative"
                >
                    <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] animate-[shimmer_2s_linear_infinite]" />
                </motion.div>
            </div>
        </div>
    );
};

const EditableInput: React.FC<{
    value: string | number | undefined;
    onChange: (val: string) => void;
    isEditing: boolean;
    className?: string;
    placeholder?: string;
    type?: 'text' | 'number';
}> = ({ value, onChange, isEditing, className = '', placeholder, type = 'text' }) => {
    if (!isEditing) {
        return <div className={`text-slate-800 dark:text-slate-200 whitespace-pre-wrap ${className}`}>{value || <span className="opacity-40 italic text-sm">{placeholder}</span>}</div>;
    }
    return (
        <input
            type={type}
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            className="w-full p-1.5 bg-white dark:bg-slate-900 rounded border border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-accent-violet text-sm transition-all outline-none shadow-sm focus:shadow-md"
            placeholder={placeholder}
        />
    );
};

const SonicField: React.FC<{
    label: string;
    value: string | number | undefined;
    field: keyof Metadata;
    isEditing: boolean;
    onFieldUpdate: (field: keyof Metadata, value: any) => void;
    refiningField: keyof Metadata | null;
    onRefine: (field: keyof Metadata) => void;
    icon: React.ReactNode;
    unit?: string;
    className?: string;
    type?: 'text' | 'number';
}> = ({ label, value, field, isEditing, onFieldUpdate, refiningField, onRefine, icon, unit, className, type }) => (
    <motion.div
        whileHover={{ y: -2 }}
        className={`p-4 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 flex items-center gap-4 transition-all group shadow-sm hover:shadow-premium hover:border-accent-violet/30 ${className}`}
    >
        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center text-slate-400 group-hover:text-accent-violet group-hover:bg-accent-violet/10 transition-colors">
            {icon}
        </div>
        <div className="flex-grow">
            <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-slate-500 tracking-widest mb-0.5">{label}</label>
            <div className="flex items-baseline gap-1">
                <EditableInput
                    isEditing={isEditing}
                    value={value}
                    onChange={v => onFieldUpdate(field, type === 'number' ? Number.parseInt(v, 10) : v)}
                    className="font-black text-xl p-0 border-none shadow-none bg-transparent"
                    type={type}
                />
                {unit && <span className="text-xs font-bold text-slate-500">{unit}</span>}
            </div>
        </div>
        {isEditing && (
            <Tooltip text="Enhance with AI">
                <button onClick={() => onRefine(field)} disabled={!!refiningField} className="p-2 rounded-lg hover:bg-accent-violet/10 text-slate-400 hover:text-accent-violet transition-colors disabled:opacity-50">
                    {refiningField === field ? <div className="w-4 h-4 border-2 border-accent-violet border-t-transparent rounded-full animate-spin" /> : <Sparkles className="w-5 h-5 text-accent-violet" />}
                </button>
            </Tooltip>
        )}
    </motion.div>
);

// ── Refined Vibe Card Component ──────────────────────────────────────────────
const VibeCard: React.FC<{
    moodVibe: string;
    energyLevel: string;
    isEditing: boolean;
    onUpdate: (v: string) => void;
}> = ({ moodVibe, energyLevel, isEditing, onUpdate }) => {
    const level = (energyLevel || '').toLowerCase();

    // Smooth gradients per energy level
    const gradient =
        level.includes('very high') ? 'from-rose-600/30 via-orange-500/15 to-amber-500/10'
            : level.includes('high') ? 'from-indigo-600/30 via-violet-500/15 to-purple-500/10'
                : level.includes('low') && level.includes('very') ? 'from-emerald-600/30 via-green-500/15 to-teal-500/10'
                    : level.includes('low') ? 'from-sky-600/30 via-cyan-500/15 to-blue-500/10'
                        : 'from-blue-600/30 via-indigo-500/15 to-violet-500/10';

    return (
        <motion.div
            whileHover={{ y: -2 }}
            className={`col-span-full p-6 rounded-2xl border border-white/5 bg-gradient-to-br ${gradient} backdrop-blur-xl shadow-xl relative overflow-hidden`}
        >
            {/* Soft Shimmer Effect */}
            <div className="absolute inset-0 bg-[linear-gradient(110deg,transparent_20%,rgba(255,255,255,0.05)_50%,transparent_80%)] bg-[length:200%_100%] animate-[shimmer_4s_linear_infinite]" />

            <div className="relative">
                <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-white/40" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Vibe / Ambient Mood</span>
                </div>
                {isEditing ? (
                    <textarea
                        value={moodVibe}
                        onChange={e => onUpdate(e.target.value)}
                        rows={2}
                        className="w-full bg-black/20 text-white/80 text-sm italic rounded-xl p-3 border border-white/10 focus:ring-2 focus:ring-white/20 outline-none resize-none"
                    />
                ) : (
                    <p className="text-white/90 text-[15px] italic leading-relaxed font-semibold">
                        {moodVibe ? `"${moodVibe}"` : <span className="opacity-30">No mood description identified.</span>}
                    </p>
                )}
            </div>
        </motion.div>
    );
};

const SonicAnalysisDisplay: React.FC<SonicAnalysisDisplayProps> = ({
    metadata, isEditing, onFieldUpdate, refiningField, onRefine, audioFeatures
}) => {
    return (
        <Card className="overflow-hidden border-none shadow-premium bg-slate-900/40 backdrop-blur-2xl">
            <div className="flex items-center justify-between border-b border-white/5 pb-6 mb-8">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/20">
                        <Activity className="w-7 h-7" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-white tracking-tight">Sonic Analysis</h3>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Laboratory DSP Engine v3.0</p>
                    </div>
                </div>
                <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Real-time Analysis Active</span>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                <SonicField
                    label="Tempo / BPM" value={audioFeatures?.bpm ?? metadata.bpm} field="bpm"
                    isEditing={isEditing} onFieldUpdate={onFieldUpdate} refiningField={refiningField} onRefine={onRefine}
                    icon={<Activity className="w-6 h-6" />} unit="BPM" type="number"
                />
                <SonicField
                    label="Musical Key" value={audioFeatures?.key ?? metadata.key} field="key"
                    isEditing={isEditing} onFieldUpdate={onFieldUpdate} refiningField={refiningField} onRefine={onRefine}
                    icon={<Key className="w-6 h-6" />}
                />
                <SonicField
                    label="Tonal Mode" value={audioFeatures?.mode ?? metadata.mode} field="mode"
                    isEditing={isEditing} onFieldUpdate={onFieldUpdate} refiningField={refiningField} onRefine={onRefine}
                    icon={<Activity className="w-6 h-6" />}
                />
                <motion.div
                    whileHover={{ y: -2 }}
                    className="p-4 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 flex flex-col justify-between transition-all group shadow-sm hover:shadow-premium hover:border-accent-violet/30"
                >
                    <div className="flex items-center gap-4">
                        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center text-slate-400 group-hover:text-accent-violet group-hover:bg-accent-violet/10 transition-colors">
                            <Zap className="w-6 h-6" />
                        </div>
                        <div className="flex-grow">
                            <label className="block text-[10px] font-black uppercase text-slate-500 dark:text-slate-500 tracking-widest">Acoustic Energy</label>
                            <EnergyMeter value={metadata.energy_level || metadata.energyLevel || 0} />
                        </div>
                    </div>
                </motion.div>
                <VibeCard
                    moodVibe={(metadata as any).mood_vibe || ''}
                    energyLevel={metadata.energy_level || metadata.energyLevel || ''}
                    isEditing={isEditing}
                    onUpdate={(v) => onFieldUpdate('mood_vibe' as keyof Metadata, v)}
                />
                <SonicField
                    label="Musical Era" value={metadata.musicalEra} field="musicalEra"
                    isEditing={isEditing} onFieldUpdate={onFieldUpdate} refiningField={refiningField} onRefine={onRefine}
                    icon={<Calendar className="w-6 h-6" />}
                />
                <SonicField
                    label="Production" value={metadata.productionQuality} field="productionQuality"
                    isEditing={isEditing} onFieldUpdate={onFieldUpdate} refiningField={refiningField} onRefine={onRefine}
                    icon={<Activity className="w-6 h-6" />}
                />
                <SonicField
                    label="Dynamics" value={metadata.dynamics} field="dynamics"
                    isEditing={isEditing} onFieldUpdate={onFieldUpdate} refiningField={refiningField} onRefine={onRefine}
                    icon={<Activity className="w-6 h-6" />}
                />
                <SonicField
                    label="Target Audience" value={metadata.targetAudience} field="targetAudience"
                    isEditing={isEditing} onFieldUpdate={onFieldUpdate} refiningField={refiningField} onRefine={onRefine}
                    icon={<User className="w-6 h-6" />}
                />
            </div>

            {/* Vocal Characteristics Section */}
            {metadata.vocalStyle && (metadata.vocalStyle.gender !== 'none' || isEditing) && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="mt-12 pt-8 border-t border-white/5"
                >
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-gradient-to-tr from-pink-500 to-rose-600 text-white shadow-lg shadow-rose-500/20">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className="text-lg font-black text-white tracking-tight">Vocal Characteristics</h4>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">AI-Powered Timbre & Delivery Analysis</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                        <SonicField
                            label="Gender"
                            value={metadata.vocalStyle.gender}
                            field="vocalStyle"
                            isEditing={isEditing}
                            onFieldUpdate={(f, v) => onFieldUpdate('vocalStyle', { ...metadata.vocalStyle, gender: v })}
                            refiningField={refiningField} onRefine={onRefine}
                            icon={<User className="w-5 h-5" />}
                        />
                        <SonicField
                            label="Timbre"
                            value={metadata.vocalStyle.timbre}
                            field="vocalStyle"
                            isEditing={isEditing}
                            onFieldUpdate={(f, v) => onFieldUpdate('vocalStyle', { ...metadata.vocalStyle, timbre: v })}
                            refiningField={refiningField} onRefine={onRefine}
                            icon={<Activity className="w-5 h-5" />}
                        />
                        <SonicField
                            label="Delivery"
                            value={metadata.vocalStyle.delivery}
                            field="vocalStyle"
                            isEditing={isEditing}
                            onFieldUpdate={(f, v) => onFieldUpdate('vocalStyle', { ...metadata.vocalStyle, delivery: v })}
                            refiningField={refiningField} onRefine={onRefine}
                            icon={<Zap className="w-5 h-5" />}
                        />
                        <SonicField
                            label="Emotional Tone"
                            value={metadata.vocalStyle.emotionalTone}
                            field="vocalStyle"
                            isEditing={isEditing}
                            onFieldUpdate={(f, v) => onFieldUpdate('vocalStyle', { ...metadata.vocalStyle, emotionalTone: v })}
                            refiningField={refiningField} onRefine={onRefine}
                            icon={<Sparkles className="w-5 h-5" />}
                        />
                    </div>
                </motion.div>
            )}

            {/* AI Analysis Reasoning — Subtle Collapsible Section */}
            {metadata.analysisReasoning && (
                <AnalysisReasoningBlock
                    reasoning={metadata.analysisReasoning}
                    isEditing={isEditing}
                    onUpdate={(v) => onFieldUpdate('analysisReasoning' as keyof Metadata, v)}
                />
            )}
        </Card>
    );
};

// ── Refined Reasoning Block Component ──────────────────────────────────────
const AnalysisReasoningBlock: React.FC<{
    reasoning: string;
    isEditing: boolean;
    onUpdate: (v: string) => void;
}> = ({ reasoning, isEditing, onUpdate }) => {
    const [expanded, setExpanded] = useState(false);

    // Parse structured reasoning (1) ... (2) ... (3) ...
    const points = reasoning
        .split(/(?=\(\d\))/)
        .map(p => p.trim())
        .filter(Boolean);

    return (
        <div className="mt-10 pt-8 border-t border-white/5">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between group"
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        <Brain className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                        <h4 className="text-sm font-bold text-white tracking-tight">AI Reasoning</h4>
                        <p className="text-[9px] uppercase tracking-widest text-slate-500 font-black">Classification Evidence</p>
                    </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="mt-4 space-y-3">
                            {isEditing ? (
                                <textarea
                                    value={reasoning}
                                    onChange={e => onUpdate(e.target.value)}
                                    rows={4}
                                    className="w-full p-3 bg-white/5 rounded-xl text-sm text-slate-300 border border-white/10 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                />
                            ) : (
                                <div className="grid gap-2">
                                    {points.map((point, i) => (
                                        <div key={i} className="p-3 bg-white/5 rounded-xl border border-white/5 flex gap-3 items-start">
                                            <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                                                {i + 1}
                                            </div>
                                            <p className="text-xs text-slate-400 leading-relaxed font-medium">
                                                {point.replace(/^\(\d+\)\s*/, '')}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SonicAnalysisDisplay;
