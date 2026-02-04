
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { generateMetadata } from './services/geminiService';
import { Metadata, AnalysisRecord, BatchItem } from './types';
import Header from './components/Header';
import InputSection from './components/InputSection';
import ResultsSection from './components/results/ResultsSection';
import Toast from './components/Toast';
import AboutModal from './components/AboutModal';
import LegalModal, { LegalDocType } from './components/LegalModal';
import ResourcesModal, { ResourceDocType } from './components/ResourcesModal';
import PricingModal from './components/PricingModal';
import Footer from './components/Footer';
import Sidebar from './components/Sidebar';
import DashboardHome from './components/DashboardHome';
import AuthModal from './components/AuthModal';
import CloudImportModal from './components/CloudImportModal';
import RedeemCodeModal from './components/RedeemCodeModal';
import Button from './components/Button';
import ErrorBoundary from './components/ErrorBoundary';
import { exportBatchToCsv } from './utils/export';
import { Menu } from './components/icons';
import { useAuth } from './contexts/AuthContext';
import { db } from './services/databaseService';
import ValidationPanel from './components/ValidationPanel';
import ToolsPanel from './components/ToolsPanel';
import SettingsPanel from './components/SettingsPanel';
import UsagePanel from './components/UsagePanel';

// Lazy Load Heavy Components
const BulkEditor = lazy(() => import('./components/BulkEditor'));
const HistoryPanel = lazy(() => import('./components/HistoryPanel'));


