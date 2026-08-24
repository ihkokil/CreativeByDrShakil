"use client";

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getDeviceHash, detectOS, getDeviceCategory, getDeviceLabel } from '@/lib/client-fingerprint';
import BannedUserModal from '@/components/Auth/BannedUserModal';

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
        canManagePayments?: boolean;
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
    sessionTerminatedReason: string | null;
    isBannedModalOpen: boolean;
    bannedMessage: string | null;
    showBannedModal: (message?: string) => void;
    hideBannedModal: () => void;
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
    sessionTerminatedReason: null,
    isBannedModalOpen: false,
    bannedMessage: null,
    showBannedModal: () => { },
    hideBannedModal: () => { },
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
    const [sessionTerminatedReason, setSessionTerminatedReason] = useState<string | null>(null);
    const [isBannedModalOpen, setIsBannedModalOpen] = useState(false);
    const [bannedMessage, setBannedMessage] = useState<string | null>(null);

    const showBannedModal = useCallback((msg?: string) => {
        setBannedMessage(msg || 'Your account has been banned from accessing the platform. Please contact Dr. Nahid Akhter Shakil or email support@creativebydrshakil.com for assistance.');
        setIsBannedModalOpen(true);
    }, []);

    const hideBannedModal = useCallback(() => {
        setIsBannedModalOpen(false);
        setBannedMessage(null);
    }, []);

    const sameUser = (a: AppUser | null, b: AppUser | null) => {
        if (!a && !b) return true;
        if (!a || !b) return false;

        return (
            a.id === b.id &&
            a.email === b.email &&
            a.phone === b.phone &&
            a.role === b.role &&
            a.user_metadata?.full_name === b.user_metadata?.full_name &&
            a.user_metadata?.phone === b.user_metadata?.phone &&
            a.user_metadata?.bmdc_number === b.user_metadata?.bmdc_number &&
            a.user_metadata?.profile_image === b.user_metadata?.profile_image &&
            a.user_metadata?.canManagePayments === b.user_metadata?.canManagePayments
        );
    };

    // Instant synchronous hydration from local cache to prevent flashing guest buttons
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const token = localStorage.getItem('auth_token');
            const cached = localStorage.getItem('auth_user_cache');
            if (token && cached) {
                const parsed = JSON.parse(cached);
                if (parsed?.user) {
                    setUser((curr) => curr || parsed.user);
                    setRole((curr) => curr || parsed.role || parsed.user.role || 'student');
                    setSessionId((curr) => curr || parsed.sessionId || null);
                    setSession((curr) => curr || { access_token: token });
                    setLoading(false);
                }
            } else if (!token) {
                setLoading(false);
            }
        } catch {
            // Ignore parse errors
        }
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const originalFetch = window.fetch;
        window.fetch = async function (input, init) {
            let hash = '';
            let os = '';
            let category: "mobile" | "tablet" | "desktop" | "" = '';
            let label = '';
            
            try {
                hash = await getDeviceHash();
                const userAgent = navigator.userAgent;
                os = detectOS(userAgent);
                category = getDeviceCategory(
                    userAgent,
                    navigator.maxTouchPoints || 0,
                    window.screen ? window.screen.width : 1024,
                    window.screen ? window.screen.height : 768
                ) as "mobile" | "tablet" | "desktop";
                label = getDeviceLabel(userAgent, category);
            } catch (fpErr) {
                // Proceed without device headers if fingerprinting fails
            }

            let response;
            let url: string;

            if (input instanceof Request) {
                url = input.url;
                const isRelative = !url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('//');
                const isSameOrigin = url.startsWith(window.location.origin);

                if (isRelative || isSameOrigin) {
                    const headers = new Headers(input.headers);
                    if (hash) headers.set('X-Device-Hash', hash);
                    if (label) headers.set('X-Device-Label', label);
                    if (os) headers.set('X-Device-OS', os);
                    if (category) headers.set('X-Device-Category', category);
                    
                    const clonedRequest = new Request(input, { headers });
                    response = await originalFetch(clonedRequest, init);
                } else {
                    try {
                        response = await originalFetch(input, init);
                    } catch (err) {
                        return new Response(null, { status: 500, statusText: 'Fetch Failed' });
                    }
                }
            } else {
                url = typeof input === 'string' ? input : (input instanceof URL ? input.href : (input as any).url || '');
                const isRelative = !url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('//');
                const isSameOrigin = url.startsWith(window.location.origin);

                if (isRelative || isSameOrigin) {
                    const headers = new Headers(init?.headers);
                    if (hash) headers.set('X-Device-Hash', hash);
                    if (label) headers.set('X-Device-Label', label);
                    if (os) headers.set('X-Device-OS', os);
                    if (category) headers.set('X-Device-Category', category);
                    
                    response = await originalFetch(input, {
                        ...init,
                        headers
                    });
                } else {
                    try {
                        response = await originalFetch(input, init);
                    } catch (err) {
                        return new Response(null, { status: 500, statusText: 'Fetch Failed' });
                    }
                }
            }

            if (response.status === 403) {
                try {
                    const cloned = response.clone();
                    const data = await cloned.json();
                    if (data?.code === 'user_banned') {
                        showBannedModal(data.error);
                    }
                } catch {
                    // Ignore JSON parse failures
                }
            }

            if (response.status === 401) {
                const isLoginOrAuth = url.includes('/api/auth/login') ||
                                      url.includes('/api/auth/register') ||
                                      url.includes('/api/auth/reset-password') ||
                                      url.includes('/api/auth/session') ||
                                      url.includes('/api/auth/heartbeat');

                if (!isLoginOrAuth && localStorage.getItem('auth_token')) {
                    setUser(null);
                    setRole(null);
                    setSession(null);
                    setSessionId(null);
                    localStorage.removeItem('auth_token');
                    window.location.href = '/?auth=login';
                }
            }

            return response;
        };

        return () => {
            window.fetch = originalFetch;
        };
    }, [showBannedModal]);

    const refreshSession = useCallback(async (silent = false) => {
        if (!silent) {
            setLoading(true);
        }

        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch('/api/auth/session', {
                method: 'GET',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                cache: 'no-store', // Prevent Next.js/Browser aggressive caching
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
                        setSessionTerminatedReason(data.message || null);
                        localStorage.removeItem('auth_token');
                    }
                    return;
                }

                if (response.status === 403) {
                    const data = await response.json();
                    if (data?.code === 'user_banned') {
                        showBannedModal(data.error);
                    }
                    return;
                }

                // Keep current auth state on transient server/network failures.
                return;
            }

            const data = await response.json();

            const nextUser: AppUser | null = data.user || null;
            const nextRole: string | null = data.role || null;
            const nextSessionId: string | null = data.sessionId || null;
            const nextToken: string | null = data.token || null;

            setUser((current) => (sameUser(current, nextUser) ? current : nextUser));
            setRole((current) => (current === nextRole ? current : nextRole));
            setSessionId((current) => (current === nextSessionId ? current : nextSessionId));

            if (nextUser && (nextToken || localStorage.getItem('auth_token'))) {
                try {
                    localStorage.setItem('auth_user_cache', JSON.stringify({
                        user: nextUser,
                        role: nextRole,
                        sessionId: nextSessionId,
                    }));
                } catch {}
            }

            if (nextToken) {
                if (localStorage.getItem('auth_token') !== nextToken) {
                    localStorage.setItem('auth_token', nextToken);
                }
                setSession((current) =>
                    current?.access_token === nextToken ? current : { access_token: nextToken }
                );
            } else if (!nextUser) {
                setSession((current) => (current ? null : current));
                if (localStorage.getItem('auth_token')) {
                    localStorage.removeItem('auth_token');
                }
                localStorage.removeItem('auth_user_cache');
            }
        } catch {
            // Keep current auth state on transient client-side fetch failures.
        } finally {
            if (!silent) {
                setLoading(false);
            }
        }
    }, [showBannedModal]);

    useEffect(() => {
        refreshSession();
    }, [refreshSession]);

    // Background Presence Heartbeat: Ping activity every 45s while tab is visible
    useEffect(() => {
        if (!user || !sessionId) return;

        const sendHeartbeat = async () => {
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
            const token = localStorage.getItem('auth_token');
            try {
                const res = await fetch('/api/auth/heartbeat', {
                    method: 'POST',
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                });
                if (res.status === 403) {
                    const data = await res.json();
                    if (data?.code === 'user_banned') {
                        showBannedModal(data.error);
                    }
                } else if (res.status === 401) {
                    const data = await res.json();
                    if (data?.code === 'session_revoked') {
                        setUser(null);
                        setSession(null);
                        setSessionId(null);
                        setHasSessionTerminated(true);
                        setSessionTerminatedReason('Your session has been terminated from another device/browser.');
                        localStorage.removeItem('auth_token');
                        localStorage.removeItem('auth_user_cache');
                    }
                }
            } catch {
                // Ignore transient heartbeat failures
            }
        };

        const interval = setInterval(sendHeartbeat, 45000);
        return () => clearInterval(interval);
    }, [user, sessionId, showBannedModal]);

    // Poll full session validity every 30 seconds
    useEffect(() => {
        if (!user || !sessionId) return;

        const interval = setInterval(() => {
            refreshSession(true);
        }, 30000);

        return () => clearInterval(interval);
    }, [user, sessionId, refreshSession]);

    const signOut = async () => {
        const currentSessionId = sessionId;

        // Clear local auth state first so logout feels instant on UI.
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user_cache');
        setUser(null);
        setSession(null);
        setSessionId(null);
        setRole(null);
        setHasSessionTerminated(false);
        setSessionTerminatedReason(null);

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
                sessionTerminatedReason,
                isBannedModalOpen,
                bannedMessage,
                showBannedModal,
                hideBannedModal,
                signOut,
                refreshSession,
            }}
        >
            {children}
            <BannedUserModal
                isOpen={isBannedModalOpen}
                onClose={hideBannedModal}
                message={bannedMessage}
            />
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);

