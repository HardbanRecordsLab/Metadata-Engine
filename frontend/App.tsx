
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateMetadata } from './services/geminiService';
import { Metadata, AnalysisRecord, BatchItem } from './types';
import Header from './components/Header';
import InputSection from './components/InputSection';
import Toast from './components/Toast';
import type { LegalDocType } from './components/LegalModal';
import type { ResourceDocType } from './components/ResourcesModal';
import Footer from './components/Footer';
import Sidebar from './components/Sidebar';
import DashboardHome from './components/DashboardHome';
import Button from './components/Button';
import ErrorBoundary from './components/ErrorBoundary';
import { exportBatchToCsv } from './utils/export';
import { Menu } from './components/icons';
import { useAuth } from './contexts/AuthContext';
import { db } from './services/databaseService';
// BatchAnalysisPanel and StemSeparationPanel imports removed – views no longer exposed

// Lazy-loaded — none of these are on the first-paint path
const HistoryPanel = lazy(() => import('./components/HistoryPanel'));
const ResultsSection = lazy(() => import('./components/results/ResultsSection'));
const AboutModal = lazy(() => import('./components/AboutModal'));
const LegalModal = lazy(() => import('./components/LegalModal'));
const ResourcesModal = lazy(() => import('./components/ResourcesModal'));
const SettingsPanel = lazy(() => import('./components/SettingsPanel'));
const AuthModal = lazy(() => import('./components/AuthModal'));
const ValidationPanel = lazy(() => import('./components/ValidationPanel'));
const PricingModal = lazy(() => import('./components/PricingModal'));
const RedeemCodeModal = lazy(() => import('./components/RedeemCodeModal'));


type Theme = 'light' | 'dark';
type View = 'dashboard' | 'analyze' | 'results' | 'history' | 'settings';

interface ToastState {
    message: string;
    type: 'success' | 'error' | 'info';
}

const LoadingFallback = () => (
    <div className="flex flex-col items-center justify-center h-96 animate-fade-in">
        <div className="w-12 h-12 border-4 border-accent-violet border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-medium">Loading Component...</p>
    </div>
);

