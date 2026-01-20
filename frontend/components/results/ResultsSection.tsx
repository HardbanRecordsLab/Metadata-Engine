import React, { useState, useEffect, useRef } from 'react';
import { Metadata, AnalysisRecord, UserTier } from '../../types';
import { refineMetadataField } from '../../services/geminiService';
import { embedMetadata } from '../../services/taggingService';
import { Download, Pencil, ArrowLeft, RotateCcw, RotateCw } from '../icons';
import VisualsCard from './VisualsCard';
import ResultsSkeleton from './ResultsSkeleton';
import Button from '../Button';
import IdentificationCard from './IdentificationCard';
import TrackIdentityCard from './TrackIdentityCard';
import SonicAnalysisDisplay from './SonicAnalysisDisplay';
import ClassificationStyleCard from './ClassificationStyleCard';
import CommercialLegalCard from './CommercialLegalCard';
import ConfidenceMeter from './ConfidenceMeter';
import CopyrightCard from './CopyrightCard';
import StructureCard from './StructureCard';
import DistributionCard from './DistributionCard';
import MetadataValidationCard from './MetadataValidationCard';
import AnimatedSection from '../AnimatedSection';

interface ResultsSectionProps {
    isLoading: boolean;
    error: string | null;
    results: Metadata;
    showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
    onUpdateResults: (results: Metadata) => void;
    currentAnalysis: AnalysisRecord | null;
    uploadedFile: File | null;
    onUpdateFile: (file: File) => void;
    onBackToBatch: () => void;
    userTier: UserTier;
    onOpenPricing: () => void;
}

const AUTOSAVE_KEY = 'music-metadata-autosave';

const validateGenreRules = (metadata: Metadata): { scoreMod: number, issues: string[] } => {
    const issues: string[] = [];
    let scoreMod = 0;
    const genre = (metadata.mainGenre || '').toLowerCase();
    const bpm = metadata.bpm || 0;

    if ((genre.includes('hip-hop') || genre.includes('rap')) && bpm > 160 && !genre.includes('trap')) {
        scoreMod -= 10;
        issues.push(`Suspiciously high BPM (${bpm}) for Hip-Hop.`);
    }

    if ((genre.includes('house') || genre.includes('techno') || genre.includes('trance')) && (bpm < 110 || bpm > 150)) {
        scoreMod -= 10;
        issues.push(`BPM (${bpm}) atypical for EDM/House genre.`);
    }

    if ((genre.includes('drum and bass') || genre.includes('dnb')) && bpm < 160) {
        scoreMod -= 10;
        issues.push(`BPM (${bpm}) too low for Drum and Bass.`);
    }
    return { scoreMod, issues };
};

// --- Helper Hook ---
const useConfidenceValidator = (editedResults: Metadata | null, uploadedFile: File | null) => {
    const [score, setScore] = useState(100);
    const [issues, setIssues] = useState<string[]>([]);

    useEffect(() => {
        if (!editedResults) {
            setScore(100);
            setIssues([]);
            return;
        }

        const genreCheck = validateGenreRules(editedResults);

        const totalScore = Math.max(0, 100 + genreCheck.scoreMod);
        const totalIssues = [...genreCheck.issues];

        setScore(totalScore);
        setIssues(totalIssues);

    }, [editedResults, uploadedFile]);

    return { score, issues };
};

const ErrorDisplay: React.FC<{ message: string }> = ({ message }) => (
    <div className="text-center py-16 animate-fade-in">
        <p className="text-red-500 text-lg font-bold">An error occurred</p>
        <p className="text-slate-600 dark:text-slate-400 mt-2">{message}</p>
    </div>
);


