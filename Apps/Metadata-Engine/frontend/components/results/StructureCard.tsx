
import React from 'react';
import { Metadata, StructureSegment } from '../../types';
import Card from './Card';
import { Layers, Clock } from '../icons';

interface StructureCardProps {
    metadata: Metadata;
}

const StructureCard: React.FC<StructureCardProps> = ({ metadata }) => {
    const structure = metadata.structure || [];

    if (structure.length === 0) return null;

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <Card>
            <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4 mb-6">
                <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-md shadow-blue-500/20">
                    <Layers className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-light-text dark:text-dark-text">Track Structure</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">AI-detected song segments and energy flow.</p>
                </div>
            </div>

            <div className="space-y-4">
                <div className="relative h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                    {structure.map((seg, idx) => {
                        const duration = seg.endTime - seg.startTime;
                        const totalDuration = metadata.duration || structure[structure.length - 1].endTime;
                        const width = (duration / totalDuration) * 100;

                        // Color coding based on segment label
                        let bgColor = 'bg-blue-400';
                        const sectionName = (seg.section || seg.label || '').toLowerCase();
                        if (sectionName.includes('intro')) bgColor = 'bg-slate-400';
                        if (sectionName.includes('core') || sectionName.includes('chorus')) bgColor = 'bg-indigo-500';
                        if (sectionName.includes('outro')) bgColor = 'bg-slate-600';

                        return (
                            <div
                                key={idx}
                                className={`${bgColor} h-full border-r border-white/20 last:border-0`}
                                style={{ width: `${width}%` }}
                                title={`${seg.section || seg.label}: ${formatTime(seg.startTime)} - ${formatTime(seg.endTime)}`}
                            />
                        );
                    })}
                </div>

                <div className="grid gap-3 mt-4">
                    {structure.map((seg, idx) => {
                        const sectionName = (seg.section || seg.label || 'Unknown');
                        const isIntro = sectionName.toLowerCase().includes('intro');
                        const isCore = sectionName.toLowerCase().includes('core') || sectionName.toLowerCase().includes('chorus');

                        return (
                            <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800 transition-hover hover:border-blue-400/50">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${isIntro ? 'bg-slate-400' : isCore ? 'bg-indigo-500' : 'bg-blue-400'}`} />
                                    <div>
                                        <span className="font-bold text-slate-700 dark:text-slate-300">{sectionName}</span>
                                        <p className="text-xs text-slate-500">{seg.description || 'Energy-based detection'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>{formatTime(seg.startTime)} - {formatTime(seg.endTime)}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </Card>
    );
};

export default StructureCard;