type Theme = 'light' | 'dark';
type View = 'dashboard' | 'analyze' | 'results' | 'history' | 'tools' | 'bulk-edit' | 'settings' | 'usage';

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
    const { user, upgradeTier, isAuthenticated, refetchUser } = useAuth();

    const [isPricingOpen, setIsPricingOpen] = useState(false);
    const [isAuthOpen, setIsAuthOpen] = useState(false);
    const [isCloudImportOpen, setIsCloudImportOpen] = useState(false);
    const [isRedeemCodeModalOpen, setIsRedeemCodeModalOpen] = useState(false);

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

    // UserTier and Credits from AuthContext
    const userTier = user?.tier || 'starter';
    const userCredits = user?.credits || 0;
    const displayProfile = user ? { name: user.name, tier: user.tier, credits: user.credits } : { name: 'Guest', tier: 'starter' as const, credits: 0 };


    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [theme]);

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
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
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

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const toggleTheme = () => {
        setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    };

    const showToast = (message: string, type: ToastState['type'] = 'success') => {
        setToastMessage({ message, type });
        setTimeout(() => setToastMessage(null), 3000);
    };

    const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null);

    // Derived active analysis data
    const activeAnalysis = activeAnalysisId ? batch.find(b => b.id === activeAnalysisId) : null;

    const handleUpgrade = async () => {
        if (!isAuthenticated) {
            setIsPricingOpen(false);
            setIsAuthOpen(true);
            showToast("Please login first to upgrade.", 'info');
            return;
        }
        await upgradeTier('pro');
        setIsPricingOpen(false);
        showToast("Congratulations! Account upgraded to PRO.", 'success');
    };

    const handleStartBatchProcessing = async (modelPreference: 'flash' | 'pro' = 'flash') => {
        // [BYPASS] Credit check disabled by request
        /*
        if (userTier === 'starter') {
            const pendingItemsCount = batch.filter(item => item.status === 'pending').length;
            if (pendingItemsCount > userCredits) {
                setIsPricingOpen(true);
                showToast("You need more credits for this batch size. Upgrade or redeem a code!", 'info');
                return;
            }
            if (pendingItemsCount === 0) {
                showToast("Add files to analyze.", 'info');
                return;
            }
            if (userCredits === 0) {
                setIsPricingOpen(true);
                showToast("Your credits have run out. Please upgrade to continue.", 'info');
                return;
            }
        } else if (userTier === 'hobby' && batch.filter(item => item.status === 'pending').length > 50) {
            setIsPricingOpen(true);
            showToast("Hobby plan limits batch size to 50. Please upgrade.", 'info');
            return;
        }
        */

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
                // [BYPASS] Credit decrement disabled by request
                /*
                if (userTier === 'starter' && user && user.credits > 0) {
                    await db.decrementCredits(user.id);
                    await refetchUser();
                } else if (userTier === 'starter' && user && user.credits === 0) {
                    showToast("Not enough credits to process this item. Please upgrade.", 'error');
                    setBatch(prev => prev.map(b => b.id === item.id ? { ...b, status: 'error', error: 'Insufficient credits' } : b));
                    failedCount++;
                    continue;
                }
                */

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
        // [BYPASS] Export restriction disabled
        /*
        if (userTier === 'starter') {
            setIsPricingOpen(true);
            return;
        }
        */
        const completedItems = batch.filter(item => item.status === 'completed');
        if (completedItems.length === 0) {
            showToast("No completed analyses to export.", 'info');
            return;
        }
        exportBatchToCsv(completedItems);
        showToast(`Exported ${completedItems.length} tracks.`, 'success');
    };

    const handleCloudImport = (files: File[]) => {
        const newItems: BatchItem[] = files.map(file => ({
            id: `cloud-${file.name}-${Date.now()}`,
            file,
            status: 'pending'
        }));
        setBatch(prev => [...prev, ...newItems]);
        showToast(`Imported ${files.length} files from Cloud.`, 'success');
    };

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
                onOpenAbout={() => setIsAboutModalOpen(true)}
                isOpenMobile={isMobileMenuOpen}
                onCloseMobile={() => setIsMobileMenuOpen(false)}
                onOpenPricing={() => setIsPricingOpen(true)}
                onOpenLogin={() => setIsAuthOpen(true)}
                userCredits={userCredits}
                userTier={userTier}
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
                                        view === 'history' ? 'History' : 'Tools'}
                        </h2>
                    </div>
                    <div className="flex items-center gap-3">
                        {userTier === 'starter' && userCredits > 0 && (
                            <span className="text-xs font-bold text-yellow-500 px-3 py-1.5 rounded-full border border-yellow-500/30">
                                Credits: {userCredits}
                            </span>
                        )}
                        {userTier === 'starter' && userCredits === 0 && (
                            <button onClick={() => setIsPricingOpen(true)} className="hidden sm:block text-xs font-bold text-accent-violet border border-accent-violet/30 px-3 py-1.5 rounded-full hover:bg-accent-violet hover:text-white transition-colors">
                                Upgrade to Pro
                            </button>
                        )}
                        <Header theme={theme} toggleTheme={toggleTheme} openValidationPanel={() => setShowValidation(true)} />
                    </div>
                </div>

                <main className="flex-grow p-4 lg:p-8 relative">
                    <ErrorBoundary>
                        {view === 'dashboard' && (
                            <DashboardHome
                                onNavigate={(v) => setView(v as View)}
                                onCreateNew={handleNewAnalysis}
                                userProfile={displayProfile}
                                onOpenPricing={() => setIsPricingOpen(true)}
                                onOpenRedeemCode={() => setIsRedeemCodeModalOpen(true)}
                            />
                        )}

                        {view === 'analyze' && (
                            <div className="max-w-5xl mx-auto">
                                <div className="bg-light-card dark:bg-dark-card rounded-2xl shadow-lg p-6 md:p-8 border border-slate-200 dark:border-slate-800">
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
                                        userTier={userTier}
                                        userCredits={userCredits}
                                        onOpenPricing={() => setIsPricingOpen(true)}
                                        onOpenCloudImport={() => {
                                            if (userTier === 'starter') { setIsPricingOpen(true); showToast("Cloud import is a Pro feature", 'info'); }
                                            else { setIsCloudImportOpen(true); }
                                        }}
                                        onOpenBulkEdit={() => {
                                            if (userTier === 'starter') { setIsPricingOpen(true); showToast("Bulk editing is a Pro feature", 'info'); }
                                            else { setView('bulk-edit'); }
                                        }}
                                        isFresh={isFresh}
                                        setIsFresh={setIsFresh}
                                    />
                                </div>
                            </div>
                        )}

                        {view === 'results' && activeAnalysis && (
                            <div className="max-w-7xl mx-auto">
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
                                    userTier={userTier}
                                    onOpenPricing={() => setIsPricingOpen(true)}
                                />
                            </div>
                        )}

                        {view === 'history' && (
                            <div className="max-w-4xl mx-auto">
                                <Suspense fallback={<LoadingFallback />}>
                                    <HistoryPanel history={analysisHistory} onSelectItem={handleViewHistoryItem} />
                                </Suspense>
                            </div>
                        )}

                        {view === 'tools' && (
                            <div className="max-w-6xl mx-auto">
                                <ToolsPanel
                                    onOpenPricing={() => setIsPricingOpen(true)}
                                    showToast={showToast}
                                    userTier={userTier}
                                />
                            </div>
                        )}

                        {view === 'settings' && (
                            <SettingsPanel
                                user={user}
                                onOpenPricing={() => setIsPricingOpen(true)}
                            />
                        )}

                        {view === 'usage' && (
                            <UsagePanel user={user} />
                        )}

                        {view === 'bulk-edit' && (
                            <Suspense fallback={<LoadingFallback />}>
                                <BulkEditor
                                    items={batch}
                                    onUpdateBatch={handleBatchUpdate}
                                    onClose={() => setView('analyze')}
                                />
                            </Suspense>
                        )}
                    </ErrorBoundary>
                </main>

                <Footer
                    onOpenLegal={(type) => setActiveLegalDoc(type)}
                    onOpenResource={(type) => setActiveResourceDoc(type)}
                />
            </div>

            {toastMessage && <Toast message={toastMessage.message} type={toastMessage.type} />}
            {isAboutModalOpen && <AboutModal onClose={() => setIsAboutModalOpen(false)} />}
            {isPricingOpen && <PricingModal onClose={() => setIsPricingOpen(false)} onUpgrade={handleUpgrade} />}
            {isAuthOpen && <AuthModal onClose={() => setIsAuthOpen(false)} />}
            {isCloudImportOpen && <CloudImportModal onClose={() => setIsCloudImportOpen(false)} onImport={handleCloudImport} />}
            {isRedeemCodeModalOpen && <RedeemCodeModal onClose={() => setIsRedeemCodeModalOpen(false)} showToast={showToast} />}

            {activeLegalDoc && <LegalModal type={activeLegalDoc} onClose={() => setActiveLegalDoc(null)} />}
            {activeResourceDoc && <ResourcesModal type={activeResourceDoc} onClose={() => setActiveResourceDoc(null)} />}
            {showValidation && <ValidationPanel onClose={() => setShowValidation(false)} />}
        </div>
    );
}

export default function App() {
    return <AppContent />;
}
