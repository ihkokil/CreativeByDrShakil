"use client";

import { createContext, useContext, useEffect, useState } from 'react';

interface AppUser {
    id: string;
    email: string;
    phone?: string | null;
    role?: string;
    user_metadata?: {
        full_name?: string;
        phone?: string | null;
        bmdc_number?: string | null;
        profile_image?: string | null;
    };
}

interface AppSession {
    access_token: string;
}

interface AuthContextType {
    user: AppUser | null;
    session: AppSession | null;
    sessionId: string | null;
    loading: boolean;
    role: string | null;
    hasSessionTerminated: boolean;
    signOut: () => Promise<void>;
    refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    session: null,
    sessionId: null,
    loading: true,
    role: null,
    hasSessionTerminated: false,
    signOut: async () => { },
    refreshSession: async () => { },
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<AppUser | null>(null);
    const [session, setSession] = useState<AppSession | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [role, setRole] = useState<string | null>(null);
    const [hasSessionTerminated, setHasSessionTerminated] = useState(false);

    const refreshSession = async (silent = false) => {
        if (!silent) {
            setLoading(true);
        }

        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/api/auth/session', {
                method: 'GET',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });

            if (!response.ok) {
                if (response.status === 401) {
                    const data = await response.json();

                    if (data?.code === 'session_revoked') {
                        setUser(null);
                        setRole(null);
                        setSession(null);
                        setSessionId(null);
                        setHasSessionTerminated(true);
                        localStorage.removeItem('auth_token');
                    }
                    return;
                }

                // Keep current auth state on transient server/network failures.
                return;
            }

            const data = await response.json();

            setUser(data.user || null);
            setRole(data.role || null);
            setSessionId(data.sessionId || null);

            if (data.token) {
                localStorage.setItem('auth_token', data.token);
                setSession({ access_token: data.token });
            } else {
                setSession(null);
            }
        } catch {
            // Keep current auth state on transient client-side fetch failures.
        } finally {
            if (!silent) {
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        refreshSession();
    }, []);

    // Poll session validity every 30 seconds
    useEffect(() => {
        if (!user || !sessionId) return;

        const interval = setInterval(() => {
            refreshSession(true);
        }, 30000);

        return () => clearInterval(interval);
    }, [user, sessionId]);

    const signOut = async () => {
        const currentSessionId = sessionId;

        // Clear local auth state first so logout feels instant on UI.
        localStorage.removeItem('auth_token');
        setUser(null);
        setSession(null);
        setSessionId(null);
        setRole(null);
        setHasSessionTerminated(false);

        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: currentSessionId }),
            });
        } catch {
            // Ignore errors
        }
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                session,
                sessionId,
                loading,
                role,
                hasSessionTerminated,
                signOut,
                refreshSession,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
