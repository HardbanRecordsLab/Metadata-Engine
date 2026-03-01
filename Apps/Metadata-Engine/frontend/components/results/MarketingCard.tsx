import React from 'react';
import { Metadata } from '../../types';
import Card from './Card';
import { Target, Users, ListPlus, Sparkles } from '../icons';
import Tooltip from '../Tooltip';

interface MarketingCardProps {
    metadata: Metadata;
    isEditing: boolean;
    onFieldUpdate: (field: keyof Metadata, value: any) => void;
    refiningField: keyof Metadata | null;
    onRefine: (field: keyof Metadata) => void;
}

const EditableList: React.FC<{
    isEditing: boolean;
    items: string[];
    onChange: (items: string[]) => void;
    placeholder?: string;
    itemIcon?: React.ReactNode;
}> = ({ isEditing, items, onChange, placeholder = "Enter items separated by commas", itemIcon }) => {
    const safeItems = items || [];
    if (isEditing) {
        return (
            <textarea
                value={safeItems.join(', ')}
                onChange={(e) => onChange(e.target.value.split(',').map(i => i.trim()).filter(Boolean))}
                rows={3}
                className="w-full p-2 bg-white dark:bg-slate-900 rounded-md text-sm border border-slate-300 dark:border-slate-600 focus:ring-accent-violet focus:border-accent-violet outline-none shadow-sm"
                placeholder={placeholder}
            />
        );
    }
    return (
        <ul className="space-y-1">
            {safeItems.length > 0 ? safeItems.map((item, i) => (
                <li key={i} className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2">
                    <span className="mt-1 text-accent-violet shrink-0">{itemIcon || '•'}</span>
                    <span>{item}</span>
                </li>
            )) : <li className="text-slate-400 text-sm italic">No data available</li>}
        </ul>
    );
};

const MarketingCard: React.FC<MarketingCardProps> = ({ metadata, isEditing, onFieldUpdate, refiningField, onRefine }) => {
    return (
        <Card>
            <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4 mb-6">
                <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-orange-500/20">
                    <Target className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-light-text dark:text-dark-text">Marketing & Strategy</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Target audience, use cases, and market fit.</p>
                </div>
            </div>

            <div className="space-y-6">
                {/* Target Audience */}
                <div className="group">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                            <Users className="w-4 h-4" /> Target Audience
                        </label>
                        <Tooltip text="Refine Audience (AI)">
                            <button onClick={() => onRefine('targetAudience')} className="text-slate-400 hover:text-accent-violet transition-colors disabled:opacity-50" disabled={!!refiningField}>
                                {refiningField === 'targetAudience' ? (
                                    <div className="w-3 h-3 border-2 border-accent-violet border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <Sparkles className="w-3 h-3 text-accent-violet" />
                                )}
                            </button>
                        </Tooltip>
                    </div>
                    {isEditing ? (
                        <input
                            type="text"
                            value={metadata.targetAudience || ''}
                            onChange={(e) => onFieldUpdate('targetAudience', e.target.value)}
                            className="w-full p-2 bg-white dark:bg-slate-900 rounded-md text-sm border border-slate-300 dark:border-slate-600 focus:ring-accent-violet focus:border-accent-violet outline-none shadow-sm"
                            placeholder="e.g. Gen Z, late-night drivers..."
                        />
                    ) : (
                        <div className="text-sm font-medium text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-md border border-slate-100 dark:border-slate-800">
                            {metadata.targetAudience || 'General Audience'}
                        </div>
                    )}
                </div>

                {/* Use Cases */}
                <div className="group">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                            <ListPlus className="w-4 h-4" /> Sync & Use Cases
                        </label>
                        <Tooltip text="Suggest Use Cases (AI)">
                            <button onClick={() => onRefine('useCases')} className="text-slate-400 hover:text-accent-violet transition-colors disabled:opacity-50" disabled={!!refiningField}>
                                {refiningField === 'useCases' ? (
                                    <div className="w-3 h-3 border-2 border-accent-violet border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <Sparkles className="w-3 h-3 text-accent-violet" />
                                )}
                            </button>
                        </Tooltip>
                    </div>
                    <EditableList
                        isEditing={isEditing}
                        items={metadata.useCases || []}
                        onChange={(v) => onFieldUpdate('useCases', v)}
                        itemIcon={<div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5" />}
                    />
                </div>

                {/* Similar Artists */}
                <div className="group pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                            <Users className="w-4 h-4" /> Similar Artists / Fans Also Like
                        </label>
                        {/* No direct refinement for similar_artists usually, but we could map it to 'similar_artists' if backend supports it. checking types... similar_artists is in Metadata yes. */}
                    </div>
                    <EditableList
                        isEditing={isEditing}
                        items={metadata.similar_artists || []}
                        onChange={(v) => onFieldUpdate('similar_artists', v)}
                        itemIcon={<div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5" />}
                        placeholder="Artist 1, Artist 2, Artist 3"
                    />
                </div>
            </div>
        </Card>
    );
};

export default MarketingCard;
