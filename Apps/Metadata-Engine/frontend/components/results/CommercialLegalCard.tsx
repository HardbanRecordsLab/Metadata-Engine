import React, { useState, useEffect } from 'react';
import { Metadata } from '../../types';
import Card from './Card';
import { CopyrightIcon, Sparkles, Settings, RefreshCw, Zap, Save, Check, Globe, FileText, AlertCircle, Info, Briefcase, User, Hash, Code, Calendar, Music } from '../icons';
import Tooltip from '../Tooltip';
import { generateNextCatalogNumber, generateNextISRC, getCodeConfig, saveCodeConfig, CodeConfig, resetSequences } from '../../services/codeGeneratorService';
import Button from '../Button';
import { exportDDEX, exportCWR } from '../../services/distributionService';

interface CommercialLegalCardProps {
    metadata: Metadata;
    isEditing: boolean;
    onFieldUpdate: (field: keyof Metadata, value: any) => void;
    refiningField: keyof Metadata | null;
    onRefine: (field: keyof Metadata) => void;
    showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

// --- CONSTANTS & TYPES ---
const TEMPLATE_KEY = 'mme_global_template_v3';

interface FullCreditsTemplate {
    publisher: string;
    copyright: string;
    pLine: string;
    composer: string;
    lyricist: string;
    producer: string;
    language: string;
    artist: string;
    album: string;
    year: string;
}

const CodeGeneratorSettings: React.FC<{ onClose: () => void; showToast: (msg: string, type?: 'success' | 'error' | 'info') => void }> = ({ onClose, showToast }) => {
    const [config, setConfig] = useState<CodeConfig>(() => getCodeConfig());

    const handleSave = () => {
        saveCodeConfig(config);
        onClose();
        showToast("Code generator settings saved!", 'success');
    };

    const handleReset = () => {
        if (confirm("Are you sure you want to reset sequence counters to 1?")) {
            resetSequences();
            setConfig(getCodeConfig());
            showToast("Sequences reset!", 'info');
        }
    };

    const currentYearShort = new Date().getFullYear().toString().slice(-2);
    const currentYearFull = new Date().getFullYear().toString();

    const safeIsrcPrefix = (config.isrcPrefix || 'PL-XXX').toUpperCase();
    const safeCatPrefix = (config.catPrefix || 'HRL').toUpperCase();

    const previewIsrc = `${safeIsrcPrefix}-${currentYearShort}-${(config.nextIsrcSeq || 1).toString().padStart(5, '0')}`;
    const previewCat = `${safeCatPrefix}-${config.catIncludeYear ? currentYearFull + '-' : ''}${(config.nextCatSeq || 1).toString().padStart(3, '0')}`;

    return (
        <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg mb-4 border border-slate-200 dark:border-slate-700 animate-fade-in shadow-inner">
            <div className="flex justify-between items-center mb-3">
                <h4 className="text-sm font-bold text-light-text dark:text-dark-text flex items-center gap-2">
                    <Settings className="w-4 h-4" /> Code Generator Settings
                </h4>
                <button onClick={handleReset} className="text-xs text-red-500 hover:underline flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" /> Reset counters
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                <div className="space-y-2">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">ISRC Prefix (Country-Registrant)</label>
                        <input
                            type="text"
                            value={config.isrcPrefix}
                            onChange={(e) => setConfig({ ...config, isrcPrefix: e.target.value })}
                            placeholder="e.g. PL-A12"
                            className="w-full p-2 text-sm rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-900 focus:ring-accent-violet focus:border-accent-violet uppercase"
                        />
                    </div>
                    <div className="p-2 bg-slate-200 dark:bg-slate-700/50 rounded flex justify-between items-center">
                        <span className="text-xs text-slate-500">Next ISRC:</span>
                        <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200">{previewIsrc}</span>
                    </div>
                </div>

                <div className="space-y-2">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Catalog Prefix</label>
                        <input
                            type="text"
                            value={config.catPrefix}
                            onChange={(e) => setConfig({ ...config, catPrefix: e.target.value })}
                            placeholder="e.g. HRL"
                            className="w-full p-2 text-sm rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-900 focus:ring-accent-violet focus:border-accent-violet uppercase"
                        />
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                        <input
                            type="checkbox"
                            id="catIncludeYear"
                            checked={config.catIncludeYear}
                            onChange={(e) => setConfig({ ...config, catIncludeYear: e.target.checked })}
                            className="rounded border-slate-300 text-accent-violet focus:ring-accent-violet cursor-pointer"
                        />
                        <label htmlFor="catIncludeYear" className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">Include year (e.g. -2025-)</label>
                    </div>
                    <div className="p-2 bg-slate-200 dark:bg-slate-700/50 rounded flex justify-between items-center">
                        <span className="text-xs text-slate-500">Next Cat#:</span>
                        <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200">{previewCat}</span>
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <Button onClick={onClose} variant="secondary" size="sm">Cancel</Button>
                <Button onClick={handleSave} variant="primary" size="sm">Save configuration</Button>
            </div>
        </div>
    );
};

const CreditField: React.FC<{
    label: string;
    value: string | undefined;
    field: keyof Metadata;
    isEditing: boolean;
    onChange: (value: string) => void;
    onRefine: (field: keyof Metadata) => void;
    refiningField: keyof Metadata | null;
    icon?: React.ReactNode;
    onGenerate?: () => void;
}> = ({ label, value, field, isEditing, onChange, onRefine, refiningField, icon, onGenerate }) => (
    <div className="p-3 bg-slate-50 dark:bg-slate-900/30 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-3 transition-colors group">
        <div className="flex-shrink-0 text-slate-400">
            {icon}
        </div>
        <div className="flex-grow">
            <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">{label}</label>
            <EditableInput
                type="text"
                value={value || ''}
                onChange={(e) => onChange(e)}
                className="w-full p-0 border-none shadow-none bg-transparent font-medium"
                placeholder={`Enter ${label.toLowerCase()}`}
                isEditing={isEditing}
            />
        </div>
        {isEditing && (
            <div className="flex items-center gap-1">
                {onGenerate && (
                    <Tooltip text="Generate code">
                        <button onClick={onGenerate} className="text-slate-400 hover:text-emerald-500 transition-colors">
                            <Zap className="w-4 h-4" />
                        </button>
                    </Tooltip>
                )}
                <Tooltip text="Enhance with AI">
                    <button onClick={() => onRefine(field)} disabled={!!refiningField} className="text-slate-400 hover:text-accent-violet transition-colors disabled:opacity-50">
                        {refiningField === field ? <div className="w-4 h-4 border-2 border-accent-violet border-t-transparent rounded-full animate-spin"></div> : <Sparkles className="w-4 h-4" />}
                    </button>
                </Tooltip>
            </div>
        )}
    </div>
);

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


const CommercialLegalCard: React.FC<CommercialLegalCardProps> = ({ metadata, isEditing, onFieldUpdate, refiningField, onRefine, showToast }) => {
    const [showSettings, setShowSettings] = useState(false);
    const [hasSavedTemplate, setHasSavedTemplate] = useState(false);

    useEffect(() => {
        const check = localStorage.getItem(TEMPLATE_KEY);
        setHasSavedTemplate(!!check);
    }, []);

    // --- POPRAWIONA LOGIKA SZABLONÓW ---

    const saveTemplate = () => {
        const template: FullCreditsTemplate = {
            publisher: metadata.publisher || '',
            copyright: metadata.copyright || '',
            pLine: metadata.pLine || '',
            composer: metadata.composer || '',
            lyricist: metadata.lyricist || '',
            producer: metadata.producer || '',
            language: metadata.language || '',
            artist: metadata.artist || '',
            album: metadata.album || '',
            year: metadata.year || ''
        };

        localStorage.setItem(TEMPLATE_KEY, JSON.stringify(template));
        setHasSavedTemplate(true);
        showToast("Template (Artist, Album, Year, Label, Credits) saved!", 'success');
    };

    const loadTemplate = () => {
        const saved = localStorage.getItem(TEMPLATE_KEY);
        if (!saved) {
            showToast("No saved template found.", 'error');
            return;
        }

        try {
            const template: FullCreditsTemplate = JSON.parse(saved);

            // Mapowanie pól - Muszą być dokładnie takie jak w Metadata
            const fieldsToUpdate: Array<{ key: keyof Metadata, value: any }> = [
                { key: 'publisher', value: template.publisher },
                { key: 'copyright', value: template.copyright },
                { key: 'pLine', value: template.pLine },
                { key: 'composer', value: template.composer },
                { key: 'lyricist', value: template.lyricist },
                { key: 'producer', value: template.producer },
                { key: 'language', value: template.language },
                { key: 'artist', value: template.artist },
                { key: 'album', value: template.album },
                { key: 'year', value: template.year }
            ];

            // Wykonujemy aktualizacje sekwencyjnie
            fieldsToUpdate.forEach(item => {
                if (item.value !== undefined && item.value !== null) {
                    onFieldUpdate(item.key, item.value);
                }
            });

            showToast(`Successfully loaded ${fieldsToUpdate.length} template fields!`, 'success');
        } catch (e) {
            console.error("Template Parse Error:", e);
            showToast("Error reading template.", 'error');
        }
    };

    const deleteTemplate = () => {
        if (confirm("Are you sure you want to delete the saved template?")) {
            localStorage.removeItem(TEMPLATE_KEY);
            setHasSavedTemplate(false);
            showToast("Template deleted.", 'info');
        }
    };

    const handleGenerateCode = (type: 'cat' | 'isrc') => {
        if (type === 'cat') {
            const code = generateNextCatalogNumber();
            onFieldUpdate('catalogNumber', code);
        } else {
            const code = generateNextISRC();
            onFieldUpdate('isrc', code);
        }
        showToast("Code generated!", 'success');
    };

    return (
        <Card>
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/20">
                        <CopyrightIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-light-text dark:text-dark-text">Commercial & Legal</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Copyrights and identification codes.</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {isEditing && (
                        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
                            <Tooltip text="Save current data as permanent template">
                                <button onClick={saveTemplate} className="p-1.5 rounded hover:bg-white dark:hover:bg-slate-700 text-slate-500 hover:text-emerald-500 transition-all">
                                    <Save className="w-5 h-5" />
                                </button>
                            </Tooltip>

                            <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1"></div>

                            <Tooltip text={hasSavedTemplate ? "Load saved template (10 fields)" : "No template"}>
                                <button
                                    onClick={loadTemplate}
                                    disabled={!hasSavedTemplate}
                                    className={`p-1.5 rounded transition-all ${hasSavedTemplate ? 'hover:bg-white dark:hover:bg-slate-700 text-slate-500 hover:text-accent-violet' : 'opacity-30 cursor-not-allowed'}`}
                                >
                                    <Check className="w-5 h-5" />
                                </button>
                            </Tooltip>

                            {hasSavedTemplate && (
                                <button onClick={deleteTemplate} className="p-1.5 text-[10px] text-red-500 hover:underline">Delete</button>
                            )}
                        </div>
                    )}
                    <button onClick={() => setShowSettings(!showSettings)} className={`p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${showSettings ? 'text-accent-violet bg-accent-violet/10' : 'text-slate-400'}`}>
                        <Settings className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {showSettings && <CodeGeneratorSettings onClose={() => setShowSettings(false)} showToast={showToast} />}

