import React from 'react';
import { Metadata } from '../../types';
import Card from './Card';
import { Activity, Sparkles, Hash, Key, Calendar, User } from '../icons';
import Tooltip from '../Tooltip';

interface SonicAnalysisDisplayProps {
    metadata: Metadata;
    isEditing: boolean;
    onFieldUpdate: (field: keyof Metadata, value: any) => void;
    refiningField: keyof Metadata | null;
    onRefine: (field: keyof Metadata) => void;
    audioFeatures?: any;
}

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
    <div className={`p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-3 transition-colors group ${className}`}>
        <div className="flex-shrink-0 text-slate-400">
            {icon}
        </div>
        <div className="flex-grow">
            <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">{label}</label>
            <div className="flex items-baseline gap-1">
                <EditableInput
                    isEditing={isEditing}
                    value={value}
                    onChange={v => onFieldUpdate(field, type === 'number' ? Number.parseInt(v, 10) : v)}
                    className="font-bold text-lg p-0 border-none shadow-none bg-transparent"
                    type={type}
                />
                {unit && <span className="text-sm text-slate-500">{unit}</span>}
            </div>
        </div>
        {isEditing && (
            <Tooltip text="Enhance with AI">
                <button onClick={() => onRefine(field)} disabled={!!refiningField} className="text-slate-400 hover:text-accent-violet transition-colors disabled:opacity-50">
                    {refiningField === field ? <div className="w-4 h-4 border-2 border-accent-violet border-t-transparent rounded-full animate-spin" /> : <Sparkles className="w-4 h-4 text-accent-violet" />}
                </button>
            </Tooltip>
        )}
    </div>
);

const SonicAnalysisDisplay: React.FC<SonicAnalysisDisplayProps> = ({
    metadata, isEditing, onFieldUpdate, refiningField, onRefine, audioFeatures
}) => {
    return (
        <Card>
            <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4 mb-6">
                <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-green-500 text-white shadow-md shadow-blue-500/20">
                    <Activity className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-light-text dark:text-dark-text">Sonic Analysis</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Key audio characteristics.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <SonicField
                    label="BPM" value={audioFeatures?.bpm ?? metadata.bpm} field="bpm"
                    isEditing={isEditing} onFieldUpdate={onFieldUpdate} refiningField={refiningField} onRefine={onRefine}
                    icon={<Hash className="w-5 h-5" />} unit="BPM" type="number"
                />
                <SonicField
                    label="KEY" value={audioFeatures?.key ?? metadata.key} field="key"
                    isEditing={isEditing} onFieldUpdate={onFieldUpdate} refiningField={refiningField} onRefine={onRefine}
                    icon={<Key className="w-5 h-5" />}
                />
                <SonicField
                    label="MODE" value={audioFeatures?.mode ?? metadata.mode} field="mode"
                    isEditing={isEditing} onFieldUpdate={onFieldUpdate} refiningField={refiningField} onRefine={onRefine}
                    icon={<Key className="w-5 h-5" />}
                />
                <SonicField
                    label="VIBE" value={(metadata as any).mood_vibe} field={"mood_vibe" as any}
                    isEditing={isEditing} onFieldUpdate={onFieldUpdate} refiningField={refiningField} onRefine={onRefine}
                    icon={<Activity className="w-5 h-5" />}
                />
                <SonicField
                    label="ENERGY" value={metadata.energy_level || metadata.energyLevel} field="energy_level"
                    isEditing={isEditing} onFieldUpdate={onFieldUpdate} refiningField={refiningField} onRefine={onRefine}
                    icon={<Sparkles className="w-5 h-5" />}
                />
                <SonicField
                    label="ERA" value={metadata.musicalEra} field="musicalEra"
                    isEditing={isEditing} onFieldUpdate={onFieldUpdate} refiningField={refiningField} onRefine={onRefine}
                    icon={<Calendar className="w-5 h-5" />}
                />
                <SonicField
                    label="QUALITY" value={metadata.productionQuality} field="productionQuality"
                    isEditing={isEditing} onFieldUpdate={onFieldUpdate} refiningField={refiningField} onRefine={onRefine}
                    icon={<Activity className="w-5 h-5" />}
                />
                <SonicField
                    label="DYNAMICS" value={metadata.dynamics} field="dynamics"
                    isEditing={isEditing} onFieldUpdate={onFieldUpdate} refiningField={refiningField} onRefine={onRefine}
                    icon={<Activity className="w-5 h-5" />}
                />
                <SonicField
                    label="AUDIENCE" value={metadata.targetAudience} field="targetAudience"
                    isEditing={isEditing} onFieldUpdate={onFieldUpdate} refiningField={refiningField} onRefine={onRefine}
                    icon={<User className="w-5 h-5" />}
                />
            </div>
        </Card>
    );
};

export default SonicAnalysisDisplay;