const AppContent: React.FC = () => {
    const { user, isAuthenticated, refetchUser, verifyEmail } = useAuth();

    const [isAuthOpen, setIsAuthOpen] = useState(false);
    const [resetToken, setResetToken] = useState<string | null>(null);
    // Removed features not connected to backend: Cloud Import, Redeem Codes, Tools, Settings, Usage, Bulk Edit

    const [batch, setBatch] = useState<BatchItem[]>([]);
    const [isProcessingBatch, setIsProcessingBatch] = useState(false);
    const [view, setView] = useState<View>('dashboard');
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    const [analysisHistory, setAnalysisHistory] = useState<AnalysisRecord[]>([]);
    const [theme, setTheme] = useState<Theme>('dark');
    const [toastMessage, setToastMessage] = useState<ToastState | null>(null);
    const [showValidation, setShowValidation] = useState(false);
    const [isFresh, setIsFresh] = useState(false);

    const [isProMode, setIsProMode] = useState(() => {
        return localStorage.getItem('mme_pro_mode') === 'true';
    });

    const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
    const [activeLegalDoc, setActiveLegalDoc] = useState<LegalDocType | null>(null);
    const [activeResourceDoc, setActiveResourceDoc] = useState<ResourceDocType | null>(null);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isPricingOpen, setIsPricingOpen] = useState(false);
    const [isRedeemCodeOpen, setIsRedeemCodeOpen] = useState(false);

    const isAdmin = !!user?.isAdmin;
    const displayProfile = user ? { name: user.name } : { name: 'Guest' };


    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [theme]);

    useEffect(() => {
        const titles: Record<View, string> = {
            dashboard: 'Dashboard',
            analyze: 'Audio Analysis',
            results: 'Analysis Results',
            history: 'History',
            settings: 'Settings',
        };
        document.title = `${titles[view]} · Metadata Engine`;
    }, [view]);

    useEffect(() => {
        localStorage.setItem('mme_pro_mode', String(isProMode));
    }, [isProMode]);

    useEffect(() => {
        const syncHistory = async () => {
            if (user?.id) {
                try {
                    const cloudHistory = await db.fetchHistory(user.id);
                    setAnalysisHistory(cloudHistory);
                } catch (e) {
                    console.error("Failed to sync history", e);
                }
            } else {
                setAnalysisHistory([]);
            }
        };
        syncHistory();
    }, [user?.id]);

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isProcessingBatch) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        globalThis.addEventListener('beforeunload', handleBeforeUnload as any);
        return () => globalThis.removeEventListener('beforeunload', handleBeforeUnload as any);
    }, [isProcessingBatch]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
                e.preventDefault();
                toggleTheme();
            }
            if ((e.metaKey || e.ctrlKey) && e.key === '1') setView('dashboard');
            if ((e.metaKey || e.ctrlKey) && e.key === '2') setView('analyze');
            if ((e.metaKey || e.ctrlKey) && e.key === '3') setView('history');
        };

        globalThis.addEventListener('keydown', handleKeyDown as any);
        return () => globalThis.removeEventListener('keydown', handleKeyDown as any);
    }, []);

    const toggleTheme = () => {
        setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    };

    const showToast = (message: string, type: ToastState['type'] = 'success') => {
        setToastMessage({ message, type });
        setTimeout(() => setToastMessage(null), 3000);
    };

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('billing') === 'success') {
            refetchUser();
            showToast('Płatność przyjęta — kredyty zostały dodane do konta.', 'success');
            window.history.replaceState({}, '', window.location.pathname);
        } else if (params.get('billing') === 'cancelled') {
            showToast('Płatność anulowana.', 'info');
            window.history.replaceState({}, '', window.location.pathname);
        } else if (params.get('reset_token')) {
            setResetToken(params.get('reset_token'));
            setIsAuthOpen(true);
            window.history.replaceState({}, '', window.location.pathname);
        } else if (params.get('verify_token')) {
            const vt = params.get('verify_token') as string;
            window.history.replaceState({}, '', window.location.pathname);
            verifyEmail(vt)
                .then(() => showToast('Email verified — you are now signed in.', 'success'))
                .catch((e) => showToast(e?.message || 'Verification link is invalid or expired.', 'error'));
        }
    }, [refetchUser, verifyEmail]);

    const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null);

    // Derived active analysis data
    const activeAnalysis = activeAnalysisId ? batch.find(b => b.id === activeAnalysisId) : null;


    const handleStartBatchProcessing = async (modelPreference: 'flash' | 'pro' = 'flash') => {
        const itemsToProcess = batch.filter(item => item.status === 'pending');
        if (itemsToProcess.length === 0) {
            showToast("Add files to analyze.", 'info');
            return;
        }

        setIsProcessingBatch(true);
        let failedCount = 0;
        let processedCount = 0;

        for (let i = 0; i < itemsToProcess.length; i++) {
            const item = itemsToProcess[i];
            if (i > 0) await new Promise(resolve => setTimeout(resolve, 2500));

            setBatch(prev => prev.map(b => b.id === item.id ? { ...b, status: 'processing' } : b));
            try {

                const responseData = await generateMetadata(
                    'file',
                    isProMode,
                    item.file,
                    '',
                    '',
                    item.metadata,
                    modelPreference,
                    item.jobId,
                    (id) => {
                        setBatch(prev => prev.map(b => b.id === item.id ? { ...b, jobId: id } : b));
                    },
                    (msg) => {
                        setBatch(prev => prev.map(b => b.id === item.id ? { ...b, message: msg } : b));
                    },
                    isFresh
                );

                const results = responseData.metadata;
                const audioFeatures = responseData.audioFeatures;

                const newRecord: AnalysisRecord = {
                    id: new Date().toISOString() + item.file.name,
                    metadata: results,
                    inputType: 'file',
                    input: { fileName: item.file.name },
                    jobId: item.jobId
                };

                if (user?.id) {
                    await db.saveAnalysis(user.id, newRecord);
                    const updatedHistory = await db.fetchHistory(user.id);
                    setAnalysisHistory(updatedHistory);
                } else {
                    setAnalysisHistory(prev => [newRecord, ...prev]);
                }

                setBatch(prev => prev.map(b => b.id === item.id ? { ...b, status: 'completed', metadata: results, audioFeatures } : b));
                processedCount++;
            } catch (err) {
                failedCount++;
                setBatch(prev => prev.map(b => b.id === item.id ? { ...b, status: 'error', error: (err as Error).message } : b));
            }
        }

        setIsProcessingBatch(false);

        if (failedCount > 0) {
            showToast(`Finished. ${processedCount} OK, ${failedCount} failed.`, 'info');
        } else {
            showToast(`Batch processing completed successfully!`, 'success');
        }
    };

    const handleExportBatch = () => {
        const completedItems = batch.filter(item => item.status === 'completed');
        if (completedItems.length === 0) {
            showToast("No completed analyses to export.", 'info');
            return;
        }
        exportBatchToCsv(completedItems);
        showToast(`Exported ${completedItems.length} tracks.`, 'success');
    };

    // Cloud Import removed from UI

    const handleViewResults = (itemId: string) => {
        const item = batch.find(b => b.id === itemId);
        if (item && item.status === 'completed') {
            setActiveAnalysisId(item.id);
            setView('results');
        }
    };

    const handleNewAnalysis = () => {
        setBatch([]);
        setActiveAnalysisId(null);
        setView('analyze');
    };

    const handleBackToBatch = () => {
        setActiveAnalysisId(null);
        setView('analyze');
    }

    const handleUpdateResults = (updatedMetadata: Metadata) => {
        if (!activeAnalysis) return;
        setBatch(prev => prev.map(b => b.id === activeAnalysis.id ? { ...b, metadata: updatedMetadata } : b));
        showToast("Metadata updated!", 'success');
    };

    const handleUpdateActiveFile = (newFile: File) => {
        if (!activeAnalysis) return;
        setBatch(prev => prev.map(b => b.id === activeAnalysis.id ? { ...b, file: newFile } : b));
        showToast("File reference restored!", 'success');
    };

    const handleBatchUpdate = (updates: { id: string, metadata: Metadata }[]) => {
        setBatch(prev => prev.map(item => {
            const update = updates.find(u => u.id === item.id);
            if (update) {
                return { ...item, metadata: update.metadata };
            }
            return item;
        }));
        showToast("Batch updates saved!", 'success');
    };

    const handleRetry = (id: string) => {
        setBatch(prev => prev.map(item => item.id === id ? { ...item, status: 'pending', error: undefined, message: undefined } : item));
    };

    const handleViewHistoryItem = (record: AnalysisRecord) => {
        const existingInBatch = batch.find(b => b.id === record.id);
        if (existingInBatch) {
            setActiveAnalysisId(existingInBatch.id);
        } else {
            const newItem: BatchItem = {
                id: record.id,
                file: new File([], record.input.fileName || 'historical-file'),
                status: 'completed',
                metadata: record.metadata,
                jobId: record.jobId
            };
            setBatch(prev => [...prev, newItem]);
            setActiveAnalysisId(newItem.id);
        }
        setView('results');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="min-h-screen mesh-bg text-light-text dark:text-dark-text font-sans transition-colors duration-300 flex">

            <Sidebar
                currentView={view}
                onChangeView={setView}
                onOpenAbout={() => setActiveResourceDoc('docs')}
                isOpenMobile={isMobileMenuOpen}
                onCloseMobile={() => setIsMobileMenuOpen(false)}
                onOpenLogin={() => setIsAuthOpen(true)}
                showToast={showToast}
                isCollapsed={isSidebarCollapsed}
                onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
            />

            <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-72'}`}>
                <div className="sticky top-0 z-30 bg-white/10 dark:bg-slate-900/10 backdrop-blur-xl border-b border-white/10 dark:border-slate-800/20 px-4 py-3 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setIsMobileMenuOpen(true)} className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800">
                            <Menu className="w-6 h-6" />
                        </button>
                        <h2 className="text-lg font-bold capitalize text-slate-700 dark:text-slate-200">
                            {view === 'dashboard' ? 'Dashboard' :
                                view === 'analyze' ? 'Audio Analysis' :
                                    view === 'results' ? 'Analysis Results' :
                                        view === 'settings' ? 'Settings & Profile' :
                                            'History'}
                        </h2>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Quota and Pricing UI removed */}
                        {/* Pricing UI removed from header to keep only backend-connected features */}
                        <Header theme={theme} toggleTheme={toggleTheme} openValidationPanel={() => setShowValidation(true)} />
                    </div>
                </div>

                <main className="flex-grow p-4 lg:p-8 relative">
                    <ErrorBoundary>
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={view}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.3, ease: "easeInOut" }}
                            >
                                {view === 'dashboard' && (
                                    <DashboardHome
                                        onNavigate={(v) => setView(v as View)}
                                        onCreateNew={handleNewAnalysis}
                                        userProfile={displayProfile as any}
                                    />
                                )}

                                {view === 'analyze' && (
                                    <div className="max-w-5xl mx-auto">
                                        <div className="bg-light-card dark:bg-dark-card rounded-2xl shadow-premium p-6 md:p-8 border border-slate-200 dark:border-slate-800 backdrop-blur-xl">
                                            <InputSection
                                                batch={batch}
                                                setBatch={setBatch}
                                                onAnalyze={handleStartBatchProcessing}
                                                isProMode={isProMode}
                                                setIsProMode={setIsProMode}
                                                isProcessingBatch={isProcessingBatch}
                                                onViewResults={handleViewResults}
                                                onRetry={handleRetry}
                                                onExportBatch={handleExportBatch}
                                                showToast={showToast}
                                                isFresh={isFresh}
                                                setIsFresh={setIsFresh}
                                            />
                                        </div>
                                    </div>
                                )}


                                {view === 'results' && activeAnalysis && (
                                    <div className="max-w-7xl mx-auto">
                                      <Suspense fallback={<LoadingFallback />}>
                                        <ResultsSection
                                            isLoading={false}
                                            error={null}
                                            results={activeAnalysis.metadata!}
                                            showToast={showToast}
                                            onUpdateResults={handleUpdateResults}
                                            currentAnalysis={{
                                                id: activeAnalysis.id,
                                                metadata: activeAnalysis.metadata!,
                                                inputType: 'file',
                                                input: { fileName: activeAnalysis.file.name },
                                                jobId: activeAnalysis.jobId
                                            }}
                                            uploadedFile={activeAnalysis.file}
                                            onUpdateFile={handleUpdateActiveFile}
                                            onBackToBatch={handleBackToBatch}
                                        />
                                      </Suspense>
                                    </div>
                                )}

                                {view === 'history' && (
                                    <div className="max-w-4xl mx-auto">
                                        <Suspense fallback={<LoadingFallback />}>
                                            <HistoryPanel history={analysisHistory} onSelectItem={handleViewHistoryItem} />
                                        </Suspense>
                                    </div>
                                )}

                                {view === 'settings' && (
                                    <Suspense fallback={<LoadingFallback />}>
                                        <SettingsPanel
                                            user={user}
                                            onOpenPricing={() => setIsPricingOpen(true)}
                                            onOpenRedeemCode={() => setIsRedeemCodeOpen(true)}
                                        />
                                    </Suspense>
                                )}

                                {/* Views not connected to backend removed from UI: tools, settings, usage, bulk-edit */}
                            </motion.div>
                        </AnimatePresence>
                    </ErrorBoundary>
                </main>

                <Footer
                    onOpenLegal={(type) => setActiveLegalDoc(type)}
                    onOpenResource={(type) => setActiveResourceDoc(type)}
                />
            </div>

            {toastMessage && <Toast message={toastMessage.message} type={toastMessage.type} />}

            <Suspense fallback={null}>
                {isAboutModalOpen && <AboutModal onClose={() => setIsAboutModalOpen(false)} />}
                {isAuthOpen && <AuthModal onClose={() => { setIsAuthOpen(false); setResetToken(null); }} resetToken={resetToken ?? undefined} />}
                {activeLegalDoc && <LegalModal type={activeLegalDoc} onClose={() => setActiveLegalDoc(null)} />}
                {activeResourceDoc && <ResourcesModal type={activeResourceDoc} onClose={() => setActiveResourceDoc(null)} />}
                {showValidation && <ValidationPanel onClose={() => setShowValidation(false)} />}
                {isPricingOpen && <PricingModal onClose={() => setIsPricingOpen(false)} />}
                {isRedeemCodeOpen && <RedeemCodeModal onClose={() => setIsRedeemCodeOpen(false)} showToast={showToast} />}
            </Suspense>
        </div>
    );
}

export default function App() {
    return <AppContent />;
}
