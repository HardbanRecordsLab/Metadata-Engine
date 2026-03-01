import React, { useState, useRef } from 'react';
import { Metadata } from '../../types';
import Card from './Card';
import Button from '../Button';
import { Image as ImageIcon, Wand2, Download, Upload, Sparkles } from '../icons';

interface VisualsCardProps {
    metadata: Metadata;
    onUpdateField: (field: keyof Metadata, value: any) => void;
    showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

import { getFullUrl } from '../../apiConfig';

const VisualsCard: React.FC<VisualsCardProps> = ({ metadata, onUpdateField, showToast }) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleGenerateCover = async () => {
        if (!metadata.title) return;
        setIsGenerating(true);
        showToast("Generating premium cover art...", 'info');
        try {
            const response = await fetch(getFullUrl('/generate/cover'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: metadata.title,
                    artist: metadata.artist,
                    genre: metadata.mainGenre,
                    mood: metadata.moods?.[0] || "Neutral"
                })
            });

            if (!response.ok) throw new Error("Generation failed");

            const data = await response.json();
            onUpdateField('coverArt', data.image);
            showToast("Cover art generated successfully!", 'success');
        } catch (e) {
            console.error(e);
            showToast("Failed to generate cover art.", 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                onUpdateField('coverArt', event.target?.result);
                showToast("Custom cover art uploaded!", 'success');
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <Card className="border-l-4 border-l-accent-violet">
            <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4 mb-6">
                <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-gradient-to-br from-accent-violet to-indigo-600 text-white shadow-md shadow-accent-violet/20">
                    <ImageIcon className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-light-text dark:text-dark-text">Visual Identity</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Master cover art and assets.</p>
                </div>
            </div>

            <div className="flex flex-col gap-6">
                {/* Preview Area */}
                <div className="relative group aspect-square max-w-[280px] mx-auto w-full bg-slate-100 dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner">
                    {metadata.coverArt ? (
                        <img src={metadata.coverArt} alt="Cover Art" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                            <ImageIcon className="w-16 h-16 mb-4 opacity-20" />
                            <p className="text-sm font-medium opacity-50">No Visual Identity Assigned</p>
                        </div>
                    )}

                    {metadata.coverArt && (
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                            <a
                                href={metadata.coverArt}
                                download={`cover-${metadata.title || 'track'}.jpg`}
                                className="p-3 bg-white hover:bg-slate-100 rounded-full text-slate-900 shadow-xl transform transition-all hover:scale-110 active:scale-95"
                                title="Download Image"
                            >
                                <Download className="w-6 h-6" />
                            </a>
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div className="space-y-4">
                    <div className="bg-slate-50 dark:bg-slate-900/30 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="w-4 h-4 text-accent-violet" />
                            <h4 className="font-bold text-sm">Visual Generator</h4>
                        </div>
                        <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                            Generate high-fidelity, thematic artwork with professional typography using our neural design engine.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Button
                                onClick={handleGenerateCover}
                                disabled={isGenerating || !metadata.title}
                                className="w-full justify-center bg-gradient-to-r from-accent-violet/10 to-indigo-600/10 hover:from-accent-violet hover:to-indigo-600 text-accent-violet hover:text-white border border-accent-violet/20 hover:border-transparent transition-all duration-300 shadow-sm"
                            >
                                {isGenerating ? (
                                    <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" /> Working...</>
                                ) : (
                                    <><Wand2 className="w-4 h-4 mr-2" /> Neural Gen</>
                                )}
                            </Button>

                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept="image/*"
                                className="hidden"
                            />
                            <Button
                                onClick={handleUploadClick}
                                variant="secondary"
                                className="w-full justify-center border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                            >
                                <Upload className="w-4 h-4 mr-2" /> Upload
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );
};

export default VisualsCard;
