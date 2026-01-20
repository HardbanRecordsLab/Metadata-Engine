
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserTier } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { db } from '../services/databaseService';

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    loginWithGoogle: () => Promise<void>;
    register: (email: string, name: string, password: string) => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    logout: () => void;
    upgradeTier: (tier: UserTier) => Promise<void>;
    refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const checkIsAdmin = (email: string): boolean => {
        const admins = ['rzeszotary94@gmail.com', 'hardbanrecordslab.pl@gmail.com'];
        return admins.some(admin => admin.toLowerCase() === email.toLowerCase());
    };

    const fetchUserProfile = async (authId: string, email: string) => {
        // First check if user is a hardcoded admin
        if (checkIsAdmin(email)) {
            setUser({
                id: authId,
                email: email,
                name: 'Administrator',
                tier: 'studio',
                createdAt: Date.now(),
                credits: 999999999 // Effectively unlimited
            });
            setIsLoading(false);
            return;
        }

        try {
            const profile = await db.getProfile(authId);
            if (profile) {
                setUser({
                    id: authId,
                    email: email,
                    name: profile.full_name || email.split('@')[0],
                    // [BYPASS] Force PRO tier for everyone during beta
                    tier: 'pro', // profile.tier as UserTier,
                    createdAt: new Date(profile.created_at).getTime(),
                    credits: 99999 // profile.credits || 0 
                });
            } else {
                // Default new user profile (Starter)
                setUser({
                    id: authId,
                    email: email,
                    name: email.split('@')[0],
                    tier: 'starter',
                    createdAt: Date.now(),
                    credits: 5 // Default free credits
                });

                // Try to create profile asynchronously
                try {
                    await db.createProfile(authId, email, email.split('@')[0], 'starter', 5);
                } catch (e) {
                    console.warn("Profile creation check:", e);
                }
            }
        } catch (error) {
            console.error("Failed to fetch user profile", error);
            // Fallback safest state
            setUser({
                id: authId,
                email: email,
                name: email.split('@')[0],
                tier: 'starter',
                createdAt: Date.now(),
                credits: 0
            });
        }
        setIsLoading(false);
    };

    const refetchUser = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            await fetchUserProfile(session.user.id, session.user.email!);
        } else {
            setUser(null);
        }
    };

    useEffect(() => {
        if (!isSupabaseConfigured) {
            console.warn("Supabase not configured. Auth disabled.");
            setIsLoading(false);
            return;
        }

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (session?.user) {
                await fetchUserProfile(session.user.id, session.user.email!);
            } else {
                setUser(null);
                setIsLoading(false);
            }
        });

        // Initial session check with timeout safety
        supabase.auth.getSession()
            .then(({ data: { session } }) => {
                if (session?.user) {
                    return fetchUserProfile(session.user.id, session.user.email!);
                } else {
                    setIsLoading(false);
                }
            })
            .catch(err => {
                console.error("Supabase session check failed:", err);
                setIsLoading(false);
            });

        // Fallback safety: ensure loading stops even if Supabase hangs
        const timeoutId = setTimeout(() => {
            if (isLoading) {
                console.warn("Auth initialization timed out. Proceeding as guest.");
                setIsLoading(false);
            }
        }, 5000);

        return () => {
            clearTimeout(timeoutId);
            if (subscription) subscription.unsubscribe();
        };
    }, []);

    const login = async (email: string, password: string) => {
        if (!isSupabaseConfigured) throw new Error("SUPABASE_NOT_CONFIGURED");
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await refetchUser();
    };

    const loginWithGoogle = async () => {
        if (!isSupabaseConfigured) throw new Error("SUPABASE_NOT_CONFIGURED");
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });
        if (error) throw error;
    };

    const register = async (email: string, name: string, password: string) => {
        if (!isSupabaseConfigured) throw new Error("SUPABASE_NOT_CONFIGURED");
        const { error, data } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: name },
                emailRedirectTo: window.location.origin
            }
        });
        if (error) throw error;

        if (data.user) {
            try {
                await db.createProfile(data.user.id, email, name, 'starter', 5);
            } catch (profileError) {
                console.warn("Profile creation warning during register:", profileError);
            }

            if (!data.session) {
                throw new Error("REGISTRATION_SUCCESS_CONFIRM_EMAIL");
            }

            await refetchUser();
        }
    };

    const resetPassword = async (email: string) => {
        if (!isSupabaseConfigured) throw new Error("SUPABASE_NOT_CONFIGURED");
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin
        });
        if (error) throw error;
    };

    const logout = async () => {
        if (!isSupabaseConfigured) {
            setUser(null);
            return;
        }
        await supabase.auth.signOut();
        setUser(null);
    };

    const upgradeTier = async (tier: UserTier) => {
        if (!user) return;

        // Admins cannot change tier (fixed to studio/infinite)
        if (checkIsAdmin(user.email)) return;

        try {
            await db.upgradeTier(user.id, tier);
            await refetchUser();
        } catch (e) {
            console.error("Upgrade failed", e);
            throw new Error("Failed to upgrade subscription.");
        }
    };

    return (
        <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, loginWithGoogle, register, resetPassword, logout, upgradeTier, refetchUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
