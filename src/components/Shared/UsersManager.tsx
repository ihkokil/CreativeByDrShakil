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
  ChevronUp,
  LogOut,
  Globe,
  Activity,
  Radio,
  Wifi,
  RefreshCw,
  RotateCcw,
  Users,
  ShieldCheck,
  Layers,
  Sliders,
  X,
  Filter,
  Sparkles,
  CheckCircle2,
  Shield,
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
  const [isPolicyPanelOpen, setIsPolicyPanelOpen] = useState(true);
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'online' | 'desktop' | 'tablet' | 'mobile' | 'banned' | 'exempt'>('all');
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Compute live directory statistics
  const stats = useMemo(() => {
    let online = 0;
    let banned = 0;
    let exempt = 0;
    let boundDesktops = 0;
    let boundTablets = 0;
    let boundMobiles = 0;
    let activeSessions = 0;

    users.forEach((u) => {
      if (u.isOnline) online++;
      if (u.isBanned) banned++;
      if (u.isSessionLockedExempt) exempt++;

      if (u.boundDevices?.desktop || (u.sessions || []).some((s) => s.deviceType === 'desktop')) {
        boundDesktops++;
      }
      if (u.boundDevices?.tablet || (u.sessions || []).some((s) => s.deviceType === 'tablet')) {
        boundTablets++;
      }
      if (u.boundDevices?.mobile || (u.sessions || []).some((s) => s.deviceType === 'mobile')) {
        boundMobiles++;
      }

      (u.sessions || []).forEach((ds) => {
        if (!ds.loggedOutAt && !ds.isLocked) activeSessions++;
      });
    });

    return {
      total: totalCount || users.length,
      online,
      banned,
      exempt,
      boundDesktops,
      boundTablets,
      boundMobiles,
      activeSessions,
      totalBoundDevices: boundDesktops + boundTablets + boundMobiles,
    };
  }, [users, totalCount]);

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

  const handleLogoutAllSessions = () => {
    setConfirmModalState({
      isOpen: true,
      title: 'Logout All Sessions Globally?',
      message: 'Are you sure you want to log out all active sessions across every student? This will immediately terminate all active logins and require students to sign in again.',
      confirmLabel: 'Force Logout All',
      variant: 'danger',
      iconType: 'lock',
      onConfirm: async () => {
        try {
          setConfirmModalState((prev) => ({ ...prev, loading: true }));
          const response = await fetch('/api/admin/sessions/logout-all', {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });

          if (response.ok) {
            setConfirmModalState((prev) => ({ ...prev, isOpen: false, loading: false }));
            fetchUsers(currentPage, debouncedSearch, sortBy, true);
          } else {
            const data = await response.json();
            throw new Error(data.error || 'Failed to logout all sessions');
          }
        } catch (err: any) {
          setConfirmModalState((prev) => ({ ...prev, loading: false }));
          setError(err.message || 'Failed to logout all sessions');
        }
      },
    });
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

  // Filter loaded users based on active category/status tab
  const filteredUsers = useMemo(() => {
    if (activeFilterTab === 'all') return users;
    if (activeFilterTab === 'online') return users.filter((u) => u.isOnline);
    if (activeFilterTab === 'banned') return users.filter((u) => u.isBanned);
    if (activeFilterTab === 'exempt') return users.filter((u) => u.isSessionLockedExempt);
    if (activeFilterTab === 'desktop') {
      return users.filter((u) => u.boundDevices?.desktop || (u.sessions || []).some((s) => s.deviceType === 'desktop'));
    }
    if (activeFilterTab === 'tablet') {
      return users.filter((u) => u.boundDevices?.tablet || (u.sessions || []).some((s) => s.deviceType === 'tablet'));
    }
    if (activeFilterTab === 'mobile') {
      return users.filter((u) => u.boundDevices?.mobile || (u.sessions || []).some((s) => s.deviceType === 'mobile'));
    }
    return users;
  }, [users, activeFilterTab]);

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

      {/* 1. Live KPI Summary Bar */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiIconWrapper} style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#818cf8', border: '1px solid rgba(99, 102, 241, 0.25)' }}>
            <Users size={20} />
          </div>
          <div>
            <div className={styles.kpiValue}>{stats.total}</div>
            <div className={styles.kpiLabel}>Total Students</div>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIconWrapper} style={{ background: 'rgba(34, 197, 94, 0.12)', color: '#22c55e', border: '1px solid rgba(34, 197, 94, 0.25)' }}>
            <Activity size={20} />
          </div>
          <div>
            <div className={styles.kpiValue} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {stats.online}
              <span className={styles.pulsingDot} />
            </div>
            <div className={styles.kpiLabel}>Live Online Now</div>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIconWrapper} style={{ background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
            <ShieldCheck size={20} />
          </div>
          <div>
            <div className={styles.kpiValue}>{stats.totalBoundDevices}</div>
            <div className={styles.kpiLabel}>Bound Hardware Slots</div>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIconWrapper} style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
            <ShieldAlert size={20} />
          </div>
          <div>
            <div className={styles.kpiValue}>
              {stats.banned} <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)' }}>/ {stats.exempt} exempt</span>
            </div>
            <div className={styles.kpiLabel}>Banned / Exempt</div>
          </div>
        </div>
      </div>

      {/* 2. Collapsible Global Policy Card */}
      <div style={{
        borderRadius: '16px',
        border: '1px solid var(--glass-border)',
        background: 'var(--glass)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        overflow: 'hidden',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
        transition: 'all 0.2s ease',
      }}>
        {/* Policy Header Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '16px 20px',
          background: isPolicyPanelOpen ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
          borderBottom: isPolicyPanelOpen ? '1px solid var(--glass-border)' : 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(237, 28, 40, 0.12)',
              color: 'var(--primary)',
              border: '1px solid rgba(237, 28, 40, 0.25)',
            }}>
              <Sliders size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)' }}>
                  Global Session & Device Security Rules
                </h3>
                <span style={{
                  fontSize: '0.72rem',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: 'rgba(34, 197, 94, 0.12)',
                  color: '#22c55e',
                  fontWeight: 600,
                  border: '1px solid rgba(34, 197, 94, 0.25)',
                }}>
                  Enforced
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Configure application-wide hardware category allowances, concurrency limits & automatic locks.
              </p>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handleLogoutAllSessions}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '10px',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                fontWeight: 600,
                fontSize: '0.78rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              title="Terminate all active student sessions platform-wide"
            >
              <LogOut size={14} />
              Logout All Sessions
            </button>

            <button
              onClick={() => setIsPolicyPanelOpen(!isPolicyPanelOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 12px',
                borderRadius: '10px',
                border: '1px solid var(--glass-border)',
                background: 'var(--surface-soft)',
                color: 'var(--foreground)',
                fontWeight: 600,
                fontSize: '0.78rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {isPolicyPanelOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              <span>{isPolicyPanelOpen ? 'Hide Policy' : 'Configure Policy'}</span>
            </button>
          </div>
        </div>

        {/* Collapsible Content */}
        {isPolicyPanelOpen && (
          <div style={{
            padding: '18px 20px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '16px',
          }}>
            {/* Left: Allowed Device Categories (3 Interactive Tile Switches) */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              padding: '14px 16px',
              borderRadius: '12px',
              background: 'var(--surface-soft)',
              border: '1px solid var(--glass-border)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: '0.86rem', fontWeight: 700, color: 'var(--foreground)' }}>
                  Allowed Device Categories
                </h4>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Click to toggle</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Desktop Switch Tile */}
                <div
                  className={`${styles.deviceTile} ${globalSettings.allowDesktop ? styles.deviceTileActive : ''}`}
                  onClick={() => handleUpdateGlobalSetting({ allowDesktop: !globalSettings.allowDesktop })}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: globalSettings.allowDesktop ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                      color: globalSettings.allowDesktop ? '#22c55e' : 'var(--text-muted)',
                    }}>
                      <Monitor size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--foreground)' }}>Desktop & Laptop</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Windows, macOS, Linux PCs</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: globalSettings.allowDesktop ? '#22c55e' : '#ef4444',
                    }}>
                      {globalSettings.allowDesktop ? 'Allowed' : 'Blocked'}
                    </span>
                    <div className={`${styles.switchTrack} ${globalSettings.allowDesktop ? styles.switchTrackActive : ''}`}>
                      <div className={`${styles.switchThumb} ${globalSettings.allowDesktop ? styles.switchThumbActive : ''}`} />
                    </div>
                  </div>
                </div>

                {/* Tablet Switch Tile */}
                <div
                  className={`${styles.deviceTile} ${globalSettings.allowTablet ? styles.deviceTileActive : ''}`}
                  onClick={() => handleUpdateGlobalSetting({ allowTablet: !globalSettings.allowTablet })}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: globalSettings.allowTablet ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                      color: globalSettings.allowTablet ? '#22c55e' : 'var(--text-muted)',
                    }}>
                      <Tablet size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--foreground)' }}>Tablet Computers</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>iPad, Android Tablets</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: globalSettings.allowTablet ? '#22c55e' : '#ef4444',
                    }}>
                      {globalSettings.allowTablet ? 'Allowed' : 'Blocked'}
                    </span>
                    <div className={`${styles.switchTrack} ${globalSettings.allowTablet ? styles.switchTrackActive : ''}`}>
                      <div className={`${styles.switchThumb} ${globalSettings.allowTablet ? styles.switchThumbActive : ''}`} />
                    </div>
                  </div>
                </div>

                {/* Mobile Switch Tile */}
                <div
                  className={`${styles.deviceTile} ${globalSettings.allowMobile ? styles.deviceTileActive : ''}`}
                  onClick={() => handleUpdateGlobalSetting({ allowMobile: !globalSettings.allowMobile })}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: globalSettings.allowMobile ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                      color: globalSettings.allowMobile ? '#22c55e' : 'var(--text-muted)',
                    }}>
                      <Smartphone size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--foreground)' }}>Mobile Smartphones</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>iOS iPhones, Android Phones</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: globalSettings.allowMobile ? '#22c55e' : '#ef4444',
                    }}>
                      {globalSettings.allowMobile ? 'Allowed' : 'Blocked'}
                    </span>
                    <div className={`${styles.switchTrack} ${globalSettings.allowMobile ? styles.switchTrackActive : ''}`}>
                      <div className={`${styles.switchThumb} ${globalSettings.allowMobile ? styles.switchThumbActive : ''}`} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Concurrency & Lock Policy Controls */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '14px 16px',
              borderRadius: '12px',
              background: 'var(--surface-soft)',
              border: '1px solid var(--glass-border)',
              justifyContent: 'space-between',
            }}>
              <div>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.86rem', fontWeight: 700, color: 'var(--foreground)' }}>
                  Session Limits & Automated Locks
                </h4>

                {/* Concurrent Session Limit */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--glass-border)',
                  marginBottom: '10px',
                }}>
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--foreground)' }}>
                      Concurrent Session Limit
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Max simultaneous active devices per student
                    </div>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <select
                      value={globalSettings.maxConcurrentSessions}
                      onChange={(e) => handleUpdateGlobalSetting({ maxConcurrentSessions: parseInt(e.target.value) })}
                      className={styles.customSelect}
                    >
                      <option value={1} style={{ background: '#18181b', color: '#fff' }}>1 Session (Strict 1-Device)</option>
                      <option value={2} style={{ background: '#18181b', color: '#fff' }}>2 Sessions</option>
                      <option value={3} style={{ background: '#18181b', color: '#fff' }}>3 Sessions</option>
                      <option value={5} style={{ background: '#18181b', color: '#fff' }}>5 Sessions</option>
                      <option value={10} style={{ background: '#18181b', color: '#fff' }}>10 Sessions</option>
                    </select>
                    <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }}>
                      <ChevronDown size={14} />
                    </div>
                  </div>
                </div>

                {/* Auto-Lock First Device Switch */}
                <div
                  className={`${styles.deviceTile} ${globalSettings.autoLockFirstBrowser ? styles.deviceTileActive : ''}`}
                  onClick={() => handleUpdateGlobalSetting({ autoLockFirstBrowser: !globalSettings.autoLockFirstBrowser })}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: globalSettings.autoLockFirstBrowser ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                      color: globalSettings.autoLockFirstBrowser ? '#22c55e' : 'var(--text-muted)',
                    }}>
                      <Lock size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--foreground)' }}>
                        Auto-Lock Previous Devices
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Terminate inactive slots on new device registration
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: globalSettings.autoLockFirstBrowser ? '#22c55e' : '#ef4444',
                    }}>
                      {globalSettings.autoLockFirstBrowser ? 'Enabled' : 'Disabled'}
                    </span>
                    <div className={`${styles.switchTrack} ${globalSettings.autoLockFirstBrowser ? styles.switchTrackActive : ''}`}>
                      <div className={`${styles.switchThumb} ${globalSettings.autoLockFirstBrowser ? styles.switchThumbActive : ''}`} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Search, Filter Pills & Live Sync Toolbar */}
      <div className={styles.toolbarCard}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search Input */}
          <div className={styles.searchBox}>
            <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search directory by student name, email, IP address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--foreground)',
                outline: 'none',
                width: '100%',
                fontSize: '0.88rem',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Live Sync Badge & Manual Refresh */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              borderRadius: '10px',
              background: 'rgba(34, 197, 94, 0.08)',
              border: '1px solid rgba(34, 197, 94, 0.25)',
              fontSize: '0.78rem',
              color: '#22c55e',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}>
              <span className={styles.pulsingDot} />
              <span>Live Sync (12s)</span>
            </div>

            <button
              onClick={() => fetchUsers(currentPage, debouncedSearch, sortBy, true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                border: '1px solid var(--glass-border)',
                background: 'var(--surface-soft)',
                color: 'var(--foreground)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              title="Refresh student list immediately"
            >
              <RefreshCw size={14} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
            </button>

            {/* Sort Dropdown */}
            <div style={{ position: 'relative', minWidth: '160px' }}>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setCurrentPage(1);
                }}
                className={styles.customSelect}
                style={{ width: '100%' }}
              >
                <option value="lastActive" style={{ background: '#18181b', color: '#fff' }}>Sort: Last Active</option>
                <option value="newest" style={{ background: '#18181b', color: '#fff' }}>Sort: Newest First</option>
                <option value="oldest" style={{ background: '#18181b', color: '#fff' }}>Sort: Oldest First</option>
                <option value="name_asc" style={{ background: '#18181b', color: '#fff' }}>Sort: Name (A-Z)</option>
                <option value="name_desc" style={{ background: '#18181b', color: '#fff' }}>Sort: Name (Z-A)</option>
              </select>
              <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }}>
                <ChevronDown size={14} />
              </div>
            </div>
          </div>
        </div>

        {/* Filter Pills */}
        <div className={styles.filterPillsRow}>
          <button
            className={`${styles.filterPill} ${activeFilterTab === 'all' ? styles.filterPillActive : ''}`}
            onClick={() => setActiveFilterTab('all')}
          >
            All Students ({stats.total})
          </button>
          <button
            className={`${styles.filterPill} ${activeFilterTab === 'online' ? styles.filterPillActive : ''}`}
            onClick={() => setActiveFilterTab('online')}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: activeFilterTab === 'online' ? '#fff' : '#22c55e' }} />
            Online Now ({stats.online})
          </button>
          <button
            className={`${styles.filterPill} ${activeFilterTab === 'desktop' ? styles.filterPillActive : ''}`}
            onClick={() => setActiveFilterTab('desktop')}
          >
            <Monitor size={12} />
            Desktop ({stats.boundDesktops})
          </button>
          <button
            className={`${styles.filterPill} ${activeFilterTab === 'tablet' ? styles.filterPillActive : ''}`}
            onClick={() => setActiveFilterTab('tablet')}
          >
            <Tablet size={12} />
            Tablet ({stats.boundTablets})
          </button>
          <button
            className={`${styles.filterPill} ${activeFilterTab === 'mobile' ? styles.filterPillActive : ''}`}
            onClick={() => setActiveFilterTab('mobile')}
          >
            <Smartphone size={12} />
            Mobile ({stats.boundMobiles})
          </button>
          <button
            className={`${styles.filterPill} ${activeFilterTab === 'banned' ? styles.filterPillActive : ''}`}
            onClick={() => setActiveFilterTab('banned')}
          >
            <ShieldAlert size={12} />
            Banned ({stats.banned})
          </button>
          <button
            className={`${styles.filterPill} ${activeFilterTab === 'exempt' ? styles.filterPillActive : ''}`}
            onClick={() => setActiveFilterTab('exempt')}
          >
            <ShieldCheck size={12} />
            Exempt ({stats.exempt})
          </button>
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
              <th style={{ width: '20%', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <Users size={36} style={{ opacity: 0.3, color: 'var(--primary)' }} />
                    <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--foreground)' }}>No students found</span>
                    <span style={{ fontSize: '0.82rem' }}>
                      {searchQuery
                        ? `No results match "${searchQuery}"`
                        : `No student accounts match the active "${activeFilterTab}" filter`}
                    </span>
                    {(searchQuery || activeFilterTab !== 'all') && (
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setActiveFilterTab('all');
                        }}
                        style={{
                          marginTop: '8px',
                          padding: '6px 14px',
                          borderRadius: '8px',
                          border: '1px solid var(--glass-border)',
                          background: 'var(--surface-soft)',
                          color: 'var(--foreground)',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Reset All Filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredUsers.map((userObj) => {
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

                  {/* Account & Session Actions */}
                  <td style={{ textAlign: 'right' }}>
                    <div className={styles.userActionsWrapper}>
                      <button
                        className={styles.actionBtn}
                        onClick={() => handleToggleBan(userObj.id, userObj.isBanned, userObj.fullName || userObj.email)}
                        title={userObj.isBanned ? "Unban user and allow login" : "Ban user and prevent login"}
                        style={{
                          color: userObj.isBanned ? '#22c55e' : '#f97316',
                          borderColor: userObj.isBanned ? 'rgba(34, 197, 94, 0.3)' : 'rgba(249, 115, 22, 0.3)',
                          background: userObj.isBanned ? 'rgba(34, 197, 94, 0.08)' : 'rgba(249, 115, 22, 0.08)',
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
                        }}
                      >
                        <Trash2 size={15} />
                        <span>Delete</span>
                      </button>

                      <button
                        className={styles.actionBtn}
                        onClick={() => handleToggleExempt(userObj.id, userObj.isSessionLockedExempt)}
                        title={userObj.isSessionLockedExempt ? "Enforce device constraints for this student" : "Exempt student from all device & session limits"}
                        style={{
                          color: userObj.isSessionLockedExempt ? '#38bdf8' : 'var(--text-muted)',
                          borderColor: userObj.isSessionLockedExempt ? 'rgba(56, 189, 248, 0.3)' : 'var(--glass-border)',
                          background: userObj.isSessionLockedExempt ? 'rgba(56, 189, 248, 0.08)' : 'transparent',
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
                        >
                          <LogOut size={15} />
                          <span>Logout</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            }))}
          </tbody>
        </table>

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
