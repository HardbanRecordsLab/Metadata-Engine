
import React, { useState } from 'react';
import { X, User, Lock, AlertCircle, CheckCircle2, Google, ArrowLeft, Key, Shield } from './icons';
import Button from './Button';
import { useAuth } from '../contexts/AuthContext';

interface AuthModalProps {
    onClose: () => void;
    initialView?: 'login' | 'register';
}

const AuthModal: React.FC<AuthModalProps> = ({ onClose, initialView = 'login' }) => {
    const [view, setView] = useState<'login' | 'register' | 'forgotPassword'>(initialView);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const { login, register, loginWithGoogle, resetPassword } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        setSuccessMessage(null);

        try {
            if (view === 'login') {
                await login(email, password);
                onClose();
            } else if (view === 'register') {
                await register(email, name, password);
                // The register function will throw a specific error if email confirmation is needed
                // If we get here without error but no session, it's usually handled by the throw in context
                onClose();
            } else if (view === 'forgotPassword') {
                await resetPassword(email);
                setSuccessMessage("Password reset link sent! Please check your email.");
                // Don't close immediately so user sees message
            }
        } catch (err: any) {
            console.error("Auth Error:", err);

            if (err.message === 'REGISTRATION_SUCCESS_CONFIRM_EMAIL') {
                setSuccessMessage("Account created! Please check your email to confirm your account before logging in.");
                setView('login'); // Switch to login view so they can login after clicking link
            } else if (err.message?.includes('Database error')) {
                setError('System error: Database tables missing. Please run setup script.');
            } else if (err.message?.includes('User already registered')) {
                setError('This email is already registered. Please log in.');
            } else {
                setError(err.message || 'Authentication failed');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleGoogleLogin = async () => {
        setIsSubmitting(true);
        setError(null);
        try {
            await loginWithGoogle();
            // Typically OAuth will redirect, so onClose might not be reached immediately
            // but if it's a popup flow (not current impl), we'd call onClose
        } catch (err: any) {
            console.error("Google Auth Error:", err);
            setError(err.message || 'Google authentication failed');
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-[80] flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800 relative">
                <button onClick={onClose} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 z-10">
                    <X className="w-5 h-5" />
                </button>

                <div className="p-8">
                    <div className="text-center mb-8">
                        <div className="w-12 h-12 bg-gradient-to-br from-accent-violet to-accent-blue rounded-xl flex items-center justify-center mx-auto mb-4 text-white shadow-lg">
                            {view === 'forgotPassword' ? <Key className="w-6 h-6" /> : <User className="w-6 h-6" />}
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
                            {view === 'login' ? 'Welcome Back' : view === 'register' ? 'Create Account' : 'Recovery'}
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                            {view === 'login' ? 'Sign in to access your dashboard' :
                                view === 'register' ? 'Join thousands of music professionals' :
                                    'Enter your email to reset password'}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {successMessage && (
                            <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-300 text-xs mb-4">
                                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{successMessage}</span>
                            </div>
                        )}

                        {view === 'register' && (
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Full Name</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full pl-10 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-accent-violet outline-none transition-all"
                                        placeholder="John Doe"
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-accent-violet outline-none transition-all"
                                placeholder="name@studio.com"
                                required
                            />
                        </div>

                        {view !== 'forgotPassword' && (
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-xs font-bold uppercase text-slate-500">Password</label>
                                    {view === 'login' && (
                                        <button
                                            type="button"
                                            onClick={() => { setView('forgotPassword'); setError(null); setSuccessMessage(null); }}
                                            className="text-xs text-accent-violet hover:underline"
                                        >
                                            Forgot Password?
                                        </button>
                                    )}
                                </div>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full pl-10 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-accent-violet outline-none transition-all"
                                        placeholder="••••••••"
                                        required
                                        minLength={6}
                                    />
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-xs">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        <Button type="submit" variant="primary" className="w-full py-3 mt-4" disabled={isSubmitting}>
                            {isSubmitting ? 'Processing...' : (
                                view === 'login' ? 'Sign In' :
                                    view === 'register' ? 'Create Account' :
                                        'Send Reset Link'
                            )}
                        </Button>
                    </form>

                    {view !== 'forgotPassword' && (
                        <>
                            <div className="relative my-6">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="px-2 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400">Or continue with</span>
                                </div>
                            </div>

                            <Button
                                type="button"
                                variant="secondary"
                                onClick={handleGoogleLogin}
                                disabled={isSubmitting}
                                className="w-full relative py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                            >
                                <span className="absolute left-4 top-1/2 -translate-y-1/2">
                                    <Shield className="w-5 h-5 text-accent-blue" />
                                </span>
                                Enterprise Identity Access
                            </Button>
                        </>
                    )}

                    <div className="mt-6 text-center text-sm text-slate-500">
                        {view === 'forgotPassword' ? (
                            <button
                                onClick={() => { setView('login'); setError(null); setSuccessMessage(null); }}
                                className="flex items-center justify-center gap-1 mx-auto text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                            >
                                <ArrowLeft className="w-3 h-3" /> Back to Login
                            </button>
                        ) : (
                            <>
                                {view === 'login' ? "Don't have an account? " : "Already have an account? "}
                                <button
                                    onClick={() => { setView(view === 'login' ? 'register' : 'login'); setError(null); setSuccessMessage(null); }}
                                    className="text-accent-violet font-bold hover:underline"
                                >
                                    {view === 'login' ? 'Sign Up' : 'Log In'}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthModal;
