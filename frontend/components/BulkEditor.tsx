
import React, { useState, useEffect } from 'react';
import { BatchItem, Metadata } from '../types';
import { X, Save, CheckCircle2, ArrowLeft, Layers, Hash, User, Calendar, Music, AlertCircle, ChevronDown, ChevronUp, Briefcase } from './icons';
import Button from './Button';
import Tooltip from './Tooltip';

interface BulkEditorProps {
    items: BatchItem[];
    onUpdateBatch: (updates: { id: string, metadata: Metadata }[]) => void;
    onClose: () => void;
}

const ITEMS_PER_PAGE = 10;

const BulkEditor: React.FC<BulkEditorProps> = ({ items, onUpdateBatch, onClose }) => {
    // Deep copy initial state to track changes
    const [initialItems] = useState<BatchItem[]>(JSON.parse(JSON.stringify(items.filter(i => i.status === 'completed'))));
    const [localItems, setLocalItems] = useState<BatchItem[]>(JSON.parse(JSON.stringify(items.filter(i => i.status === 'completed'))));
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const totalPages = Math.ceil(localItems.length / ITEMS_PER_PAGE);

    // Helper to check if a specific field was modified
    const isModified = (id: string, field: keyof Metadata) => {
        const original = initialItems.find(i => i.id === id)?.metadata;
        const current = localItems.find(i => i.id === id)?.metadata;
        if (!original || !current) return false;
        return original[field] !== current[field];
    };

    const countTotalChanges = () => {
        let count = 0;
        localItems.forEach(item => {
            const original = initialItems.find(i => i.id === item.id);
            if (original && JSON.stringify(original.metadata) !== JSON.stringify(item.metadata)) {
                count++;
            }
        });
        return count;
    };

    const handleCellChange = (id: string, field: keyof Metadata, value: any) => {
        setLocalItems(prev => prev.map(item => {
            if (item.id === id && item.metadata) {
                return { ...item, metadata: { ...item.metadata, [field]: value } };
            }
            return item;
        }));
    };

    // Safe Numeric Change Handler
    const handleNumberChange = (id: string, field: keyof Metadata, rawValue: string) => {
        // Allow empty string to clear field
        if (rawValue === '') {
            handleCellChange(id, field, 0); // Or use undefined if your type supports it, but 0 is safer for <input type=number>
            return;
        }

        const val = parseInt(rawValue);
        if (!isNaN(val)) {
            handleCellChange(id, field, val);
        }
        // If NaN, simply don't update state, effectively rejecting the input character
    };

    const handleApplyColumn = (field: keyof Metadata) => {
        if (localItems.length === 0) return;
        const firstValue = localItems[0].metadata?.[field];
        if (firstValue === undefined) return;

        if (confirm(`Apply "${firstValue}" to all ${localItems.length} tracks for ${String(field)}?`)) {
            setLocalItems(prev => prev.map(item => ({
                ...item,
                metadata: item.metadata ? { ...item.metadata, [field]: firstValue } : undefined
            })));
        }
    };

    const handleSave = () => {
        const updates = localItems.map(i => ({ id: i.id, metadata: i.metadata! }));
        onUpdateBatch(updates);
        onClose();
    };

    const toggleSelectAll = () => {
        if (selectedRows.size === localItems.length) {
            setSelectedRows(new Set());
        } else {
            setSelectedRows(new Set(localItems.map(i => i.id)));
        }
    };

    const toggleRow = (id: string) => {
        const newSet = new Set(selectedRows);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedRows(newSet);
    };

    const handleGuessFromFilename = () => {
        if (selectedRows.size === 0) {
            alert("Please select tracks first.");
            return;
        }

        setLocalItems(prev => prev.map(item => {
            if (selectedRows.has(item.id)) {
                // Remove extension
                const nameWithoutExt = item.file.name.replace(/\.[^/.]+$/, "");
                // Try "Artist - Title" or similar
                const parts = nameWithoutExt.split(' - ');
                if (parts.length >= 2) {
                    const artist = parts[0].trim();
                    const title = parts.slice(1).join(' - ').trim();
                    return { ...item, metadata: { ...item.metadata!, artist, title } };
                } else {
                    // Just set title if no separator
                    return { ...item, metadata: { ...item.metadata!, title: nameWithoutExt } };
                }
            }
            return item;
        }));
    };

    const totalChanges = countTotalChanges();

    // Pagination Logic
    const paginatedItems = localItems.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    return (
        <div className="fixed inset-0 bg-white dark:bg-dark-bg z-50 flex flex-col animate-slide-up">
            {/* Toolbar */}
            <div className="border-b border-slate-200 dark:border-slate-800 p-4 flex justify-between items-center bg-white dark:bg-dark-card shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <ArrowLeft className="w-5 h-5 text-slate-500" />
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            Batch Editor
                            {totalChanges > 0 && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">Unsaved Changes</span>}
                        </h2>
                        <p className="text-xs text-slate-500">{localItems.length} tracks loaded</p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <Button onClick={handleGuessFromFilename} variant="secondary" size="sm" disabled={selectedRows.size === 0}>
                        <Music className="w-4 h-4" /> Guess from Filename
                    </Button>
                    <Button onClick={onClose} variant="secondary" size="sm">Discard</Button>
                    <Button onClick={handleSave} variant="primary" size="sm" disabled={totalChanges === 0}>
                        <Save className="w-4 h-4" /> Save {totalChanges > 0 ? `(${totalChanges})` : ''}
                    </Button>
                </div>
            </div>

            {/* Table Container */}
            <div className="flex-grow overflow-auto p-4 bg-slate-50 dark:bg-dark-bg">
                <div className="bg-white dark:bg-dark-card rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden min-w-[1200px]">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 uppercase font-bold text-[10px] sticky top-0 z-10 shadow-sm whitespace-nowrap">
                            <tr>
                                <th className="p-3 w-10 border-b dark:border-slate-800 sticky left-0 bg-slate-50 dark:bg-slate-900 z-20">
                                    <input type="checkbox" checked={selectedRows.size === localItems.length && localItems.length > 0} onChange={toggleSelectAll} className="rounded border-slate-300 cursor-pointer" />
                                </th>
                                <th className="p-3 w-40 border-b dark:border-slate-800 sticky left-10 bg-slate-50 dark:bg-slate-900 z-20 border-r">Filename</th>
                                <th className="p-3 min-w-[200px] border-b dark:border-slate-800">
                                    <div className="flex items-center gap-2"><Music className="w-3 h-3" /> Title</div>
                                </th>
                                <th className="p-3 min-w-[150px] group cursor-pointer border-b dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleApplyColumn('artist')}>
                                    <div className="flex items-center gap-2"><User className="w-3 h-3" /> Artist <Layers className="w-3 h-3 opacity-0 group-hover:opacity-50" /></div>
                                </th>
                                <th className="p-3 min-w-[150px] group cursor-pointer border-b dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleApplyColumn('albumArtist')}>
                                    <div className="flex items-center gap-2"><User className="w-3 h-3" /> Album Artist <Layers className="w-3 h-3 opacity-0 group-hover:opacity-50" /></div>
                                </th>
                                <th className="p-3 min-w-[150px] group cursor-pointer border-b dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" onClick={() => handleApplyColumn('album')}>
                                    <div className="flex items-center gap-2"><Layers className="w-3 h-3" /> Album <Layers className="w-3 h-3 opacity-0 group-hover:opacity-50" /></div>
                                </th>
                                <th className="p-3 w-20 border-b dark:border-slate-800 group cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleApplyColumn('track')}>Track</th>
                                <th className="p-3 w-20 border-b dark:border-slate-800 group cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleApplyColumn('year')}>Year</th>
                                <th className="p-3 w-24 border-b dark:border-slate-800">BPM</th>
                                <th className="p-3 w-24 border-b dark:border-slate-800">Key</th>
                                <th className="p-3 min-w-[150px] border-b dark:border-slate-800 group cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleApplyColumn('mainGenre')}>Genre</th>
                                <th className="p-3 min-w-[150px] border-b dark:border-slate-800 group cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleApplyColumn('additionalGenres')}>Sub-Genres</th>
                                <th className="p-3 min-w-[150px] border-b dark:border-slate-800 group cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 text-purple-500" onClick={() => handleApplyColumn('moods')}>Moods</th>
                                <th className="p-3 min-w-[150px] border-b dark:border-slate-800 group cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleApplyColumn('instrumentation')}>Instruments</th>
                                <th className="p-3 min-w-[150px] border-b dark:border-slate-800 group cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleApplyColumn('keywords')}>Keywords</th>
                                <th className="p-3 min-w-[200px] border-b dark:border-slate-800 group cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleApplyColumn('trackDescription')}>Description</th>
                                <th className="p-3 min-w-[150px] border-b dark:border-slate-800 group cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleApplyColumn('useCases')}>Use Cases</th>
                                <th className="p-3 min-w-[150px] border-b dark:border-slate-800 group cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleApplyColumn('mainInstrument')}>Main Instr.</th>
                                <th className="p-3 min-w-[150px] border-b dark:border-slate-800 group cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleApplyColumn('publisher')}>Label</th>
                                <th className="p-3 min-w-[150px] border-b dark:border-slate-800 group cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleApplyColumn('copyright')}>Copyright (©)</th>
                                <th className="p-3 min-w-[150px] border-b dark:border-slate-800 group cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleApplyColumn('pLine')}>Producer Line (℗)</th>
                                <th className="p-3 min-w-[150px] border-b dark:border-slate-800 group cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleApplyColumn('composer')}>Composer</th>
                                <th className="p-3 min-w-[150px] border-b dark:border-slate-800 group cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleApplyColumn('lyricist')}>Lyricist</th>
                                <th className="p-3 min-w-[150px] border-b dark:border-slate-800 group cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleApplyColumn('producer')}>Producer</th>
                                <th className="p-3 min-w-[150px] border-b dark:border-slate-800 group cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleApplyColumn('isrc')}>ISRC</th>
                                <th className="p-3 min-w-[150px] border-b dark:border-slate-800 group cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleApplyColumn('iswc')}>License</th>
                                <th className="p-3 min-w-[150px] border-b dark:border-slate-800 group cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleApplyColumn('catalogNumber')}>Cat#</th>
                                <th className="p-3 min-w-[150px] border-b dark:border-slate-800 group cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleApplyColumn('upc')}>Other</th>
                                <th className="p-3 min-w-[100px] border-b dark:border-slate-800 group cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => handleApplyColumn('language')}>Language</th>
                                <th className="p-3 min-w-[100px] border-b dark:border-slate-800">Vocal Gender</th>
                                <th className="p-3 min-w-[100px] border-b dark:border-slate-800">Vocal Timbre</th>
                                <th className="p-3 min-w-[100px] border-b dark:border-slate-800">Vocal Delivery</th>
                                <th className="p-3 min-w-[100px] border-b dark:border-slate-800">Vocal Tone</th>
                            </tr>
                        </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {paginatedItems.map((item, index) => (
                            <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group text-xs border-b dark:border-slate-800">
                                <td className="p-3 sticky left-0 bg-white dark:bg-dark-card z-10">
                                    <input type="checkbox" checked={selectedRows.has(item.id)} onChange={() => toggleRow(item.id)} className="rounded border-slate-300 cursor-pointer" />
                                </td>
                                <td className="p-3 text-slate-500 truncate max-w-[10rem] font-mono text-[10px] sticky left-10 bg-white dark:bg-dark-card z-10 border-r" title={item.file.name}>
                                    {item.file.name}
                                </td>
                                <td className="p-2">
                                    <input type="text" value={item.metadata?.title || ''} onChange={(e) => handleCellChange(item.id, 'title', e.target.value)}
                                        className={`w-full bg-transparent border border-transparent rounded px-2 py-1 outline-none transition-all font-medium ${isModified(item.id, 'title') ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20' : 'hover:border-slate-300 focus:bg-white dark:focus:bg-slate-900'}`} />
                                </td>
                                <td className="p-2">
                                    <input type="text" value={item.metadata?.artist || ''} onChange={(e) => handleCellChange(item.id, 'artist', e.target.value)}
                                        className={`w-full bg-transparent border border-transparent rounded px-2 py-1 outline-none transition-all ${isModified(item.id, 'artist') ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20' : 'hover:border-slate-300 focus:bg-white dark:focus:bg-slate-900'}`} />
                                </td>
                                <td className="p-2">
                                    <input type="text" value={item.metadata?.albumArtist || ''} onChange={(e) => handleCellChange(item.id, 'albumArtist', e.target.value)}
                                        className={`w-full bg-transparent border border-transparent rounded px-2 py-1 outline-none transition-all ${isModified(item.id, 'albumArtist') ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20' : 'hover:border-slate-300 focus:bg-white dark:focus:bg-slate-900'}`} />
                                </td>
                                <td className="p-2">
                                    <input type="text" value={item.metadata?.album || ''} onChange={(e) => handleCellChange(item.id, 'album', e.target.value)}
                                        className={`w-full bg-transparent border border-transparent rounded px-2 py-1 outline-none transition-all ${isModified(item.id, 'album') ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20' : 'hover:border-slate-300 focus:bg-white dark:focus:bg-slate-900'}`} />
                                </td>
                                <td className="p-2 text-center">
                                    <input type="number" value={item.metadata?.track || ''} onChange={(e) => handleNumberChange(item.id, 'track', e.target.value)}
                                        className={`w-12 bg-transparent border-b border-transparent focus:border-accent-violet outline-none text-center ${isModified(item.id, 'track') ? 'border-amber-400' : ''}`} />
                                </td>
                                <td className="p-2 text-center">
                                    <input type="text" value={item.metadata?.year || ''} onChange={(e) => handleCellChange(item.id, 'year', e.target.value)}
                                        className={`w-16 bg-transparent border-b border-transparent focus:border-accent-violet outline-none text-center ${isModified(item.id, 'year') ? 'border-amber-400' : ''}`} />
                                </td>
                                <td className="p-2">
                                    <input type="number" value={item.metadata?.bpm || ''} onChange={(e) => handleNumberChange(item.id, 'bpm', e.target.value)}
                                        className={`w-full bg-transparent border-transparent text-right font-mono text-[10px] ${isModified(item.id, 'bpm') ? 'text-amber-600 font-bold' : ''}`} />
                                </td>
                                <td className="p-2">
                                    <div className="flex gap-1 text-[10px]">
                                        <input type="text" value={item.metadata?.key || ''} onChange={(e) => handleCellChange(item.id, 'key', e.target.value)}
                                            className={`w-8 bg-transparent border-b border-transparent focus:border-accent-violet outline-none text-center ${isModified(item.id, 'key') ? 'border-amber-400' : ''}`} />
                                        <select value={item.metadata?.mode || ''} onChange={(e) => handleCellChange(item.id, 'mode', e.target.value)} className="bg-transparent outline-none">
                                            <option value="Major">Maj</option>
                                            <option value="Minor">Min</option>
                                        </select>
                                    </div>
                                </td>
                                <td className="p-2">
                                    <input type="text" value={item.metadata?.mainGenre || ''} onChange={(e) => handleCellChange(item.id, 'mainGenre', e.target.value)}
                                        className={`w-full bg-transparent border border-transparent rounded px-2 py-1 outline-none transition-all ${isModified(item.id, 'mainGenre') ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20' : 'hover:border-slate-300 focus:bg-white dark:focus:bg-slate-900'}`} />
                                </td>
                                <td className="p-2">
                                    <input type="text" value={(item.metadata?.additionalGenres || []).join(', ')} onChange={(e) => handleCellChange(item.id, 'additionalGenres', e.target.value.split(',').map(s => s.trim()))}
                                        className="w-full bg-transparent border-b border-transparent focus:border-accent-violet outline-none" placeholder="Deep, Melodic" />
                                </td>
                                <td className="p-2">
                                    <input type="text" value={(item.metadata?.moods || []).join(', ')} onChange={(e) => handleCellChange(item.id, 'moods', e.target.value.split(',').map(s => s.trim()))}
                                        className="w-full bg-transparent border-b border-transparent focus:border-accent-violet outline-none" placeholder="Dark, Uplifting" />
                                </td>
                                <td className="p-2">
                                    <input type="text" value={(item.metadata?.instrumentation || []).join(', ')} onChange={(e) => handleCellChange(item.id, 'instrumentation', e.target.value.split(',').map(s => s.trim()))}
                                        className="w-full bg-transparent border-b border-transparent focus:border-accent-violet outline-none" placeholder="Synth, Bass" />
                                </td>
                                <td className="p-2">
                                    <input type="text" value={(item.metadata?.keywords || []).join(', ')} onChange={(e) => handleCellChange(item.id, 'keywords', e.target.value.split(',').map(s => s.trim()))}
                                        className="w-full bg-transparent border-b border-transparent focus:border-accent-violet outline-none" />
                                </td>
                                <td className="p-2">
                                    <input type="text" value={item.metadata?.trackDescription || ''} onChange={(e) => handleCellChange(item.id, 'trackDescription', e.target.value)}
                                        className="w-full bg-transparent border-b border-transparent focus:border-accent-violet outline-none" />
                                </td>
                                <td className="p-2">
                                    <input type="text" value={(item.metadata?.useCases || []).join(', ')} onChange={(e) => handleCellChange(item.id, 'useCases', e.target.value.split(',').map(s => s.trim()))}
                                        className="w-full bg-transparent border-b border-transparent focus:border-accent-violet outline-none" />
                                </td>
                                <td className="p-2">
                                    <input type="text" value={item.metadata?.mainInstrument || ''} onChange={(e) => handleCellChange(item.id, 'mainInstrument', e.target.value)}
                                        className="w-full bg-transparent border-b border-transparent focus:border-accent-violet outline-none" />
                                </td>
                                <td className="p-2">
                                    <input type="text" value={item.metadata?.publisher || ''} onChange={(e) => handleCellChange(item.id, 'publisher', e.target.value)}
                                        className="w-full bg-transparent border-b border-transparent focus:border-accent-violet outline-none" />
                                </td>
                                <td className="p-2">
                                    <input type="text" value={item.metadata?.copyright || ''} onChange={(e) => handleCellChange(item.id, 'copyright', e.target.value)}
                                        className="w-full bg-transparent border-b border-transparent focus:border-accent-violet outline-none" />
                                </td>
                                <td className="p-2">
                                    <input type="text" value={item.metadata?.pLine || ''} onChange={(e) => handleCellChange(item.id, 'pLine', e.target.value)}
                                        className="w-full bg-transparent border-b border-transparent focus:border-accent-violet outline-none" />
                                </td>
                                <td className="p-2">
                                    <input type="text" value={item.metadata?.composer || ''} onChange={(e) => handleCellChange(item.id, 'composer', e.target.value)}
                                        className="w-full bg-transparent border-b border-transparent focus:border-accent-violet outline-none" />
                                </td>
                                <td className="p-2">
                                    <input type="text" value={item.metadata?.lyricist || ''} onChange={(e) => handleCellChange(item.id, 'lyricist', e.target.value)}
                                        className="w-full bg-transparent border-b border-transparent focus:border-accent-violet outline-none" />
                                </td>
                                <td className="p-2">
                                    <input type="text" value={item.metadata?.producer || ''} onChange={(e) => handleCellChange(item.id, 'producer', e.target.value)}
                                        className="w-full bg-transparent border-b border-transparent focus:border-accent-violet outline-none" />
                                </td>
                                <td className="p-2">
                                    <input type="text" value={item.metadata?.isrc || ''} onChange={(e) => handleCellChange(item.id, 'isrc', e.target.value)}
                                        className="w-full bg-transparent border-b border-transparent focus:border-accent-violet outline-none font-mono text-[10px]" />
                                </td>
                                <td className="p-2">
                                    <input type="text" value={item.metadata?.iswc || ''} onChange={(e) => handleCellChange(item.id, 'iswc', e.target.value)}
                                        className="w-full bg-transparent border-b border-transparent focus:border-accent-violet outline-none font-mono text-[10px]" />
                                </td>
                                <td className="p-2">
                                    <input type="text" value={item.metadata?.catalogNumber || ''} onChange={(e) => handleCellChange(item.id, 'catalogNumber', e.target.value)}
                                        className="w-full bg-transparent border-b border-transparent focus:border-accent-violet outline-none font-mono text-[10px]" />
                                </td>
                                <td className="p-2">
                                    <input type="text" value={item.metadata?.upc || ''} onChange={(e) => handleCellChange(item.id, 'upc', e.target.value)}
                                        className="w-full bg-transparent border-b border-transparent focus:border-accent-violet outline-none font-mono text-[10px]" />
                                </td>
                                <td className="p-2">
                                    <input type="text" value={item.metadata?.language || ''} onChange={(e) => handleCellChange(item.id, 'language', e.target.value)}
                                        className="w-full bg-transparent border-b border-transparent focus:border-accent-violet outline-none" />
                                </td>
                                <td className="p-2">
                                    <input type="text" value={item.metadata?.vocalStyle?.gender || ''} onChange={(e) => handleCellChange(item.id, 'vocalStyle', { ...item.metadata?.vocalStyle, gender: e.target.value })}
                                        className="w-full bg-transparent border-b border-transparent focus:border-accent-violet outline-none" />
                                </td>
                                <td className="p-2">
                                    <input type="text" value={item.metadata?.vocalStyle?.timbre || ''} onChange={(e) => handleCellChange(item.id, 'vocalStyle', { ...item.metadata?.vocalStyle, timbre: e.target.value })}
                                        className="w-full bg-transparent border-b border-transparent focus:border-accent-violet outline-none" />
                                </td>
                                <td className="p-2">
                                    <input type="text" value={item.metadata?.vocalStyle?.delivery || ''} onChange={(e) => handleCellChange(item.id, 'vocalStyle', { ...item.metadata?.vocalStyle, delivery: e.target.value })}
                                        className="w-full bg-transparent border-b border-transparent focus:border-accent-violet outline-none" />
                                </td>
                                <td className="p-2">
                                    <input type="text" value={item.metadata?.vocalStyle?.emotionalTone || ''} onChange={(e) => handleCellChange(item.id, 'vocalStyle', { ...item.metadata?.vocalStyle, emotionalTone: e.target.value })}
                                        className="w-full bg-transparent border-b border-transparent focus:border-accent-violet outline-none" />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

        {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex justify-between items-center mt-4 px-4">
                    <div className="text-xs text-slate-500">
                        Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, localItems.length)} of {localItems.length} entries
                    </div>
                    <div className="flex gap-2">
                        <Button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            size="sm"
                            variant="secondary"
                        >
                            Previous
                        </Button>
                        <span className="flex items-center px-3 text-sm font-bold text-slate-600 dark:text-slate-300">
                            Page {currentPage} of {totalPages}
                        </span>
                        <Button
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            size="sm"
                            variant="secondary"
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}

            <div className="mt-4 flex justify-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-full text-xs text-slate-500">
                    <AlertCircle className="w-3 h-3" />
                    <span>Cells highlight in <span className="text-amber-600 font-bold">amber</span> when modified.</span>
                    <span className="ml-2 font-mono">Tip: Click column headers to apply first value to all.</span>
                </div>
            </div>
        </div>
    );
};

export default BulkEditor;
