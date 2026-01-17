
import React from 'react';
import { Metadata, UserTier } from '../../types';
import Card from './Card';
import { Music, User, Calendar, Sparkles, FileText, Clock, Image } from '../icons';
import Tooltip from '../Tooltip';

interface TrackIdentityCardProps {
    metadata: Metadata;
    isEditing: boolean;
    onFieldUpdate: (field: keyof Metadata, value: any) => void;
    refiningField: keyof Metadata | null;
    onRefine: (field: keyof Metadata) => void;
    userTier: UserTier;
    onOpenPricing: () => void;
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

// Add missing imports manually in the file header if simplified replacement misses them.
// We are replacing the rendering logic.

const TrackIdentityCard: React.FC<TrackIdentityCardProps> = ({
    metadata, isEditing, onFieldUpdate, refiningField, onRefine,
    userTier, onOpenPricing
}) => {
    // Helper format duration
    const formatDuration = (seconds?: number) => {
        if (!seconds) return '--:--';
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60);
        return `${min}:${sec.toString().padStart(2, '0')}`;
    };

    return (
        <Card>
            <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4 mb-6">
                <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-md shadow-pink-500/20">
                    <Music className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-light-text dark:text-dark-text">Track Identity</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Basic track information.</p>
                </div>
            </div>

            <div className="space-y-4">
                {/* Title */}
                <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-slate-400 shrink-0" />
                    <div className="flex-grow">
                        <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Track Title</label>
                        <EditableInput isEditing={isEditing} value={metadata.title} onChange={v => onFieldUpdate('title', v)} placeholder="Enter track title" className="text-xl font-bold" />
                    </div>
                </div>

                {/* Artist */}
                <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-slate-400 shrink-0" />
                    <div className="flex-grow">
                        <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Artist</label>
                        <EditableInput isEditing={isEditing} value={metadata.artist} onChange={v => onFieldUpdate('artist', v)} placeholder="Artist name" className="font-medium" />
                    </div>
                </div>

                {/* Album Artist */}
                <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-slate-400 shrink-0" />
                    <div className="flex-grow">
                        <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Album Artist</label>
                        <EditableInput isEditing={isEditing} value={metadata.albumArtist} onChange={v => onFieldUpdate('albumArtist', v)} placeholder="Album artist" className="font-medium" />
                    </div>
                </div>

                {/* Album & Year */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                        <Music className="w-5 h-5 text-slate-400 shrink-0" />
                        <div className="flex-grow">
                            <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Album</label>
                            <EditableInput isEditing={isEditing} value={metadata.album} onChange={v => onFieldUpdate('album', v)} placeholder="Album/Single name" />
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Calendar className="w-5 h-5 text-slate-400 shrink-0" />
                        <div className="flex-grow">
                            <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Year</label>
                            <EditableInput isEditing={isEditing} value={metadata.year} onChange={v => onFieldUpdate('year', v)} placeholder="YYYY" />
                        </div>
                    </div>
                </div>

                {/* Track & Duration */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-slate-400 shrink-0" />
                        <div className="flex-grow">
                            <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Track</label>
                            <EditableInput isEditing={isEditing} value={metadata.track} onChange={v => onFieldUpdate('track', parseInt(v, 10))} placeholder="1" type="number" />
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Clock className="w-5 h-5 text-slate-400 shrink-0" />
                        <div className="flex-grow">
                            <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">Duration</label>
                            <div className="text-slate-800 dark:text-slate-200 font-mono text-lg">
                                {formatDuration(metadata.duration)}
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </Card>
    );
};

export default TrackIdentityCard;
