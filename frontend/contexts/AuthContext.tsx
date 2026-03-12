
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserTier } from '../types';
// import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'; // REMOVED
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

const API_URL = '/api/auth'; // Relative path for Vercel Rewrite (see vercel.json)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [token, setToken] = useState<string | null>(localStorage.getItem('access_token'));

    const checkIsAdmin = (email: string, meta: any): boolean => {
        if (meta && typeof meta.is_superuser !== 'undefined') {
            return !!meta.is_superuser;
        }
        const admins = ['hardbanrecordslab.pl@gmail.com'];
        return admins.some(admin => admin.toLowerCase() === email.toLowerCase());
    };

    const fetchUserProfile = async (accessToken: string) => {
        try {
            const response = await fetch(`${API_URL}/me`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            const text = await response.text();
            let userData;
            try {
                userData = JSON.parse(text);
            } catch (e) {
                console.error("Serwer zwrócił nie-JSON dla /me:", text);
                throw new Error("Failed to parse user profile response");
            }

            if (!response.ok) {
                throw new Error(userData.detail || 'Failed to fetch user profile');
            }

            const isAdm = checkIsAdmin(userData.email, userData.user_metadata);
            setUser({
                id: userData.id,
                email: userData.email,
                name: (userData.username || userData.email.split('@')[0]),
                tier: isAdm ? 'studio' : (userData.tier || userData.user_metadata?.tier || 'starter'),
                createdAt: userData.created_at ? new Date(userData.created_at).getTime() : Date.now(),
                credits: isAdm ? 999999999 : (typeof userData.credits === 'number' ? userData.credits : (userData.user_metadata?.credits ?? 10)),
                isAdmin: isAdm
            });

        } catch (error) {
            console.error("Failed to fetch user profile", error);
            setUser(null);
            localStorage.removeItem('access_token');
            setToken(null);
        }
        setIsLoading(false);
    };

    const refetchUser = async () => {
        const currentToken = localStorage.getItem('access_token');
        if (currentToken) {
            await fetchUserProfile(currentToken);
        } else {
            setUser(null);
        }
    };

    useEffect(() => {
        if (token) {
            fetchUserProfile(token);
        } else {
            setIsLoading(false);
        }
    }, [token]);

    const login = async (email: string, password: string) => {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error("Serwer zwrócił nie-JSON:", text);
            throw new Error(`Błąd serwera (nie-JSON): ${text.substring(0, 100)}`);
        }

        if (!response.ok) {
            throw new Error(data.detail || 'Login failed');
        }

        const accessToken = data.access_token;
        
        localStorage.setItem('access_token', accessToken);
        setToken(accessToken);
        await fetchUserProfile(accessToken);
    };

    const loginWithGoogle = async () => {
        // Not implemented locally yet
        alert("Google login not supported in local mode yet.");
    };

    const register = async (email: string, name: string, password: string) => {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error("Serwer zwrócił nie-JSON przy rejestracji:", text);
            throw new Error(`Błąd serwera (nie-JSON): ${text.substring(0, 100)}`);
        }

        if (!response.ok) {
            throw new Error(data.detail || 'Registration failed');
        }

        // Auto login after register? Or ask to login?
        // Let's just ask to login for now, or auto-login if backend returned token (it doesn't yet).
        // User created.
        await login(email, password);
    };

    const resetPassword = async (email: string) => {
        // Not implemented locally yet
        alert("Password reset not supported in local mode yet.");
    };

    const logout = async () => {
        localStorage.removeItem('access_token');
        setToken(null);
        setUser(null);
    };

    const upgradeTier = async (tier: UserTier) => {
        // Todo: Call API to upgrade tier
        console.log("Upgrade tier not implemented yet");
    };

    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated: !!user,
            isLoading,
            login,
            loginWithGoogle,
            register,
            resetPassword,
            logout,
            upgradeTier,
            refetchUser
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
