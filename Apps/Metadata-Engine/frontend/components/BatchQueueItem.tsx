
import React from 'react';
import { BatchItem } from '../types';
import { Music, CheckCircle2, XCircle, Clock, RefreshCw, X, BarChart, GripVertical } from './icons';
import Button from './Button';

interface BatchQueueItemProps {
    item: BatchItem;
    onRemove: (id: string) => void;
    onRetry: (id: string) => void;
    onViewResults: (id: string) => void;
    isProcessingBatch: boolean;
    onDragStart: (e: React.DragEvent, id: string) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent, id: string) => void;
}

const StatusIndicator: React.FC<{ status: BatchItem['status'], message?: string }> = ({ status, message }) => {
    switch (status) {
        case 'pending':
            return <div className="flex items-center gap-1.5 text-xs text-slate-500"><Clock className="w-3.5 h-3.5" /> Pending</div>;
        case 'processing':
            return (
                <div className="flex items-center gap-1.5 text-xs text-blue-500">
                    <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    {message || "Analyzing"}
                </div>
            );
        case 'completed':
            return <div className="flex items-center gap-1.5 text-xs text-green-500"><CheckCircle2 className="w-3.5 h-3.5" /> Completed</div>;
        case 'error':
            return <div className="flex items-center gap-1.5 text-xs text-red-500"><XCircle className="w-3.5 h-3.5" /> Error</div>;
        default:
            return null;
    }
};

const BatchQueueItem: React.FC<BatchQueueItemProps> = ({ item, onRemove, onRetry, onViewResults, isProcessingBatch, onDragStart, onDragOver, onDrop }) => {
    return (
        <div
            className="bg-slate-100 dark:bg-slate-800/50 p-3 rounded-lg flex items-center gap-4 transition-all hover:scale-[1.01] hover:shadow-md cursor-grab active:cursor-grabbing border-2 border-transparent"
            draggable={!isProcessingBatch}
            onDragStart={(e) => onDragStart(e, item.id)}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, item.id)}
        >
            <GripVertical className="w-5 h-5 text-slate-400 cursor-grab flex-shrink-0" />
            <Music className="w-6 h-6 text-slate-500 flex-shrink-0" />
            <div className="flex-grow min-w-0 pointer-events-none">
                <p className="font-semibold text-sm truncate text-light-text dark:text-dark-text" title={item.file.name}>{item.file.name}</p>
                <StatusIndicator status={item.status} message={item.message} />
                {item.status === 'error' && item.error && (
                    <p className="text-xs text-red-400 truncate mt-0.5" title={item.error}>
                        {item.error}
                    </p>
                )}
            </div>
            <div className="flex-shrink-0 flex items-center gap-2">
                {item.status === 'completed' && (
                    <Button onClick={() => onViewResults(item.id)} variant="primary" size="sm">
                        <BarChart className="w-4 h-4" /> View
                    </Button>
                )}
                {item.status === 'error' && (
                    <Button onClick={() => onRetry(item.id)} variant="secondary" size="sm" disabled={isProcessingBatch}>
                        <RefreshCw className="w-4 h-4" /> Retry
                    </Button>
                )}
                <button
                    onClick={() => onRemove(item.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-full disabled:opacity-50"
                    disabled={isProcessingBatch}
                    aria-label="Remove from queue"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default BatchQueueItem;
