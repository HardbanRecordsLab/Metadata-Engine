
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { getFullUrl } from '../apiConfig';

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    loginWithGoogle: () => Promise<void>;
    register: (email: string, name: string, password: string) => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    confirmPasswordReset: (token: string, newPassword: string) => Promise<void>;
    verifyEmail: (token: string) => Promise<void>;
    logout: () => void;
    refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const authUrl = (path: string) => getFullUrl(`/auth${path}`);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [token, setToken] = useState<string | null>(localStorage.getItem('hrl_sso_token_v3') || localStorage.getItem('access_token'));

    const checkIsAdmin = (email: string, meta: Record<string, unknown> | null | undefined): boolean => {
        if (meta && typeof meta.is_superuser !== 'undefined') {
            return !!meta.is_superuser;
        }
        const admins = ['hardbanrecordslab.pl@gmail.com'];
        return admins.some((admin) => admin.toLowerCase() === email.toLowerCase());
    };

    const fetchUserProfile = async (accessToken: string) => {
        try {
            const response = await fetch(authUrl('/me'), {
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

            const profileMeta = {
                is_superuser: userData.is_superuser,
                tier: userData.tier,
                credits: userData.credits,
                ...userData.user_metadata,
            };
            const isAdm = checkIsAdmin(userData.email, profileMeta);
            setUser({
                id: userData.id,
                email: userData.email,
                name: (userData.username || userData.email.split('@')[0]),
                tier: isAdm ? 'studio' : (userData.tier || 'starter'),
                createdAt: userData.created_at ? new Date(userData.created_at).getTime() : Date.now(),
                credits: isAdm ? 999999999 : (typeof userData.credits === 'number' ? userData.credits : 3),
                isAdmin: isAdm,
            });

        } catch (error) {
            console.error("Failed to fetch user profile", error);
            setUser(null);
            localStorage.removeItem('hrl_sso_token_v3');
            localStorage.removeItem('access_token');
            setToken(null);
        }
        setIsLoading(false);
    };

    const refetchUser = async () => {
        const currentToken = localStorage.getItem('hrl_sso_token_v3') || localStorage.getItem('access_token');
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
        const response = await fetch(authUrl('/login'), {
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

        const accessToken = data.hrl_sso_token_v3 || data.access_token || data.token;
        
        localStorage.setItem('hrl_sso_token_v3', accessToken);
        setToken(accessToken);
        await fetchUserProfile(accessToken);
    };

    const loginWithGoogle = async () => {
        // Not implemented locally yet
        alert("Google login not supported in local mode yet.");
    };

    const register = async (email: string, name: string, password: string) => {
        const response = await fetch(authUrl('/register'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, username: name || email.split('@')[0], password })
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

        if (data.requires_verification) {
            // Backend sent a verification email — don't auto-login.
            throw new Error('REGISTRATION_SUCCESS_CONFIRM_EMAIL');
        }

        // No email verification configured server-side → straight in.
        await login(email, password);
    };

    const verifyEmail = async (verifyToken: string) => {
        const response = await fetch(authUrl('/verify-email'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: verifyToken })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.detail || 'This verification link is invalid or has expired.');
        }
        const accessToken = data.access_token || data.token;
        localStorage.setItem('hrl_sso_token_v3', accessToken);
        setToken(accessToken);
        await fetchUserProfile(accessToken);
    };

    const resetPassword = async (email: string) => {
        const response = await fetch(authUrl('/forgot-password'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        if (!response.ok) {
            let detail = 'Could not send the reset email. Please try again later.';
            try { detail = (await response.json()).detail || detail; } catch { /* noop */ }
            throw new Error(detail);
        }
    };

    const confirmPasswordReset = async (resetToken: string, newPassword: string) => {
        const response = await fetch(authUrl('/reset-password'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: resetToken, new_password: newPassword })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.detail || 'This reset link is invalid or has expired.');
        }
        const accessToken = data.access_token || data.token;
        localStorage.setItem('hrl_sso_token_v3', accessToken);
        setToken(accessToken);
        await fetchUserProfile(accessToken);
    };

    const logout = async () => {
        localStorage.removeItem('hrl_sso_token_v3');
        localStorage.removeItem('access_token');
        setToken(null);
        setUser(null);
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
            confirmPasswordReset,
            verifyEmail,
            logout,
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
