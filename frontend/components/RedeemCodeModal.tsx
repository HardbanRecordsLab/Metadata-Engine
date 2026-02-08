
import React, { useState } from 'react';
import { X, Gift, AlertCircle } from './icons';
import Button from './Button';
import { useAuth } from '../contexts/AuthContext';
// import { supabase } from '../lib/supabaseClient'; // REMOVED

interface RedeemCodeModalProps {
    onClose: () => void;
    showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const RedeemCodeModal: React.FC<RedeemCodeModalProps> = ({ onClose, showToast }) => {
    const [code, setCode] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { user, refetchUser } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        if (!user) {
            setError("You must be logged in to redeem a code.");
            setIsSubmitting(false);
            return;
        }

        try {
            const token = localStorage.getItem('access_token');
            if (!token) {
                setError("Session expired. Please log in again.");
                setIsSubmitting(false);
                return;
            }

            const response = await fetch('/api/redeem-code', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ code })
            });

            const result = await response.json();

            if (response.ok) {
                showToast(result.message, 'success');
                await refetchUser(); // Update user credits in UI
                onClose();
            } else {
                setError(result.error || "Failed to redeem code.");
            }
        } catch (err: any) {
            console.error("Redeem Code Error:", err);
            setError(err.message || 'An unexpected error occurred.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-[80] flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800 relative">
                <button onClick={onClose} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                    <X className="w-5 h-5" />
                </button>

                <div className="p-8">
                    <div className="text-center mb-8">
                        <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center mx-auto mb-4 text-white shadow-lg">
                            <Gift className="w-6 h-6" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Redeem Code</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">Enter your special code to get free analysis credits!</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Code</label>
                            <input 
                                type="text" 
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-accent-violet outline-none transition-all"
                                placeholder="E.g., MMEFREE10"
                                required
                            />
                        </div>

                        {error && (
                            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-xs">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        <Button type="submit" variant="primary" className="w-full py-3 mt-4 bg-orange-500 hover:bg-orange-600" disabled={isSubmitting}>
                            {isSubmitting ? 'Redeeming...' : 'Redeem Code'}
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default RedeemCodeModal;
