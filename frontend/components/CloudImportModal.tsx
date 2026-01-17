import React, { useState, useEffect } from 'react';
import { X, Globe, Download, Check, AlertCircle, RefreshCw } from './icons';
import Button from './Button';
import { listGoogleDriveFiles, downloadGoogleDriveFile, listDropboxFiles, downloadDropboxFile } from '../services/cloudStorageService';
import { CloudFile } from '../types';
import { useAuth } from '../contexts/AuthContext'; // Only used for user state now, loginWithGoogle removed

interface CloudImportModalProps {
    onClose: () => void;
    onImport: (files: File[]) => void;
}

const CloudImportModal: React.FC<CloudImportModalProps> = ({ onClose, onImport }) => {
    const [provider, setProvider] = useState<'google' | 'dropbox' | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [files, setFiles] = useState<CloudFile[]>([]);
    // Fix: Initialize selectedIds as a Set
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isImporting, setIsImporting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Auth State (removed loginWithGoogle)
    const { user } = useAuth(); // Just to check if a user is logged in
    const [manualToken, setManualToken] = useState('');
    const [showTokenInput, setShowTokenInput] = useState(false);

    // Load Google Token from storage if available
    const getGoogleToken = () => localStorage.getItem('mme_google_token');

    const handleConnect = async (p: 'google' | 'dropbox') => {
        setProvider(p);
        setFiles([]);
        setError(null);
        setIsLoading(true);
        setShowTokenInput(false);
        setSelectedIds(new Set()); // Clear selection when switching providers

        try {
            if (p === 'google') {
                const token = getGoogleToken();
                if (token) {
                    const list = await listGoogleDriveFiles(token);
                    setFiles(list);
                } else {
                    // Prompt user: they need to login again with scopes OR provide token
                    setError("Google Drive access token missing or expired. Please provide it manually.");
                    setShowTokenInput(true);
                }
            } else if (p === 'dropbox') {
                // For Dropbox, simpler to just ask for token in this version without complex OAuth flow setup
                setError("Please enter your Dropbox Access Token.");
                setShowTokenInput(true);
            }
        } catch (e: any) {
            console.error(e);
            setError(e.message || "Failed to connect.");
            if (e.message.includes("Unauthorized") || e.message.includes("token")) {
                setShowTokenInput(true);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleManualTokenSubmit = async () => {
        if (!manualToken) return;
        setIsLoading(true);
        setError(null);
        try {
            let list: CloudFile[] = [];
            if (provider === 'google') {
                // Cache it temporarily
                localStorage.setItem('mme_google_token', manualToken);
                list = await listGoogleDriveFiles(manualToken);
            } else if (provider === 'dropbox') {
                list = await listDropboxFiles(manualToken);
            }
            setFiles(list);
            setShowTokenInput(false);
        } catch (e: any) {
            setError("Invalid Token or Network Error: " + e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const handleImport = async () => {
        if (selectedIds.size === 0) return;
        setIsImporting(true);
        const token = provider === 'google' ? getGoogleToken() : manualToken;

        // Fallback to manual token if storage empty even for google
        // Explicitly type to string to satisfy TS
        const effectiveToken: string = (token || manualToken) || "";

        if (!effectiveToken) {
            setError("Missing access token.");
            setIsImporting(false);
            return;
        }

        try {
            // Fix: Array.from(selectedIds) is correctly typed now as selectedIds is a Set<string>
            const promises = Array.from(selectedIds).map(async (id: string) => {
                const fileMeta = files.find(f => f.id === id);
                if (!fileMeta) throw new Error("File meta missing");

                if (provider === 'google') {
                    return downloadGoogleDriveFile(id, effectiveToken, fileMeta.name, fileMeta.type);
                } else {
                    return downloadDropboxFile(id, effectiveToken, fileMeta.name);
                }
            });

            const importedFiles = await Promise.all(promises);
            onImport(importedFiles);
            onClose();
        } catch (e: any) {
            console.error(e);
            setError("Import failed: " + e.message);
        } finally {
            setIsImporting(false);
        }
    };

    // Removed handleReLogin as Google login through AuthContext is removed
    // const handleReLogin = () => {
    //     loginWithGoogle().catch(err => setError(err.message));
    // };

    return (
        <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-slate-800 relative flex flex-col max-h-[80vh]">

                {/* Header */}
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Globe className="w-6 h-6 text-accent-blue" /> Cloud Import
                    </h3>
                    <button onClick={onClose}><X className="w-5 h-5 text-slate-500" /></button>
                </div>

                {/* Body */}
                <div className="flex-grow p-6 overflow-y-auto">
                    {!provider ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <button
                                onClick={() => handleConnect('google')}
                                className="p-6 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-accent-blue hover:shadow-md transition-all flex flex-col items-center gap-3 group"
                            >
                                <div className="w-12 h-12 bg-white dark:bg-slate-700 rounded-full flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform text-2xl">
                                    <Globe className="w-6 h-6 text-accent-blue" />
                                </div>
                                <span className="font-bold text-slate-700 dark:text-slate-200">Enterprise Storage Core</span>
                            </button>
                            <button
                                onClick={() => handleConnect('dropbox')}
                                className="p-6 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 hover:shadow-md transition-all flex flex-col items-center gap-3 group"
                            >
                                <div className="w-12 h-12 bg-white dark:bg-slate-700 rounded-full flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform text-2xl">
                                    <Shield className="w-6 h-6 text-blue-500" />
                                </div>
                                <span className="font-bold text-slate-700 dark:text-slate-200">Distributed Node Storage</span>
                            </button>
                        </div>
                    ) : isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="w-10 h-10 border-4 border-accent-blue border-t-transparent rounded-full animate-spin mb-4" />
                            <p className="text-slate-500">Accessing {provider === 'google' ? 'Google Drive' : 'Dropbox'}...</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {error && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm flex gap-2 items-start">
                                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                    <div>
                                        <p>{error}</p>
                                        {/* Removed Google Drive specific re-login button */}
                                    </div>
                                </div>
                            )}

                            {showTokenInput && (
                                <div className="flex gap-2">
                                    <input
                                        type="password"
                                        value={manualToken}
                                        onChange={e => setManualToken(e.target.value)}
                                        placeholder={`Paste ${provider} Access Token here...`}
                                        className="flex-grow p-2 rounded border dark:bg-slate-800 dark:border-slate-700 text-sm"
                                    />
                                    <Button onClick={handleManualTokenSubmit} size="sm" variant="primary">Load</Button>
                                </div>
                            )}

                            {files.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Select Audio Files</p>
                                    {files.map(file => (
                                        <div
                                            key={file.id}
                                            onClick={() => toggleSelection(file.id)}
                                            className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${selectedIds.has(file.id) ? 'bg-accent-violet/10 border-accent-violet' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                                        >
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center mr-3 ${selectedIds.has(file.id) ? 'bg-accent-violet border-accent-violet' : 'border-slate-400'}`}>
                                                {selectedIds.has(file.id) && <Check className="w-3 h-3 text-white" />}
                                            </div>
                                            <div className="flex-grow">
                                                <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{file.name}</p>
                                                <p className="text-xs text-slate-500">{file.size} • {file.modified}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {files.length === 0 && !showTokenInput && !error && (
                                <div className="text-center py-10 text-slate-500">
                                    <p>No audio files found.</p>
                                    <button onClick={() => handleConnect(provider!)} className="text-accent-blue underline text-sm mt-2">Refresh</button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
                    {provider && (
                        <button onClick={() => { setProvider(null); setSelectedIds(new Set()); setError(null); }} className="text-sm text-slate-500 hover:underline">
                            Switch Provider
                        </button>
                    )}
                    <div className="flex gap-3 ml-auto">
                        <Button variant="secondary" onClick={onClose}>Cancel</Button>
                        <Button variant="primary" onClick={handleImport} disabled={selectedIds.size === 0 || isImporting}>
                            {isImporting ? 'Importing...' : `Import ${selectedIds.size > 0 ? `(${selectedIds.size})` : ''}`}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CloudImportModal;