'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import Image from 'next/image';
import styles from '@/components/Admin/SessionsManager.module.css';
import {
  Smartphone,
  Monitor,
  Tablet,
  Lock,
  Unlock,
  AlertCircle,
  Search,
  UserCheck,
  ShieldAlert,
  Trash2,
  Settings2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LogOut,
  Globe,
  Activity,
  Radio,
  Wifi,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import SessionDetailsModal from '@/components/Admin/SessionDetailsModal';
import ConfirmModal from '@/components/Admin/ConfirmModal';
import { formatDateGMT6, formatDateTimeGMT6 } from '@/lib/date-format';

interface SessionData {
  id: string;
  userId?: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  browserName: string;
  ipAddress: string;
  isLocked: boolean;
  loggedOutAt: string | null;
  createdAt: string;
  lastActivityAt: string;
  deviceHash: string | null;
  deviceLabel: string | null;
  osInfo: string | null;
  lockedByDeviceLabel: string | null;
}

interface BoundDevices {
  desktop: SessionData | null;
  tablet: SessionData | null;
  mobile: SessionData | null;
}

interface UserData {
  id: string;
  fullName: string;
  email: string;
  role: string;
  isBanned: boolean;
  isOnline: boolean;
  isSessionLockedExempt: boolean;
  createdAt: string;
  lastActiveAt: string;
  profileImage?: string | null;
  autoLockSetting: boolean;
  hasUserOverride: boolean;
  userAutoLockSetting: boolean | null;
  activeSessions: SessionData[];
  sessions: SessionData[];
  currentSession: SessionData | null;
  boundDevices?: BoundDevices;
  enrolledCourses: Array<{
    orderId: string;
    courseId: string;
    courseTitle: string;
    courseSlug: string | null;
    enrolledAt: string | null;
    expiresAt: string | null;
  }>;
}

export default function UsersManager() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('lastActive');
  const [selectedSession, setSelectedSession] = useState<SessionData | null>(null);
  const [confirmModalState, setConfirmModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'info' | 'primary';
    iconType?: 'reset' | 'delete' | 'lock' | 'ban' | 'warning';
    onConfirm: () => void | Promise<void>;
    loading?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pageSize = 20;
  const [globalSettings, setGlobalSettings] = useState({
    autoLockFirstBrowser: true,
    allowDesktop: true,
    allowTablet: true,
    allowMobile: true,
    maxConcurrentSessions: 3,
  });
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const getInitials = (name: string) => {
    if (!name) return 'US';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const token = useMemo(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth_token');
    }
    return null;
  }, []);

  const fetchUsers = useCallback(async (page = currentPage, search = debouncedSearch, sort = sortBy, isSilent = false) => {
    if (!isSilent) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
        sortBy: sort,
      });
      if (search) params.set('search', search);

      const response = await fetch(`/api/users?${params.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) throw new Error('Failed to fetch users');

      const data = await response.json();
      setUsers(data.users || []);
      if (data.globalSettings) {
        setGlobalSettings(data.globalSettings);
      }
      if (data.pagination) {
        setCurrentPage(data.pagination.page);
        setTotalPages(data.pagination.totalPages);
        setTotalCount(data.pagination.totalCount);
      }
    } catch (err: any) {
      if (!isSilent) {
        setError(err.message || 'Failed to load users');
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [token, currentPage, debouncedSearch, sortBy]);

  useEffect(() => {
    fetchUsers(1, '', 'lastActive');
  }, [token]);

  // Real-time live presence polling every 12 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchUsers(currentPage, debouncedSearch, sortBy, true);
    }, 12000);

    return () => clearInterval(interval);
  }, [fetchUsers, currentPage, debouncedSearch, sortBy]);

  // Debounce search: wait 400ms after typing stops before fetching
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 400);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQuery]);

  // Fetch when page, debounced search, or sortBy changes
  useEffect(() => {
    fetchUsers(currentPage, debouncedSearch, sortBy);
  }, [currentPage, debouncedSearch, sortBy]);

  const handleUpdateGlobalSetting = async (updatedFields: Partial<typeof globalSettings>) => {
    try {
      const response = await fetch('/api/admin/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(updatedFields),
      });

      if (response.ok) {
        setGlobalSettings((prev) => ({ ...prev, ...updatedFields }));
        fetchUsers();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to update global settings');
      }
    } catch {
      setError('Failed to update global settings');
    }
  };

  const handleLogoutAllSessions = async () => {
    const confirmMessage = 'Are you sure you want to log out all active sessions globally? This will immediately disconnect all users from the application.';
    if (!window.confirm(confirmMessage)) return;

    try {
      const response = await fetch('/api/admin/sessions/logout-all', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (response.ok) {
        alert('All active sessions have been logged out.');
        fetchUsers();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to logout all sessions');
      }
    } catch {
      setError('Failed to logout all sessions');
    }
  };

  const handleLockSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/admin/sessions/${sessionId}/lock`, {
        method: 'PUT',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (response.ok) {
        fetchUsers();
      }
    } catch {
      setError('Failed to lock session');
    }
  };

  const handleLogoutSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/admin/sessions/${sessionId}/logout`, {
        method: 'PUT',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (response.ok) {
        fetchUsers();
      }
    } catch {
      setError('Failed to logout session');
    }
  };

  const handleToggleBan = (userId: string, currentlyBanned: boolean, userName?: string) => {
    const action = currentlyBanned ? 'unban' : 'ban';
    const nameText = userName ? ` for ${userName}` : '';

    setConfirmModalState({
      isOpen: true,
      title: currentlyBanned ? 'Unban Student?' : 'Ban Student Account?',
      message: currentlyBanned
        ? `Are you sure you want to unban${nameText}? They will be immediately allowed to log in to their dashboard and courses.`
        : `Are you sure you want to ban${nameText}? Their active sessions will be terminated and they will be blocked from logging in.`,
      confirmLabel: currentlyBanned ? 'Unban Account' : 'Ban Account',
      variant: currentlyBanned ? 'info' : 'danger',
      iconType: 'ban',
      onConfirm: async () => {
        try {
          setConfirmModalState((prev) => ({ ...prev, loading: true }));
          const response = await fetch('/api/teacher/users/ban', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ userId, action }),
          });

          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || `Failed to ${action} user`);
          }

          setUsers((prevUsers) =>
            prevUsers.map((u) => (u.id === userId ? { ...u, isBanned: !currentlyBanned } : u))
          );
          setConfirmModalState((prev) => ({ ...prev, isOpen: false, loading: false }));
        } catch (err: any) {
          setConfirmModalState((prev) => ({ ...prev, loading: false }));
          setError(err.message || `Failed to ${action} user`);
        }
      },
    });
  };

  const handleToggleExempt = async (userId: string, currentlyExempt: boolean) => {
    try {
      const response = await fetch(`/api/admin/user-session-settings/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ isSessionLockedExempt: !currentlyExempt }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update user exemption setting');
      }

      setUsers((prevUsers) =>
        prevUsers.map((u) => (u.id === userId ? { ...u, isSessionLockedExempt: !currentlyExempt } : u))
      );
    } catch (err: any) {
      setError(err.message || 'Failed to update setting');
    }
  };

  const handleDeleteUser = (userId: string, userName: string) => {
    setConfirmModalState({
      isOpen: true,
      title: 'Permanently Delete User?',
      message: `Are you sure you want to permanently delete "${userName}"? This will delete the student profile, all enrollments, quiz progress, and session records entirely. This action cannot be undone.`,
      confirmLabel: 'Permanently Delete',
      variant: 'danger',
      iconType: 'delete',
      onConfirm: async () => {
        try {
          setConfirmModalState((prev) => ({ ...prev, loading: true }));
          const response = await fetch('/api/admin/students/manage', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ id: userId }),
          });

          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to delete user');
          }

          setUsers((prevUsers) => prevUsers.filter((u) => u.id !== userId));
          setConfirmModalState((prev) => ({ ...prev, isOpen: false, loading: false }));
        } catch (err: any) {
          setConfirmModalState((prev) => ({ ...prev, loading: false }));
          setError(err.message || 'Failed to delete user');
        }
      },
    });
  };

  const handleResetDeviceSlot = (
    userId: string,
    deviceType?: 'desktop' | 'tablet' | 'mobile',
    userName?: string
  ) => {
    const slotTitle = deviceType ? `${deviceType.charAt(0).toUpperCase() + deviceType.slice(1)} Slot` : 'All Device Slots';
    const nameText = userName ? ` for ${userName}` : '';

    setConfirmModalState({
      isOpen: true,
      title: `Reset ${slotTitle}?`,
      message: `Are you sure you want to unbind and reset the ${slotTitle.toLowerCase()}${nameText}? This will immediately free this slot so the student can register their current device on next login.`,
      confirmLabel: 'Reset & Unbind Slot',
      variant: 'danger',
      iconType: 'reset',
      onConfirm: async () => {
        try {
          setConfirmModalState((prev) => ({ ...prev, loading: true }));
          const response = await fetch('/api/admin/sessions/reset-category', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ userId, deviceType }),
          });

          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to reset device slot');
          }

          setConfirmModalState((prev) => ({ ...prev, isOpen: false, loading: false }));
          fetchUsers(currentPage, debouncedSearch, sortBy, true);
        } catch (err: any) {
          setConfirmModalState((prev) => ({ ...prev, loading: false }));
          setError(err.message || 'Failed to reset device slot');
        }
      },
    });
  };

  const getSessionStatus = (session: SessionData) => {
    if (session.isLocked) return 'locked';
    if (session.loggedOutAt) return 'loggedout';
    return 'active';
  };

  // Server-side pagination: users are already filtered and paginated from the API
  const filteredUsers = users;

  if (loading) {
    return <div className={styles.loading}>Loading directory...</div>;
  }

  const renderDeviceSlot = (
    session: SessionData | null | undefined,
    fallbackLabel: string,
    IconComponent: any,
    userId: string,
    deviceType: 'desktop' | 'tablet' | 'mobile',
    userName?: string
  ) => {
    if (!session) {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            borderRadius: '10px',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px dashed var(--glass-border)',
            color: 'var(--text-muted)',
            fontSize: '0.75rem',
            minWidth: '145px',
            minHeight: '70px',
            justifyContent: 'center',
          }}
        >
          <IconComponent size={15} style={{ opacity: 0.4 }} />
          <span>No {fallbackLabel}</span>
        </div>
      );
    }

    const isLocked = session.isLocked;
    const isLoggedOut = !!session.loggedOutAt;
    const label = session.deviceLabel || session.browserName || `${fallbackLabel} Device`;

    return (
      <div
        className={`${styles.sessionBadge} ${isLocked ? styles.locked : styles.active}`}
        onClick={() => setSelectedSession({ ...session, userId })}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          padding: '8px 12px',
          borderRadius: '10px',
          fontSize: '0.75rem',
          border: isLocked
            ? '1px dashed rgba(239, 68, 68, 0.4)'
            : isLoggedOut
            ? '1px solid var(--glass-border)'
            : '1px solid rgba(34, 197, 94, 0.35)',
          background: isLocked
            ? 'rgba(239, 68, 68, 0.06)'
            : isLoggedOut
            ? 'var(--surface-soft)'
            : 'rgba(34, 197, 94, 0.06)',
          cursor: 'pointer',
          minWidth: '145px',
          transition: 'all 0.15s ease',
        }}
      >
        {/* Row 1: Device Icon & Label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
          <IconComponent
            size={14}
            style={{
              color: isLocked ? '#ef4444' : isLoggedOut ? 'var(--text-muted)' : '#22c55e',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: 'var(--foreground)',
              fontSize: '0.78rem',
            }}
            title={label}
          >
            {label}
          </span>
        </div>

        {/* Row 2: IP Address */}
        <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            {session.ipAddress || '127.0.0.1'}
          </span>
        </div>

        {/* Row 3: Status Badge (Active/Idle/Locked) on Left & Reset Button on Right */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            marginTop: '2px',
            paddingTop: '4px',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          }}
        >
          {isLocked ? (
            <span
              style={{
                color: '#ef4444',
                fontWeight: 600,
                fontSize: '0.68rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#ef4444' }} />
              Locked
            </span>
          ) : isLoggedOut ? (
            <span
              style={{
                color: 'var(--text-muted)',
                fontSize: '0.68rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#64748b' }} />
              Idle
            </span>
          ) : (
            <span
              style={{
                color: '#22c55e',
                fontWeight: 600,
                fontSize: '0.68rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#22c55e' }} />
              Active
            </span>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleResetDeviceSlot(userId, deviceType, userName);
            }}
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#ef4444',
              borderRadius: '4px',
              padding: '2px 5px',
              fontSize: '0.64rem',
              cursor: 'pointer',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
            }}
            title={`Reset & Unbind ${fallbackLabel}`}
          >
            <RotateCcw size={9} />
            Reset
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      {error && <div className={styles.error}>{error}</div>}

      {/* Premium Global Settings Panel */}
      <div style={{
        padding: '20px',
        borderRadius: '16px',
        border: '1px solid var(--glass-border)',
        background: 'var(--glass)',
        marginBottom: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings2 size={18} style={{ color: 'var(--primary)' }} />
              Global Session & Device Rules
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Configure application-wide device restrictions, session limits, and security locks.
            </p>
          </div>
          <button
            onClick={handleLogoutAllSessions}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              background: 'rgba(239, 68, 68, 0.08)',
              color: '#ef4444',
              fontWeight: 600,
              fontSize: '0.8rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <LogOut size={14} />
            Logout All Sessions
          </button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
        }}>
          {/* Section 1: Allowed Device Types */}
          <div style={{
            padding: '12px 16px',
            borderRadius: '12px',
            background: 'var(--surface-soft)',
            border: '1px solid var(--glass-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}>
            <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)' }}>
              Allowed Device Categories
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <button
                onClick={() => handleUpdateGlobalSetting({ allowDesktop: !globalSettings.allowDesktop })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid ' + (globalSettings.allowDesktop ? 'rgba(34, 197, 94, 0.3)' : 'var(--glass-border)'),
                  background: globalSettings.allowDesktop ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
                  color: globalSettings.allowDesktop ? '#22c55e' : 'var(--text-muted)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Monitor size={14} />
                Desktop: {globalSettings.allowDesktop ? 'Allowed' : 'Blocked'}
              </button>

              <button
                onClick={() => handleUpdateGlobalSetting({ allowTablet: !globalSettings.allowTablet })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid ' + (globalSettings.allowTablet ? 'rgba(34, 197, 94, 0.3)' : 'var(--glass-border)'),
                  background: globalSettings.allowTablet ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
                  color: globalSettings.allowTablet ? '#22c55e' : 'var(--text-muted)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Tablet size={14} />
                Tablet: {globalSettings.allowTablet ? 'Allowed' : 'Blocked'}
              </button>

              <button
                onClick={() => handleUpdateGlobalSetting({ allowMobile: !globalSettings.allowMobile })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid ' + (globalSettings.allowMobile ? 'rgba(34, 197, 94, 0.3)' : 'var(--glass-border)'),
                  background: globalSettings.allowMobile ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
                  color: globalSettings.allowMobile ? '#22c55e' : 'var(--text-muted)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Smartphone size={14} />
                Mobile: {globalSettings.allowMobile ? 'Allowed' : 'Blocked'}
              </button>
            </div>
          </div>

          {/* Section 2: Session Security Policies */}
          <div style={{
            padding: '12px 16px',
            borderRadius: '12px',
            background: 'var(--surface-soft)',
            border: '1px solid var(--glass-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}>
            <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)' }}>
              Session Limits & Security Locks
            </h4>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Concurrent Session Limit
              </span>
              <div style={{ position: 'relative' }}>
                <select
                  value={globalSettings.maxConcurrentSessions}
                  onChange={(e) => handleUpdateGlobalSetting({ maxConcurrentSessions: parseInt(e.target.value) })}
                  style={{
                    appearance: 'none',
                    padding: '6px 32px 6px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'var(--glass)',
                    color: 'var(--foreground)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    outline: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {[1, 2, 3, 4, 5, 10].map((num) => (
                    <option key={num} value={num} style={{ background: 'var(--surface)', color: 'var(--foreground)' }}>
                      {num} {num === 1 ? 'Session' : 'Sessions'}
                    </option>
                  ))}
                </select>
                <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }}>
                  <ChevronDown size={14} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Auto-Lock First Device
              </span>
              <button
                onClick={() => handleUpdateGlobalSetting({ autoLockFirstBrowser: !globalSettings.autoLockFirstBrowser })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid ' + (globalSettings.autoLockFirstBrowser ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'),
                  background: globalSettings.autoLockFirstBrowser ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  color: globalSettings.autoLockFirstBrowser ? '#22c55e' : '#ef4444',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {globalSettings.autoLockFirstBrowser ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', margin: '8px 0' }}>
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 16px',
          borderRadius: '12px',
          border: '1px solid var(--glass-border)',
          background: 'var(--glass)',
        }}>
          <Search size={18} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search directory by name, email, or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--foreground)',
              outline: 'none',
              width: '100%',
              fontSize: '0.95rem'
            }}
          />
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            borderRadius: '10px',
            background: 'rgba(34, 197, 94, 0.08)',
            border: '1px solid rgba(34, 197, 94, 0.2)',
            fontSize: '0.8rem',
            color: '#22c55e',
            fontWeight: 500,
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#22c55e',
              boxShadow: '0 0 8px #22c55e',
              display: 'inline-block',
            }} />
            <span>Live Sync Active (12s)</span>
            {isRefreshing && <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />}
          </div>

          <div style={{ position: 'relative', minWidth: '180px' }}>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setCurrentPage(1); // Reset to page 1 on sort change
              }}
              style={{
                appearance: 'none',
                width: '100%',
                padding: '10px 40px 10px 16px',
                borderRadius: '12px',
                border: '1px solid var(--glass-border)',
                background: 'var(--glass)',
                color: 'var(--foreground)',
                fontSize: '0.9rem',
                outline: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                transition: 'all 0.2s ease',
              }}
            >
              <option value="lastActive" style={{ background: 'var(--surface)', color: 'var(--foreground)' }}>Sort: Last Active</option>
              <option value="newest" style={{ background: 'var(--surface)', color: 'var(--foreground)' }}>Sort: Newest First</option>
              <option value="oldest" style={{ background: 'var(--surface)', color: 'var(--foreground)' }}>Sort: Oldest First</option>
              <option value="name_asc" style={{ background: 'var(--surface)', color: 'var(--foreground)' }}>Sort: Name (A-Z)</option>
              <option value="name_desc" style={{ background: 'var(--surface)', color: 'var(--foreground)' }}>Sort: Name (Z-A)</option>
            </select>
            <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }}>
              <ChevronDown size={16} />
            </div>
          </div>
        </div>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: '22%' }}>Student & Presence</th>
              <th style={{ width: '16%' }}>Live Network & Activity</th>
              <th style={{ width: '14%' }}>Desktop (1 Slot)</th>
              <th style={{ width: '14%' }}>Tablet (1 Slot)</th>
              <th style={{ width: '14%' }}>Mobile (1 Slot)</th>
              <th style={{ width: '10%' }}>Account Controls</th>
              <th style={{ width: '10%', textAlign: 'right' }}>Session Controls</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((userObj) => {
              const boundDesktop = userObj.boundDevices?.desktop || (userObj.sessions || []).find((s) => s.deviceType === 'desktop');
              const boundTablet = userObj.boundDevices?.tablet || (userObj.sessions || []).find((s) => s.deviceType === 'tablet');
              const boundMobile = userObj.boundDevices?.mobile || (userObj.sessions || []).find((s) => s.deviceType === 'mobile');

              const latestSession = userObj.currentSession || [...(userObj.sessions || [])].sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime())[0];
              const lastActiveText = latestSession ? formatDateTimeGMT6(latestSession.lastActivityAt) : 'Never';

              return (
                <tr key={userObj.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: 'var(--surface-soft)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        color: 'var(--primary)',
                        position: 'relative',
                        overflow: 'hidden',
                        flexShrink: 0,
                        border: '1px solid var(--glass-border)'
                      }}>
                        {userObj.profileImage ? (
                          <Image src={userObj.profileImage} alt={userObj.fullName} fill style={{ objectFit: 'cover' }} unoptimized />
                        ) : getInitials(userObj.fullName)}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span className={styles.nameCell}>{userObj.fullName}</span>
                          
                          {/* Live Online / Offline Presence Badge */}
                          {userObj.isOnline ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              color: '#22c55e',
                              background: 'rgba(34, 197, 94, 0.12)',
                              border: '1px solid rgba(34, 197, 94, 0.3)',
                              padding: '2px 6px',
                              borderRadius: '10px',
                            }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
                              Online
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.68rem',
                              fontWeight: 500,
                              color: 'var(--text-muted)',
                              background: 'rgba(255, 255, 255, 0.04)',
                              border: '1px solid var(--glass-border)',
                              padding: '2px 6px',
                              borderRadius: '10px',
                            }}>
                              <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#64748b' }} />
                              Offline
                            </span>
                          )}

                          {userObj.isBanned && (
                            <span style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              color: '#ef4444',
                              background: 'rgba(239, 68, 68, 0.12)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              padding: '2px 6px',
                              borderRadius: '10px'
                            }}>
                              Banned
                            </span>
                          )}
                        </div>
                        <span className={styles.emailCell}>{userObj.email}</span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Joined {formatDateGMT6(userObj.createdAt)}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Live Network & Activity Column */}
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Wifi size={13} style={{ color: userObj.isOnline ? '#22c55e' : 'var(--text-muted)' }} />
                        <code style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)' }}>
                          {latestSession?.ipAddress || '127.0.0.1'}
                        </code>
                      </div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {latestSession?.browserName || 'Browser'} • {latestSession?.osInfo || 'OS'}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {lastActiveText}
                      </span>
                    </div>
                  </td>

                  {/* 3 Bound Device Category Slots */}
                  <td>
                    {renderDeviceSlot(boundDesktop, 'Desktop', Monitor, userObj.id, 'desktop', userObj.fullName || userObj.email)}
                  </td>
                  <td>
                    {renderDeviceSlot(boundTablet, 'Tablet', Tablet, userObj.id, 'tablet', userObj.fullName || userObj.email)}
                  </td>
                  <td>
                    {renderDeviceSlot(boundMobile, 'Mobile', Smartphone, userObj.id, 'mobile', userObj.fullName || userObj.email)}
                  </td>

                  {/* Account Actions */}
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '125px' }}>
                      <button
                        className={styles.actionBtn}
                        onClick={() => handleToggleBan(userObj.id, userObj.isBanned, userObj.fullName || userObj.email)}
                        title={userObj.isBanned ? "Unban user and allow login" : "Ban user and prevent login"}
                        style={{
                          color: userObj.isBanned ? '#22c55e' : '#f97316',
                          borderColor: userObj.isBanned ? 'rgba(34, 197, 94, 0.3)' : 'rgba(249, 115, 22, 0.3)',
                          background: userObj.isBanned ? 'rgba(34, 197, 94, 0.08)' : 'rgba(249, 115, 22, 0.08)',
                          width: '100%',
                          justifyContent: 'flex-start',
                        }}
                      >
                        {userObj.isBanned ? <UserCheck size={15} /> : <ShieldAlert size={15} />}
                        <span>{userObj.isBanned ? 'Unban' : 'Ban'}</span>
                      </button>

                      <button
                        className={styles.actionBtn}
                        onClick={() => handleDeleteUser(userObj.id, userObj.fullName || userObj.email)}
                        title="Permanently delete user and cascade purge all records"
                        style={{
                          color: '#ef4444',
                          borderColor: 'rgba(239, 68, 68, 0.3)',
                          background: 'rgba(239, 68, 68, 0.08)',
                          width: '100%',
                          justifyContent: 'flex-start',
                        }}
                      >
                        <Trash2 size={15} />
                        <span>Delete</span>
                      </button>
                    </div>
                  </td>

                  {/* Session Actions */}
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '125px', marginLeft: 'auto' }}>
                      <button
                        className={styles.actionBtn}
                        onClick={() => handleToggleExempt(userObj.id, userObj.isSessionLockedExempt)}
                        title={userObj.isSessionLockedExempt ? "Enforce device constraints for this student" : "Exempt student from all device & session limits"}
                        style={{
                          color: userObj.isSessionLockedExempt ? '#38bdf8' : 'var(--text-muted)',
                          borderColor: userObj.isSessionLockedExempt ? 'rgba(56, 189, 248, 0.3)' : 'var(--glass-border)',
                          background: userObj.isSessionLockedExempt ? 'rgba(56, 189, 248, 0.08)' : 'transparent',
                          width: '100%',
                          justifyContent: 'flex-start',
                        }}
                      >
                        {userObj.isSessionLockedExempt ? <Unlock size={15} /> : <Lock size={15} />}
                        <span>{userObj.isSessionLockedExempt ? 'Exempted' : 'Exempt'}</span>
                      </button>

                      {userObj.activeSessions.length > 0 && (
                        <button
                          className={styles.actionBtn}
                          onClick={() =>
                            userObj.activeSessions.forEach((s) => handleLogoutSession(s.id))
                          }
                          title="Force logout active session"
                          style={{ width: '100%', justifyContent: 'flex-start' }}
                        >
                          <LogOut size={15} />
                          <span>Logout</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredUsers.length === 0 && (
          <div className={styles.emptyState}>
            <AlertCircle size={32} />
            <p>No matching users found</p>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderTop: '1px solid var(--glass-border)',
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
          }}>
            <span>
              Showing {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, totalCount)} of {totalCount} students
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  border: '1px solid var(--glass-border)',
                  background: currentPage <= 1 ? 'transparent' : 'var(--surface-soft)',
                  color: currentPage <= 1 ? 'var(--text-muted)' : 'var(--foreground)',
                  cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                  opacity: currentPage <= 1 ? 0.4 : 1,
                }}
              >
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontWeight: 600, color: 'var(--foreground)', minWidth: '80px', textAlign: 'center' }}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  border: '1px solid var(--glass-border)',
                  background: currentPage >= totalPages ? 'transparent' : 'var(--surface-soft)',
                  color: currentPage >= totalPages ? 'var(--text-muted)' : 'var(--foreground)',
                  cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                  opacity: currentPage >= totalPages ? 0.4 : 1,
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedSession && (
        <SessionDetailsModal
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
          onLock={() => {
            handleLockSession(selectedSession.id);
            setSelectedSession(null);
          }}
          onLogout={() => {
            handleLogoutSession(selectedSession.id);
            setSelectedSession(null);
          }}
          onRename={() => {
            fetchUsers();
          }}
          onResetSlot={selectedSession.userId ? () => {
            handleResetDeviceSlot(selectedSession.userId!, selectedSession.deviceType);
            setSelectedSession(null);
          } : undefined}
        />
      )}

      {/* Styled Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModalState.isOpen}
        onClose={() => setConfirmModalState((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModalState.onConfirm}
        title={confirmModalState.title}
        message={confirmModalState.message}
        confirmLabel={confirmModalState.confirmLabel}
        cancelLabel={confirmModalState.cancelLabel}
        variant={confirmModalState.variant}
        iconType={confirmModalState.iconType}
        loading={confirmModalState.loading}
      />
    </div>
  );
}
