
import React from 'react';
import { AnalysisRecord } from '../types';
import { Music, Lightbulb, Search, ChevronDown, ChevronUp, X } from './icons';

interface HistoryPanelProps {
  history: AnalysisRecord[];
  onSelectItem: (record: AnalysisRecord) => void;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ history, onSelectItem }) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedGenre, setSelectedGenre] = React.useState<string>('All');
  const [bpmRange, setBpmRange] = React.useState<[number, number]>([0, 300]);
  const [sortBy, setSortBy] = React.useState<'recent' | 'alphabetical'>('recent');
  const [isFilterExpanded, setIsFilterExpanded] = React.useState(false);

  const genres = ['All', ...Array.from(new Set(history.map(r => r.metadata.mainGenre).filter(Boolean)))];

  const filteredHistory = history.filter(record => {
    const title = (record.inputType === 'idea' ? record.input.description : record.input.fileName || record.input.link || '').toLowerCase();
    const artist = (record.metadata.artist || '').toLowerCase();
    const album = (record.metadata.album || '').toLowerCase();
    const query = searchQuery.toLowerCase();

    const matchesSearch = title.includes(query) || artist.includes(query) || album.includes(query);
    const matchesGenre = selectedGenre === 'All' || record.metadata.mainGenre === selectedGenre;
    const recordBpm = Number(record.metadata.bpm) || 0;
    const matchesBpm = recordBpm >= bpmRange[0] && recordBpm <= bpmRange[1];

    return matchesSearch && matchesGenre && matchesBpm;
  }).sort((a, b) => {
    if (sortBy === 'recent') return 0; // History is usually passed pre-sorted by date
    const titleA = (a.inputType === 'idea' ? a.input.description : a.input.fileName || '').toLowerCase();
    const titleB = (b.inputType === 'idea' ? b.input.description : b.input.fileName || '').toLowerCase();
    return titleA.localeCompare(titleB);
  });

  const getTitle = (record: AnalysisRecord) => {
    if (record.inputType === 'idea') {
      return record.input.description || 'Generated Idea';
    }
    return record.input.fileName || record.input.link || 'File Analysis';
  };

  return (
    <div className="bg-light-card dark:bg-dark-card rounded-2xl shadow-lg p-6 border border-slate-200 dark:border-slate-800 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-light-text dark:text-dark-text">Repository History</h3>
        <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full text-slate-500">
          {filteredHistory.length} items
        </span>
      </div>

      <div className="flex items-center gap-2 mb-4 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setSortBy('recent')}
          className={`flex-1 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${sortBy === 'recent' ? 'bg-white dark:bg-slate-800 shadow-sm text-accent-violet' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Recent
        </button>
        <button
          onClick={() => setSortBy('alphabetical')}
          className={`flex-1 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${sortBy === 'alphabetical' ? 'bg-white dark:bg-slate-800 shadow-sm text-accent-violet' : 'text-slate-400 hover:text-slate-600'}`}
        >
          A-Z
        </button>
      </div>

      <div className="space-y-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by filename or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-accent-violet outline-none transition-all"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <button
          onClick={() => setIsFilterExpanded(!isFilterExpanded)}
          className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 uppercase tracking-wider"
        >
          {isFilterExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Advanced Filters
        </button>

        {isFilterExpanded && (
          <div className="p-4 bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4 animate-slide-down">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Genre Filter</label>
              <select
                value={selectedGenre}
                onChange={(e) => setSelectedGenre(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs outline-none"
              >
                {genres.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">
                BPM Range: {bpmRange[0]} - {bpmRange[1]}
              </label>
              <div className="flex gap-4">
                <input
                  type="range"
                  min="0" max="250"
                  value={bpmRange[1]}
                  onChange={(e) => setBpmRange([bpmRange[0], Number(e.target.value)])}
                  className="w-full accent-accent-violet"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {filteredHistory.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-50">
          <Music className="w-12 h-12 mb-4 text-slate-300" />
          <p className="text-slate-500 italic text-sm">No results match your criteria.</p>
          <button onClick={() => { setSearchQuery(''); setSelectedGenre('All'); setBpmRange([0, 300]); }} className="text-accent-violet text-xs mt-2 underline">
            Reset all filters
          </button>
        </div>
      ) : (
        <div className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar">
          {filteredHistory.map(record => (
            <button
              key={record.id}
              onClick={() => onSelectItem(record)}
              className="w-full text-left bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl p-4 transition-all hover:bg-slate-50 dark:hover:bg-slate-750 hover:border-accent-violet/30 hover:shadow-lg group shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-900 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  {record.inputType === 'idea'
                    ? <Lightbulb className="w-5 h-5 text-amber-500" />
                    : <Music className="w-5 h-5 text-accent-blue" />}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate text-light-text dark:text-dark-text leading-tight mb-1" title={getTitle(record)}>
                    {getTitle(record)}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-900 rounded text-slate-500 font-medium">
                      {record.metadata.mainGenre}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {record.metadata.bpm} BPM • {record.metadata.key} {record.metadata.mode}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default HistoryPanel;
