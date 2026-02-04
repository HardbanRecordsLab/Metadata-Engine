import React from 'react';
import { Metadata, VocalStyle } from '../../types';
import Card from './Card';
import { Tags as TagsIcon, Sparkles, Mic, AlertCircle, Hash, Code, User, FileText } from '../icons';
import Tooltip from '../Tooltip';

interface ClassificationStyleCardProps {
    metadata: Metadata;
    isEditing: boolean;
    onFieldUpdate: (field: keyof Metadata, value: any) => void;
    refiningField: keyof Metadata | null;
    onRefine: (field: keyof Metadata) => void;
}

const EditableTagList: React.FC<{
    isEditing: boolean;
    tags: string[];
    onChange: (tags: string[]) => void;
    placeholder?: string;
    colorClass?: string;
}> = ({ isEditing, tags, onChange, placeholder = "Enter tags separated by commas", colorClass = "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700" }) => {
    const safeTags = tags || [];
    if (isEditing) {
        return (
            <textarea
                value={safeTags.join(', ')}
                onChange={(e) => onChange(e.target.value.split(',').map(tag => tag.trim()).filter(Boolean))}
                rows={2}
                className="w-full p-2 bg-white dark:bg-slate-900 rounded-md text-sm border border-slate-300 dark:border-slate-600 focus:ring-accent-violet focus:border-accent-violet outline-none shadow-sm focus:shadow-md"
                placeholder={placeholder}
            />
        );
    }
    return (
        <div className="flex flex-wrap gap-2">
            {safeTags.length > 0 ? safeTags.map((tag, i) => (
                <span key={i} className={`px-2.5 py-1 rounded-md text-xs font-medium border ${colorClass}`}>
                    {tag}
                </span>
            )) : <span className="text-slate-400 text-xs italic">No tags</span>}
        </div>
    );
};

const TagSection: React.FC<{
    title: string;
    field: keyof Metadata;
    tags: string[];
    isEditing: boolean;
    onFieldUpdate: (field: keyof Metadata, value: string[]) => void;
    refiningField: keyof Metadata | null;
    onRefine: (field: keyof Metadata) => void;
    icon?: React.ReactNode;
    colorClass?: string;
}> = ({ title, field, tags, isEditing, onFieldUpdate, refiningField, onRefine, icon, colorClass }) => (
    <div className="group">
        <div className="flex justify-between items-center mb-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">{icon} {title}</label>
            <Tooltip text="Enhance with AI">
                <button onClick={() => onRefine(field)} className="text-slate-400 hover:text-accent-violet transition-colors disabled:opacity-50" disabled={!!refiningField}>
                    {refiningField === field ? (
                        <div className="w-3 h-3 border-2 border-accent-violet border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                        <Sparkles className="w-3 h-3 text-accent-violet" />
                    )}
                </button>
            </Tooltip>
        </div>
        <EditableTagList isEditing={isEditing} tags={tags} onChange={(v) => onFieldUpdate(field, v)} colorClass={colorClass} />
    </div>
);

const EditableVocalStyle: React.FC<{
    isEditing: boolean;
    value: VocalStyle | undefined;
    onChange: (field: keyof Metadata, value: any) => void;
}> = ({ isEditing, value, onChange }) => {
    const safeValue: VocalStyle = value || { gender: 'None', timbre: '', delivery: '', emotionalTone: '' };

    const fields: { key: keyof VocalStyle; label: string }[] = [
        { key: 'gender', label: 'Gender' },
        { key: 'timbre', label: 'Timbre' },
        { key: 'delivery', label: 'Delivery' },
        { key: 'emotionalTone', label: 'Emotion' },
    ];

    const handleFieldChange = (fieldKey: keyof VocalStyle, fieldValue: string) => {
        onChange('vocalStyle', { ...safeValue, [fieldKey]: fieldValue });
    };

    if (isEditing) {
        return (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {fields.map(({ key, label }) => (
                    <div key={key}>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">{label}</label>
                        <input
                            type="text"
                            value={safeValue[key]}
                            onChange={(e) => handleFieldChange(key, e.target.value)}
                            className="w-full mt-1 p-2 bg-slate-100 dark:bg-slate-800 rounded-md text-sm border border-slate-300 dark:border-slate-600 focus:ring-accent-violet focus:border-accent-violet"
                        />
                    </div>
                ))}
            </div>
        );
    }

    if (safeValue.gender === 'None' || (!safeValue.gender && !safeValue.timbre && !safeValue.delivery && !safeValue.emotionalTone)) {
        return <p className="text-sm text-slate-500 dark:text-slate-400 italic">No vocals detected</p>;
    }

    return (
        <div className="flex flex-wrap gap-2 text-xs">
            {safeValue.gender && safeValue.gender !== 'None' && (
                <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-600 dark:text-slate-300 flex items-center gap-1 font-medium">
                    <User className="w-3 h-3" /> {safeValue.gender}
                </span>
            )}
            {safeValue.timbre && (
                <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-600 dark:text-slate-300 font-medium">
                    {safeValue.timbre}
                </span>
            )}
            {safeValue.delivery && (
                <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-600 dark:text-slate-300 font-medium">
                    {safeValue.delivery}
                </span>
            )}
            {safeValue.emotionalTone && (
                <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-600 dark:text-slate-300 font-medium">
                    {safeValue.emotionalTone}
                </span>
            )}
        </div>
    );
};