            {isEditing && (
                <div className="mb-4 flex items-center gap-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-lg">
                    <Info className="w-5 h-5 text-indigo-500 shrink-0" />
                    <div className="text-xs text-indigo-700 dark:text-indigo-300">
                        <strong>Template Mode:</strong> The load button (checkmark) will fill all fields below based on your saved template.
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <CreditField
                    label="Publisher / Label"
                    value={metadata.publisher}
                    field="publisher"
                    {...{ isEditing, onRefine, refiningField }}
                    onChange={v => onFieldUpdate('publisher', v)}
                    icon={<Briefcase className="w-5 h-5" />}
                />
                <CreditField
                    label="Copyright Line (©)"
                    value={metadata.copyright}
                    field="copyright"
                    {...{ isEditing, onRefine, refiningField }}
                    onChange={v => onFieldUpdate('copyright', v)}
                    icon={<CopyrightIcon className="w-5 h-5" />}
                />
                <CreditField
                    label="Production Line (℗)"
                    value={metadata.pLine}
                    field="pLine"
                    {...{ isEditing, onRefine, refiningField }}
                    onChange={v => onFieldUpdate('pLine', v)}
                    icon={<CopyrightIcon className="w-5 h-5 text-emerald-500" />}
                />
                <CreditField
                    label="Composer(s)"
                    value={metadata.composer}
                    field="composer"
                    {...{ isEditing, onRefine, refiningField }}
                    onChange={v => onFieldUpdate('composer', v)}
                    icon={<User className="w-5 h-5" />}
                />
                <CreditField
                    label="Lyricist(s)"
                    value={metadata.lyricist}
                    field="lyricist"
                    {...{ isEditing, onRefine, refiningField }}
                    onChange={v => onFieldUpdate('lyricist', v)}
                    icon={<FileText className="w-5 h-5" />}
                />
                <CreditField
                    label="Music Producer"
                    value={metadata.producer}
                    field="producer"
                    {...{ isEditing, onRefine, refiningField }}
                    onChange={v => onFieldUpdate('producer', v)}
                    icon={<User className="w-5 h-5 text-indigo-500" />}
                />
                <CreditField
                    label="ISRC Code"
                    value={metadata.isrc}
                    field="isrc"
                    {...{ isEditing, onRefine, refiningField }}
                    onChange={v => onFieldUpdate('isrc', v)}
                    onGenerate={() => handleGenerateCode('isrc')}
                    icon={<Hash className="w-5 h-5" />}
                />
                <CreditField
                    label="License"
                    value={metadata.iswc}
                    field="iswc"
                    {...{ isEditing, onRefine, refiningField }}
                    onChange={v => onFieldUpdate('iswc', v)}
                    icon={<Hash className="w-5 h-5 text-amber-500" />}
                />
                <CreditField
                    label="Catalog Number"
                    value={metadata.catalogNumber}
                    field="catalogNumber"
                    {...{ isEditing, onRefine, refiningField }}
                    onChange={v => onFieldUpdate('catalogNumber', v)}
                    onGenerate={() => handleGenerateCode('cat')}
                    icon={<Code className="w-5 h-5" />}
                />
                <CreditField
                    label="Other"
                    value={metadata.upc}
                    field="upc"
                    {...{ isEditing, onRefine, refiningField }}
                    onChange={v => onFieldUpdate('upc', v)}
                    icon={<Hash className="w-5 h-5 text-blue-500" />}
                />
                <CreditField
                    label="Language"
                    value={metadata.language}
                    field="language"
                    {...{ isEditing, onRefine, refiningField }}
                    onChange={v => onFieldUpdate('language', v)}
                    icon={<Globe className="w-5 h-5" />}
                />
            </div>

            {/* Distribution & Publishing Exports */}
            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2 mb-4 text-indigo-600 dark:text-indigo-400">
                    <Globe className="w-5 h-5" />
                    <h4 className="font-bold text-sm uppercase tracking-wide">Distribution & Publishing</h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                        <div>
                            <h5 className="font-bold text-sm text-light-text dark:text-dark-text mb-1">DDEX ERN Export</h5>
                            <p className="text-[10px] text-slate-500 mb-4 leading-relaxed">Standard XML format for digital music delivery (Global DSP Master Delivery)</p>
                        </div>
                        <Button
                            onClick={() => exportDDEX(metadata, 'release')}
                            variant="secondary"
                            size="sm"
                            className="w-full justify-center border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400"
                        >
                            <Code className="w-4 h-4 mr-2" /> Export DDEX ERN
                        </Button>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                        <div>
                            <h5 className="font-bold text-sm text-light-text dark:text-dark-text mb-1">CWR 2.1 Export</h5>
                            <p className="text-[10px] text-slate-500 mb-4 leading-relaxed">Common Works Registration for publishers and collecting societies (PRS, ASCAP, etc.)</p>
                        </div>
                        <Button
                            onClick={() => exportCWR(metadata)}
                            variant="secondary"
                            size="sm"
                            className="w-full justify-center border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400"
                        >
                            <FileText className="w-4 h-4 mr-2" /> Export CWR 2.1
                        </Button>
                    </div>
                </div>
            </div>
        </Card>
    );
};

export default CommercialLegalCard;
