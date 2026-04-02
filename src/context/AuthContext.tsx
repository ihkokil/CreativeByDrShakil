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
    };
}

interface AppSession {
    access_token: string;
}

interface AuthContextType {
    user: AppUser | null;
    session: AppSession | null;
    loading: boolean;
    role: string | null;
    signOut: () => Promise<void>;
    refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    session: null,
    loading: true,
    role: null,
    signOut: async () => { },
    refreshSession: async () => { },
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<AppUser | null>(null);
    const [session, setSession] = useState<AppSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [role, setRole] = useState<string | null>(null);

    const refreshSession = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/api/auth/session', {
                method: 'GET',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });

            const data = await response.json();
            setUser(data.user || null);
            setRole(data.role || null);

            if (data.token) {
                localStorage.setItem('auth_token', data.token);
                setSession({ access_token: data.token });
            } else {
                setSession(null);
            }
        } catch {
            setUser(null);
            setRole(null);
            setSession(null);
            localStorage.removeItem('auth_token');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshSession();
    }, []);

    const signOut = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        localStorage.removeItem('auth_token');
        setUser(null);
        setSession(null);
        setRole(null);
    };

    return (
        <AuthContext.Provider value={{ user, session, loading, role, signOut, refreshSession }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