const ResultsSection: React.FC<ResultsSectionProps> = ({ isLoading, error, results, showToast, onUpdateResults, currentAnalysis, uploadedFile, onUpdateFile, onBackToBatch, userTier, onOpenPricing }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedResults, setEditedResults] = useState<Metadata | null>(results);
    const [undoStack, setUndoStack] = useState<Metadata[]>([]);
    const [redoStack, setRedoStack] = useState<Metadata[]>([]);
    const [refiningField, setRefiningField] = useState<keyof Metadata | null>(null);
    const [isTaggingFile, setIsTaggingFile] = useState(false);
    const [isFileReadable, setIsFileReadable] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Verify file accessibility
    useEffect(() => {
        if (!uploadedFile) {
            setIsFileReadable(false);
            return;
        }

        // Quick check: try to read a tiny slice
        const reader = new FileReader();
        reader.onload = () => setIsFileReadable(true);
        reader.onerror = () => setIsFileReadable(false);
        reader.readAsArrayBuffer(uploadedFile.slice(0, 10));
    }, [uploadedFile]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onUpdateFile(file);
            setIsFileReadable(true);
        }
    };

    // Use the validator hook to reduce complexity
    const { score: confidenceScore, issues: confidenceIssues } = useConfidenceValidator(editedResults, uploadedFile);

    useEffect(() => {
        setEditedResults(results);
    }, [currentAnalysis?.id, results]);

    useEffect(() => {
        if (!results || !currentAnalysis) return;
        setIsEditing(false);

        const savedData = localStorage.getItem(AUTOSAVE_KEY);
        if (savedData) {
            try {
                const parsedData = JSON.parse(savedData);
                if (parsedData.id === currentAnalysis.id) {
                    setEditedResults(parsedData.metadata);
                    setIsEditing(true);
                    showToast("Restored unsaved changes.", 'info');
                } else {
                    setEditedResults(results);
                    localStorage.removeItem(AUTOSAVE_KEY);
                }
            } catch (e) {
                console.error("Failed to parse autosaved data", e);
                setEditedResults(results);
                localStorage.removeItem(AUTOSAVE_KEY);
            }
        } else {
            setEditedResults(results);
        }
    }, [results, currentAnalysis, showToast]);

    useEffect(() => {
        if (isEditing && editedResults && currentAnalysis) {
            const dataToSave = {
                id: currentAnalysis.id,
                metadata: editedResults,
            };
            localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(dataToSave));
        }
    }, [isEditing, editedResults, currentAnalysis]);

    if (isLoading) return <ResultsSkeleton />;
    if (error && !results) return <ErrorDisplay message={error} />;
    if (!results || !editedResults) return null;

    const handleSave = () => {
        if (editedResults) {
            onUpdateResults(editedResults);
        }
        setIsEditing(false);
        localStorage.removeItem(AUTOSAVE_KEY);
    };

    const handleCancel = () => {
        setEditedResults(results);
        setIsEditing(false);
        localStorage.removeItem(AUTOSAVE_KEY);
    };

    const handleFieldUpdate = (field: keyof Metadata, value: any) => {
        if (!editedResults) return;
        setUndoStack(prev => [...prev, { ...editedResults }]);
        setRedoStack([]); // Clear redo on new change
        setEditedResults(prev => prev ? { ...prev, [field]: value } : null);
    };

    const handleUndo = () => {
        if (undoStack.length === 0 || !editedResults) return;
        const previous = undoStack[undoStack.length - 1];
        setRedoStack(prev => [...prev, { ...editedResults }]);
        setUndoStack(prev => prev.slice(0, -1));
        setEditedResults(previous);
    };

    const handleRedo = () => {
        if (redoStack.length === 0 || !editedResults) return;
        const next = redoStack[redoStack.length - 1];
        setUndoStack(prev => [...prev, { ...editedResults }]);
        setRedoStack(prev => prev.slice(0, -1));
        setEditedResults(next);
    };

    const getRefinementInstruction = (field: keyof Metadata): string => {
        switch (field) {
            case 'title': return "Suggest a catchy and fitting track title.";
            case 'artist': return "Suggest an artist name or performer style.";
            case 'albumArtist': return "Suggest the album artist name (usually matches artist).";
            case 'album': return "Suggest an album title or related compilation name for the track.";
            case 'year': return "Suggest the most probable release year based on track style and artist history.";
            case 'track': return "Suggest a track number appropriate for an album based on typical track ordering.";
            case 'mainGenre': return "CRITICAL: Analyze the sonic characteristics. Provide ONE precise Main Genre.";
            case 'trackDescription': return "CRITICAL: The 'trackDescription' MUST be a rich, evocative, and technical 3-5 sentence paragraph. THIS IS MANDATORY - do not leave this empty. Create a rich, evocative description, highlighting emotions and atmosphere.";
            case 'moods': return `Analyze tempo and key to infer emotional mood. Provide 5-7 precise adjectives.`;
            case 'mainInstrument': return "Identify the single most dominant instrument in the track.";
            case 'instrumentation': return "List the most prominent instruments used in the track, up to 5.";
            case 'vocalStyle': return "Analyze the vocal performance. Describe gender, timbre, delivery, and emotional tone. If no vocals, state 'None' for gender.";
            case 'additionalGenres': return "Based on main genre and sonic elements, suggest 3-5 fitting sub-genres.";
            case 'keywords': return "Generate 5-7 keywords relevant to the track for search and discoverability.";
            case 'useCases': return "Suggest 3-5 specific sync and playlist use cases.";
            case 'publisher': return "Suggest a fitting record label or publisher, or state 'Independent'.";
            case 'copyright': return "Suggest a standard copyright line for the track, e.g., '© YYYY Artist/Label'.";
            case 'composer': return "Suggest a likely composer(s) for the track.";
            case 'lyricist': return "Suggest a likely lyricist(s) for the track.";
            case 'isrc': return "Suggest a valid ISRC code format or a placeholder for new tracks (CC-XXX-YY-NNNNN).";
            case 'catalogNumber': return "Suggest a catalog number or a suitable placeholder (e.g., LABEL-YYYY-001).";
            case 'language': return "Suggest the primary language of the lyrics, or 'Instrumental'.";
            default: return `Suggest a better value for field ${String(field)}.`;
        }
    };

    const handleRefine = async (field: keyof Metadata) => {
        if (!editedResults) return;
        const instruction = getRefinementInstruction(field);
        setRefiningField(field);
        try {
            const refinedPart = await refineMetadataField(editedResults, field, instruction);
            const newResults = { ...editedResults, ...(refinedPart || {}) };
            onUpdateResults(newResults);
            setEditedResults(newResults);
            showToast(`Field improved!`, 'success');
        } catch (err) {
            showToast("Error improving field.", 'error');
        } finally {
            setRefiningField(null);
        }
    };

    const handleExternalMetadataUpdate = (newMetadata: Partial<Metadata>) => {
        if (!editedResults) return;
        setUndoStack(prev => [...prev, { ...editedResults }]);
        setRedoStack([]);
        const merged = { ...editedResults, ...newMetadata };
        setEditedResults(merged);
        onUpdateResults(merged);
    };

    const handleDownload = async () => {
        if (!uploadedFile) {
            showToast("No source file to tag.", 'error');
            return;
        }
        if (!editedResults) return;

        setIsTaggingFile(true);
        try {
            await embedMetadata(uploadedFile, editedResults, currentAnalysis.jobId);
            showToast("Tagged file download started!", 'success');
        } catch (err) {
            showToast("Error saving tags.", 'error');
        } finally {
            setIsTaggingFile(false);
        }
    };

    const handleCopyToClipboard = () => {
        const data = isEditing ? editedResults : results;
        const textToCopy = `Title: ${data.title}\nArtist: ${data.artist}\nBPM: ${data.bpm}\nKey: ${data.key} ${data.mode}\nGenre: ${data.mainGenre}`;
        navigator.clipboard.writeText(textToCopy);
        showToast("Copied to clipboard!", 'success');
    };

    const isOriginalFileAvailable = uploadedFile && currentAnalysis?.inputType === 'file';
    const isMp3 = uploadedFile?.type === 'audio/mpeg' || uploadedFile?.name.toLowerCase().endsWith('.mp3');
    const isWav = uploadedFile?.type === 'audio/wav' || uploadedFile?.name.toLowerCase().endsWith('.wav');
    const isTaggingSupported = isMp3 || isWav;
    const canTag = isTaggingSupported && (isFileReadable || currentAnalysis?.id);

    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 animate-slide-up">
                <div className="flex flex-wrap items-center gap-3">
                    {/* Undo/Redo Controls */}
                    {isEditing && (
                        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700 mr-2">
                            <button
                                onClick={handleUndo}
                                disabled={undoStack.length === 0}
                                title="Undo (Ctrl+Z)"
                                className={`p-2 rounded-md transition-colors ${undoStack.length > 0 ? 'text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700' : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'}`}
                            >
                                <RotateCcw className="w-4 h-4" />
                            </button>
                            <button
                                onClick={handleRedo}
                                disabled={redoStack.length === 0}
                                title="Redo (Ctrl+Y)"
                                className={`p-2 rounded-md transition-colors ${redoStack.length > 0 ? 'text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700' : 'text-slate-300 dark:text-slate-600 cursor-not-allowed'}`}
                            >
                                <RotateCw className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    <Button onClick={onBackToBatch} aria-label="Back to batch" variant="secondary" size="sm" className="px-2.5">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-accent-violet to-accent-blue leading-tight">Analysis Dashboard</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <div className={`w-2 h-2 rounded-full ${uploadedFile ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500'}`} />
                            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                                {uploadedFile ? `Linked: ${uploadedFile.name}` : 'File Reference Lost'}
                            </span>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                                accept="audio/*"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="text-[9px] font-bold text-accent-blue hover:underline uppercase"
                            >
                                [ Re-connect File ]
                            </button>
                        </div>
                    </div>
                </div>
                {!isEditing && (
                    <div className="flex items-center gap-3 self-start sm:self-center">
                        <Button
                            onClick={handleDownload}
                            disabled={isTaggingFile || !canTag}
                            variant="primary"
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white border-none shadow-md shadow-emerald-600/20 px-4"
                        >
                            {isTaggingFile ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    <span>Tagging...</span>
                                </>
                            ) : (
                                <>
                                    <Download className="w-4 h-4" />
                                    <span>Download Tagged Audio</span>
                                </>
                            )}
                        </Button>
                        <Button onClick={() => setIsEditing(true)} variant="secondary" size="sm">
                            <Pencil className="w-4 h-4" /> Edit
                        </Button>
                    </div>
                )}
            </div>

            {!isFileReadable && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6 animate-pulse-subtle">
                    <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-white shadow-lg shadow-red-500/30 shrink-0">
                        <ArrowLeft className="w-8 h-8 rotate-180" />
                    </div>
                    <div className="flex-1 text-center md:text-left">
                        <h4 className="text-xl font-extrabold text-red-600 dark:text-red-400 uppercase tracking-tight">CRITICAL: File Connection Lost</h4>
                        <p className="text-slate-600 dark:text-slate-400 mt-1 font-medium">To enable <b>Download, Fingerprint & IPFS</b>, you must re-select the source file. The browser lost access because the file was modified or moved on your computer.</p>
                    </div>
                    <Button
                        onClick={() => fileInputRef.current?.click()}
                        variant="primary"
                        className="bg-red-600 hover:bg-red-700 border-none shadow-lg shadow-red-600/20 whitespace-nowrap px-8 py-3"
                    >
                        Repair Connection
                    </Button>
                </div>
            )}

            {/* Player removed due to stability issues */}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <AnimatedSection delay="150ms">
                        <TrackIdentityCard
                            metadata={editedResults!}
                            isEditing={isEditing}
                            onFieldUpdate={handleFieldUpdate}
                            refiningField={refiningField}
                            onRefine={handleRefine}
                            userTier={userTier}
                            onOpenPricing={onOpenPricing}
                        />
                    </AnimatedSection>
                    <AnimatedSection delay="170ms">
                        <SonicAnalysisDisplay
                            metadata={editedResults!}
                            isEditing={isEditing}
                            onFieldUpdate={handleFieldUpdate}
                            refiningField={refiningField}
                            onRefine={handleRefine}
                        />
                    </AnimatedSection>
                    <AnimatedSection delay="180ms">
                        <StructureCard metadata={editedResults!} />
                    </AnimatedSection>
                    <AnimatedSection delay="190ms">
                        <ClassificationStyleCard
                            metadata={editedResults!}
                            isEditing={isEditing}
                            onFieldUpdate={handleFieldUpdate}
                            refiningField={refiningField}
                            onRefine={handleRefine}
                        />
                    </AnimatedSection>
                    <AnimatedSection delay="210ms">
                        <CommercialLegalCard
                            metadata={editedResults!}
                            isEditing={isEditing}
                            onFieldUpdate={handleFieldUpdate}
                            refiningField={refiningField}
                            onRefine={handleRefine}
                            showToast={showToast}
                        />
                    </AnimatedSection>
                </div>

                <div className="lg:col-span-1 space-y-6">
                    <AnimatedSection delay="250ms">
                        <DistributionCard
                            metadata={editedResults!}
                            jobId={currentAnalysis?.jobId}
                            showToast={showToast}
                        />
                    </AnimatedSection>

                    <AnimatedSection delay="260ms">
                        <MetadataValidationCard
                            metadata={editedResults!}
                        />
                    </AnimatedSection>

                    <AnimatedSection delay="270ms">
                        <IdentificationCard
                            metadata={editedResults!}
                            fileName={uploadedFile?.name}
                            uploadedFile={uploadedFile}
                            onUpdateMetadata={handleExternalMetadataUpdate}
                            showToast={showToast}
                        />
                    </AnimatedSection>

                    <AnimatedSection delay="310ms">
                        <ConfidenceMeter score={confidenceScore} issues={confidenceIssues} />
                    </AnimatedSection>

                    <AnimatedSection delay="320ms">
                        <VisualsCard
                            metadata={editedResults!}
                            onUpdateField={handleFieldUpdate}
                            showToast={showToast}
                        />
                    </AnimatedSection>

                    <AnimatedSection delay="310ms">
                        <CopyrightCard
                            metadata={editedResults!}
                            file={uploadedFile}
                            onUpdateFile={onUpdateFile}
                            showToast={showToast}
                            jobId={currentAnalysis?.jobId}
                        />
                    </AnimatedSection>
                </div>
            </div>

            {isEditing && (
                <div className="flex justify-end gap-4 mt-8 animate-fade-in">
                    <Button onClick={handleCancel} variant="secondary">Cancel</Button>
                    <Button onClick={handleSave} variant="primary">Save Changes</Button>
                </div>
            )}
        </div>
    );
};

export default ResultsSection;
