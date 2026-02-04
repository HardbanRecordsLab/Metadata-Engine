import React, { useState } from 'react';
import { Metadata } from '../../types';
import Card from './Card';
import Button from '../Button';
import { Sparkles, MessageSquare, Megaphone, Newspaper, Video, Copy, RotateCcw } from '../icons';
import { generateMarketingContentV2 } from '../../services/enhanced/geminiServiceV2';

interface CreativeSuiteCardProps {
    metadata: Metadata;
    showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

const CreativeSuiteCard: React.FC<CreativeSuiteCardProps> = ({ metadata, showToast }) => {
    const [selectedType, setSelectedType] = useState('social');
    const [selectedTone, setSelectedTone] = useState('Professional');
    const [generatedContent, setGeneratedContent] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const types = [
        { id: 'social', label: 'Social Post', icon: <MessageSquare className="w-4 h-4" /> },
        { id: 'press', label: 'Press Release', icon: <Newspaper className="w-4 h-4" /> },
        { id: 'bio', label: 'Streaming Bio', icon: <Copy className="w-4 h-4" /> },
        { id: 'sync_pitch', label: 'Sync Pitch', icon: <Megaphone className="w-4 h-4" /> },
        { id: 'video_ad', label: 'Ad Script', icon: <Video className="w-4 h-4" /> },
    ];

    const tones = ['Professional', 'Evocative', 'Hype', 'Dark', 'Minimalist', 'Emotional'];

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const content = await generateMarketingContentV2(metadata, selectedType, selectedTone);
            setGeneratedContent(content);
            showToast("Content generated successfully!", 'success');
        } catch (error) {
            showToast("Failed to generate content.", 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(generatedContent);
        showToast("Copied to clipboard!", 'success');
    };

    return (
        <Card className="border-l-4 border-l-purple-500 overflow-hidden">
            <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4 mb-6">
                <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-md shadow-purple-500/20">
                    <Sparkles className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-light-text dark:text-dark-text">AI Creative Suite</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Generate marketing & sync materials.</p>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                    {types.map((type) => (
                        <button
                            key={type.id}
                            onClick={() => setSelectedType(type.id)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedType === type.id
                                    ? 'bg-purple-500 text-white shadow-md'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                        >
                            {type.icon}
                            {type.label}
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Tone of Voice</label>
                        <select
                            value={selectedTone}
                            onChange={(e) => setSelectedTone(e.target.value)}
                            className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs outline-none focus:ring-2 focus:ring-purple-500"
                        >
                            {tones.map(tone => <option key={tone} value={tone}>{tone}</option>)}
                        </select>
                    </div>
                    <div className="flex items-end">
                        <Button
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            variant="primary"
                            className="w-full bg-purple-600 hover:bg-purple-700 border-none shadow-lg shadow-purple-500/20"
                        >
                            {isGenerating ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>Generate <Sparkles className="w-3 h-3 ml-2" /></>
                            )}
                        </Button>
                    </div>
                </div>

                {generatedContent && (
                    <div className="mt-6 animate-fade-in">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-bold text-purple-500 uppercase">Generated Metadata</span>
                            <div className="flex gap-2">
                                <button onClick={handleGenerate} className="p-1 text-slate-400 hover:text-purple-500 transition-colors" title="Regenerate">
                                    <RotateCcw className="w-4 h-4" />
                                </button>
                                <button onClick={handleCopy} className="p-1 text-slate-400 hover:text-purple-500 transition-colors" title="Copy">
                                    <Copy className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-purple-200 dark:border-purple-800/50 text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                            {generatedContent}
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
};

export default CreativeSuiteCard;
