
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

const API_URL = '/api/auth'; // Relative path, proxied by Nginx/Vite

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [token, setToken] = useState<string | null>(localStorage.getItem('access_token'));

    const checkIsAdmin = (email: string): boolean => {
        const admins = [
            'hardbanrecordslab.pl@gmail.com'
        ];
        return admins.some(admin => admin.toLowerCase() === email.toLowerCase());
    };

    const fetchUserProfile = async (accessToken: string) => {
        try {
            const response = await fetch(`${API_URL}/me`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch user profile');
            }

            const userData = await response.json();
            
            // Map backend user to frontend User type
            const isAdm = checkIsAdmin(userData.email);
            
            setUser({
                id: userData.id,
                email: userData.email,
                name: userData.email.split('@')[0], // Fallback name
                tier: isAdm ? 'studio' : (userData.user_metadata?.tier || 'starter'),
                createdAt: userData.created_at ? new Date(userData.created_at).getTime() : Date.now(),
                credits: isAdm ? 999999999 : (userData.user_metadata?.credits || 5)
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
        const response = await fetch(`${API_URL}/signin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Login failed');
        }

        const data = await response.json();
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
        const response = await fetch(`${API_URL}/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Registration failed');
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