const ClassificationStyleCard: React.FC<ClassificationStyleCardProps> = ({
    metadata, isEditing, onFieldUpdate, refiningField, onRefine
}) => {
    return (
        <Card>
            <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4 mb-6">
                <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-gradient-to-br from-pink-500 to-rose-500 text-white shadow-md shadow-rose-500/20">
                    <TagsIcon className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-light-text dark:text-dark-text">Classification & Style</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Genres, instruments, and vocal characteristics.</p>
                </div>
            </div>

            <div className="space-y-6">
                <div className="group">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2"><Hash className="w-4 h-4" /> Main Genre</label>
                        <Tooltip text="Suggest precise genre (AI)">
                            <button onClick={() => onRefine('mainGenre')} className="text-slate-400 hover:text-accent-violet transition-colors disabled:opacity-50" disabled={!!refiningField}>
                                {refiningField === 'mainGenre' ? (
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
                            value={metadata.mainGenre || ''}
                            onChange={(e) => onFieldUpdate('mainGenre', e.target.value)}
                            className="w-full p-2 bg-white dark:bg-slate-900 rounded-md text-lg font-bold text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-600 focus:ring-accent-violet focus:border-accent-violet outline-none shadow-sm focus:shadow-md"
                            placeholder="e.g. Deep House"
                        />
                    ) : (
                        <div className="text-xl font-bold text-slate-800 dark:text-slate-100">{metadata.mainGenre || '-'}</div>
                    )}
                </div>

                <TagSection
                    title="Sub-Genres"
                    field="additionalGenres"
                    tags={metadata.additionalGenres || []}
                    isEditing={isEditing}
                    onFieldUpdate={onFieldUpdate}
                    refiningField={refiningField}
                    onRefine={onRefine}
                    icon={<Code className="w-4 h-4" />}
                    colorClass="bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800/50"
                />

                <TagSection
                    title="Moods"
                    field="moods"
                    tags={metadata.moods || []}
                    isEditing={isEditing}
                    onFieldUpdate={onFieldUpdate}
                    refiningField={refiningField}
                    onRefine={onRefine}
                    icon={<AlertCircle className="w-4 h-4" />}
                    colorClass="bg-fuchsia-50 dark:bg-fuchsia-900/20 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-200 dark:border-fuchsia-800/50"
                />

                <TagSection
                    title="Instrumentation"
                    field="instrumentation"
                    tags={metadata.instrumentation || []}
                    isEditing={isEditing}
                    onFieldUpdate={onFieldUpdate}
                    refiningField={refiningField}
                    onRefine={onRefine}
                    icon={<Mic className="w-4 h-4" />}
                    colorClass="bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/50"
                />

                <div className="group">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2"><User className="w-4 h-4" /> Vocal Style</label>
                        <Tooltip text="Enhance with AI">
                            <button onClick={() => onRefine('vocalStyle')} className="text-slate-400 hover:text-accent-violet transition-colors disabled:opacity-50" disabled={!!refiningField}>
                                {refiningField === 'vocalStyle' ? (
                                    <div className="w-3 h-3 border-2 border-accent-violet border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <Sparkles className="w-3 h-3 text-accent-violet" />
                                )}
                            </button>
                        </Tooltip>
                    </div>
                    <EditableVocalStyle
                        isEditing={isEditing}
                        value={metadata.vocalStyle}
                        onChange={onFieldUpdate}
                    />
                </div>

                <TagSection
                    title="Keywords"
                    field="keywords"
                    tags={metadata.keywords || []}
                    isEditing={isEditing}
                    onFieldUpdate={onFieldUpdate}
                    refiningField={refiningField}
                    onRefine={onRefine}
                    icon={<TagsIcon className="w-4 h-4" />}
                />

                <div className="group pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2"><FileText className="w-4 h-4" /> Track Description (Bio)</label>
                        <Tooltip text="Refine description (AI)">
                            <button onClick={() => onRefine('trackDescription')} className="text-slate-400 hover:text-accent-violet transition-colors disabled:opacity-50" disabled={!!refiningField}>
                                {refiningField === 'trackDescription' ? (
                                    <div className="w-3 h-3 border-2 border-accent-violet border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <Sparkles className="w-3 h-3 text-accent-violet" />
                                )}
                            </button>
                        </Tooltip>
                    </div>
                    {isEditing ? (
                        <textarea
                            value={metadata.trackDescription || ''}
                            onChange={(e) => onFieldUpdate('trackDescription', e.target.value)}
                            rows={4}
                            className="w-full p-3 bg-white dark:bg-slate-900 rounded-md text-sm text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-600 focus:ring-accent-violet focus:border-accent-violet outline-none shadow-sm focus:shadow-md"
                            placeholder="A professional description of the track..."
                        />
                    ) : (
                        <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50/50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800/50 italic">
                            {metadata.trackDescription || 'No description generated.'}
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
};

export default ClassificationStyleCard;
