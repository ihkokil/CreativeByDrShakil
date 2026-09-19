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
  BookOpen,
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
  desktops?: SessionData[];
  tablets?: SessionData[];
  mobiles?: SessionData[];
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
  const [initialLoading, setInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
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
  const pageSize = 20;
  const [globalSettings, setGlobalSettings] = useState({
    autoLockFirstBrowser: true,
    allowDesktop: true,
    allowTablet: true,
    allowMobile: true,
    maxConcurrentSessions: 1,
    maxDesktopSessions: 1,
    maxTabletSessions: 1,
    maxMobileSessions: 1,
  });
  const [isPolicyPanelOpen, setIsPolicyPanelOpen] = useState(true);
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'online' | 'desktop' | 'tablet' | 'mobile' | 'banned' | 'exempt'>('all');
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef(true);

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

      const uDesktops = u.boundDevices?.desktops?.length || (u.boundDevices?.desktop || (u.sessions || []).some((s) => s.deviceType === 'desktop') ? 1 : 0);
      const uTablets = u.boundDevices?.tablets?.length || (u.boundDevices?.tablet || (u.sessions || []).some((s) => s.deviceType === 'tablet') ? 1 : 0);
      const uMobiles = u.boundDevices?.mobiles?.length || (u.boundDevices?.mobile || (u.sessions || []).some((s) => s.deviceType === 'mobile') ? 1 : 0);

      boundDesktops += uDesktops;
      boundTablets += uTablets;
      boundMobiles += uMobiles;

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

  const getRelativeActivity = (dateStr: string | null | undefined): string => {
    if (!dateStr) return 'Never';
    const diffMs = Date.now() - new Date(dateStr).getTime();
    if (diffMs < 0 || diffMs < 60 * 1000) return 'Just now';
    const mins = Math.floor(diffMs / (60 * 1000));
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return formatDateGMT6(dateStr);
  };

  const token = useMemo(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth_token');
    }
    return null;
  }, []);

  const fetchUsers = useCallback(
    async (
      page = currentPage,
      search = debouncedSearch,
      sort = sortBy,
      mode: 'initial' | 'search' | 'background' = 'search'
    ) => {
      if (mode === 'initial') {
        setInitialLoading(true);
      } else if (mode === 'background') {
        setIsRefreshing(true);
      } else {
        setIsFetching(true);
      }
      setError('');
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(pageSize),
          sortBy: sort,
        });
        if (search) params.set('search', search);

        const authToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
        const response = await fetch(`/api/users?${params.toString()}`, {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
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
        if (mode !== 'background') {
          setError(err.message || 'Failed to load users');
        }
      } finally {
        setInitialLoading(false);
        setIsFetching(false);
        setIsRefreshing(false);
      }
    },
    [currentPage, debouncedSearch, sortBy]
  );

  // Debounce search: wait 350ms after typing stops before updating debouncedSearch
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 350);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

  // Fetch users when page, debounced search, or sortBy changes
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      fetchUsers(1, '', 'lastActive', 'initial');
    } else {
      fetchUsers(currentPage, debouncedSearch, sortBy, 'search');
    }
  }, [currentPage, debouncedSearch, sortBy]);

  // Real-time live presence polling every 12 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchUsers(currentPage, debouncedSearch, sortBy, 'background');
    }, 12000);

    return () => clearInterval(interval);
  }, [fetchUsers, currentPage, debouncedSearch, sortBy]);

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
            fetchUsers(currentPage, debouncedSearch, sortBy, 'background');
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

  const handleUnbindAllDevices = () => {
    setConfirmModalState({
      isOpen: true,
      title: 'Unbind All Devices for All Users?',
      message: 'Are you sure you want to reset and unlink all bound devices across every student? This will clear all bound device hardware slots and allow students to bind new devices upon their next login.',
      confirmLabel: 'Unbind All Devices',
      variant: 'danger',
      iconType: 'reset',
      onConfirm: async () => {
        try {
          setConfirmModalState((prev) => ({ ...prev, loading: true }));
          const response = await fetch('/api/admin/sessions/unbind-all', {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });

          if (response.ok) {
            setConfirmModalState((prev) => ({ ...prev, isOpen: false, loading: false }));
            fetchUsers(currentPage, debouncedSearch, sortBy, 'background');
          } else {
            const data = await response.json();
            throw new Error(data.error || 'Failed to unbind all devices');
          }
        } catch (err: any) {
          setConfirmModalState((prev) => ({ ...prev, loading: false }));
          setError(err.message || 'Failed to unbind all devices');
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
    userName?: string,
    sessionId?: string,
    slotNumber?: number | null
  ) => {
    const slotNumText = slotNumber ? ` Slot #${slotNumber}` : '';
    const slotTitle = deviceType ? `${deviceType.charAt(0).toUpperCase() + deviceType.slice(1)}${slotNumText}` : 'All Device Slots';
    const nameText = userName ? ` for ${userName}` : '';

    setConfirmModalState({
      isOpen: true,
      title: `Reset ${slotTitle}?`,
      message: `Are you sure you want to unbind and reset the ${slotTitle.toLowerCase()}${nameText}? This will immediately free this device slot so the student can register their current device on next login.`,
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
            body: JSON.stringify({ userId, deviceType, sessionId }),
          });

          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to reset device slot');
          }

          setConfirmModalState((prev) => ({ ...prev, isOpen: false, loading: false }));
          fetchUsers(currentPage, debouncedSearch, sortBy, 'background');
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
      return users.filter((u) => (u.boundDevices?.desktops?.length ?? 0) > 0 || u.boundDevices?.desktop || (u.sessions || []).some((s) => s.deviceType === 'desktop'));
    }
    if (activeFilterTab === 'tablet') {
      return users.filter((u) => (u.boundDevices?.tablets?.length ?? 0) > 0 || u.boundDevices?.tablet || (u.sessions || []).some((s) => s.deviceType === 'tablet'));
    }
    if (activeFilterTab === 'mobile') {
      return users.filter((u) => (u.boundDevices?.mobiles?.length ?? 0) > 0 || u.boundDevices?.mobile || (u.sessions || []).some((s) => s.deviceType === 'mobile'));
    }
    return users;
  }, [users, activeFilterTab]);

  if (initialLoading) {
    return <div className={styles.loading}>Loading directory...</div>;
  }

  const renderDeviceSlot = (
    session: SessionData | null | undefined,
    fallbackLabel: string,
    IconComponent: any,
    userId: string,
    deviceType: 'desktop' | 'tablet' | 'mobile',
    userName?: string,
    slotNumber?: number | null
  ) => {
    const slotSuffix = slotNumber ? ` #${slotNumber}` : '';
    if (!session) {
      return (
        <div
          key={`${deviceType}-empty-${slotNumber || 1}`}
          className={styles.emptySlotCard}
          title={`No ${fallbackLabel} registered in Slot ${slotNumber || 1}`}
        >
          <IconComponent size={14} style={{ opacity: 0.35 }} />
          <span>Empty {fallbackLabel}{slotSuffix}</span>
        </div>
      );
    }

    const isLocked = session.isLocked;
    const isLoggedOut = !!session.loggedOutAt;
    const sessionTime = new Date(session.lastActivityAt || session.createdAt).getTime();
    const nowMs = Date.now();
    const isOnlineNow = !isLocked && !isLoggedOut && (nowMs - sessionTime) <= 5 * 60 * 1000;
    const label = session.deviceLabel || session.browserName || `${fallbackLabel} Device`;
    const relativeTime = getRelativeActivity(session.lastActivityAt || session.createdAt);

    return (
      <div
        key={session.id || `${deviceType}-${slotNumber || 1}`}
        className={styles.sessionBadge}
        onClick={() => setSelectedSession({ ...session, userId })}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          padding: '8px 12px',
          borderRadius: '10px',
          fontSize: '0.75rem',
          border: isLocked
            ? '1px dashed rgba(239, 68, 68, 0.5)'
            : isOnlineNow
            ? '1px solid rgba(34, 197, 94, 0.5)'
            : isLoggedOut
            ? '1px solid var(--glass-border)'
            : '1px solid rgba(56, 189, 248, 0.35)',
          background: isLocked
            ? 'rgba(239, 68, 68, 0.08)'
            : isOnlineNow
            ? 'rgba(34, 197, 94, 0.08)'
            : isLoggedOut
            ? 'var(--surface-soft)'
            : 'color-mix(in srgb, #38bdf8 10%, var(--card-bg))',
          boxShadow: isOnlineNow ? '0 0 10px rgba(34, 197, 94, 0.15)' : 'none',
          cursor: 'pointer',
          minWidth: '145px',
          transition: 'all 0.15s ease',
        }}
      >
        {/* Row 1: Device Icon & Label & Slot Indicator & Online Dot */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
          <IconComponent
            size={14}
            style={{
              color: isLocked ? '#ef4444' : isOnlineNow ? '#22c55e' : isLoggedOut ? 'var(--text-muted)' : '#38bdf8',
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
              flex: 1,
            }}
            title={`${label}${slotSuffix}`}
          >
            {label}
            {slotNumber ? (
              <span style={{ marginLeft: '4px', fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                #{slotNumber}
              </span>
            ) : null}
          </span>
          {isOnlineNow && <span className={styles.pulsingDotGreen} title="Active Online Now" />}
        </div>

        {/* Row 2: IP Address & OS */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '4px' }}>
          <span style={{ fontSize: '0.72rem', color: isOnlineNow ? '#22c55e' : 'var(--text-muted)', fontFamily: 'monospace' }}>
            {session.ipAddress || '127.0.0.1'}
          </span>
          {session.osInfo && (
            <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {session.osInfo}
            </span>
          )}
        </div>

        {/* Row 3: Status Badge on Left & Reset Button on Right */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            marginTop: '2px',
            paddingTop: '4px',
            borderTop: '1px solid var(--glass-border)',
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
          ) : isOnlineNow ? (
            <span
              style={{
                color: '#22c55e',
                fontWeight: 700,
                fontSize: '0.68rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span className={styles.pulsingDotGreen} />
              Active Now
            </span>
          ) : !isLoggedOut ? (
            <span
              style={{
                color: '#38bdf8',
                fontSize: '0.68rem',
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#38bdf8' }} />
              Bound ({relativeTime})
            </span>
          ) : (
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
              Logged Out
            </span>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleResetDeviceSlot(userId, deviceType, userName, session.id, slotNumber);
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
            title={`Reset & Unbind ${fallbackLabel}${slotSuffix}`}
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
      <div className={styles.policyCard}>
        {/* Policy Header Bar */}
        <div className={styles.policyHeader} style={{ background: isPolicyPanelOpen ? 'var(--surface-soft)' : 'transparent' }}>
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
              flexShrink: 0,
            }}>
              <Sliders size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: 'var(--foreground)' }}>
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
                Configure application-wide concurrency limits, automatic locks & global session management.
              </p>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className={styles.policyActions}>
            <button
              onClick={handleUnbindAllDevices}
              className={styles.policyBtnDanger}
              title="Reset and unlink all bound devices for every student"
            >
              <RotateCcw size={14} />
              <span>Unbind All Devices</span>
            </button>

            <button
              onClick={handleLogoutAllSessions}
              className={styles.policyBtnDanger}
              title="Terminate all active student sessions platform-wide"
            >
              <LogOut size={14} />
              <span>Logout All Sessions</span>
            </button>

            <button
              onClick={() => setIsPolicyPanelOpen(!isPolicyPanelOpen)}
              className={styles.policyBtnDefault}
            >
              {isPolicyPanelOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              <span>{isPolicyPanelOpen ? 'Hide Policy' : 'Configure Policy'}</span>
            </button>
          </div>
        </div>

        {/* Collapsible Content */}
        {isPolicyPanelOpen && (
          <div className={styles.policyContent}>
            <div className={styles.policyGrid}>
              {/* 1. Concurrent Session Limit Card */}
              <div className={styles.policyCardItem}>
                <div className={styles.policyCardTop}>
                  <div className={styles.policyCardHeader}>
                    <div className={styles.policyCardTitle}>
                      <Layers size={17} style={{ color: '#3b82f6' }} />
                      <span>Concurrent Limit</span>
                    </div>
                    <span
                      className={styles.policyCardBadge}
                      style={{
                        background: 'rgba(59, 130, 246, 0.12)',
                        color: '#3b82f6',
                      }}
                    >
                      {globalSettings.maxConcurrentSessions} Session{globalSettings.maxConcurrentSessions > 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className={styles.policyCardDesc}>
                    Simultaneous active logins allowed per student across any device.
                  </p>
                </div>
                <div className={styles.policyCardControl}>
                  <select
                    value={globalSettings.maxConcurrentSessions}
                    onChange={(e) => handleUpdateGlobalSetting({ maxConcurrentSessions: parseInt(e.target.value) })}
                    className={styles.customSelect}
                  >
                    <option value={1}>1 Session (Strict 1-Device)</option>
                    <option value={2}>2 Simultaneous Devices</option>
                    <option value={3}>3 Simultaneous Devices</option>
                    <option value={4}>4 Simultaneous Devices</option>
                    <option value={5}>5 Simultaneous Devices</option>
                  </select>
                  <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }}>
                    <ChevronDown size={14} />
                  </div>
                </div>
              </div>

              {/* 2. Auto-Lock & Seamless Handover Card */}
              <div className={styles.policyCardItem}>
                <div className={styles.policyCardTop}>
                  <div className={styles.policyCardHeader}>
                    <div className={styles.policyCardTitle}>
                      <Lock size={17} style={{ color: globalSettings.autoLockFirstBrowser ? '#22c55e' : '#ef4444' }} />
                      <span>Auto-Lock Handover</span>
                    </div>
                    <span
                      className={styles.policyCardBadge}
                      style={{
                        background: globalSettings.autoLockFirstBrowser ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                        color: globalSettings.autoLockFirstBrowser ? '#22c55e' : '#ef4444',
                      }}
                    >
                      {globalSettings.autoLockFirstBrowser ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <p className={styles.policyCardDesc}>
                    Auto log out oldest session when cap is reached for smooth transition.
                  </p>
                </div>
                <div className={styles.policyCardControl}>
                  <button
                    type="button"
                    className={`${styles.policyToggleBtn} ${globalSettings.autoLockFirstBrowser ? styles.policyToggleBtnActive : ''}`}
                    onClick={() => handleUpdateGlobalSetting({ autoLockFirstBrowser: !globalSettings.autoLockFirstBrowser })}
                    title="Toggle automatic handover protection"
                  >
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: globalSettings.autoLockFirstBrowser ? '#22c55e' : 'var(--text-muted)' }}>
                      {globalSettings.autoLockFirstBrowser ? 'Auto-Handover: ON' : 'Hard Block on Cap'}
                    </span>
                    <div className={`${styles.switchTrack} ${globalSettings.autoLockFirstBrowser ? styles.switchTrackActive : ''}`}>
                      <div className={`${styles.switchThumb} ${globalSettings.autoLockFirstBrowser ? styles.switchThumbActive : ''}`} />
                    </div>
                  </button>
                </div>
              </div>

              {/* 3. Desktop / Laptop Slots Card */}
              <div className={styles.policyCardItem}>
                <div className={styles.policyCardTop}>
                  <div className={styles.policyCardHeader}>
                    <div className={styles.policyCardTitle}>
                      <Monitor size={17} style={{ color: (globalSettings.maxDesktopSessions ?? 1) > 0 ? '#38bdf8' : 'var(--text-muted)' }} />
                      <span>Desktop / Laptop</span>
                    </div>
                    <span
                      className={styles.policyCardBadge}
                      style={{
                        background: (globalSettings.maxDesktopSessions ?? 1) > 0 ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                        color: (globalSettings.maxDesktopSessions ?? 1) > 0 ? '#38bdf8' : 'var(--text-muted)',
                      }}
                    >
                      {(globalSettings.maxDesktopSessions ?? 1) === 0 ? 'Disabled' : `${globalSettings.maxDesktopSessions ?? 1} Slot${(globalSettings.maxDesktopSessions ?? 1) > 1 ? 's' : ''}`}
                    </span>
                  </div>
                  <p className={styles.policyCardDesc}>
                    Max registered laptop or desktop browsers allowed per student.
                  </p>
                </div>
                <div className={styles.policyCardControl}>
                  <select
                    value={globalSettings.maxDesktopSessions ?? 1}
                    onChange={(e) => handleUpdateGlobalSetting({ maxDesktopSessions: parseInt(e.target.value) })}
                    className={styles.customSelect}
                  >
                    <option value={0}>0 - Disabled</option>
                    <option value={1}>1 Desktop Slot</option>
                    <option value={2}>2 Desktop Slots (Max)</option>
                  </select>
                  <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }}>
                    <ChevronDown size={14} />
                  </div>
                </div>
              </div>

              {/* 4. Tablet / iPad Slots Card */}
              <div className={styles.policyCardItem}>
                <div className={styles.policyCardTop}>
                  <div className={styles.policyCardHeader}>
                    <div className={styles.policyCardTitle}>
                      <Tablet size={17} style={{ color: (globalSettings.maxTabletSessions ?? 1) > 0 ? '#a855f7' : 'var(--text-muted)' }} />
                      <span>Tablet / iPad</span>
                    </div>
                    <span
                      className={styles.policyCardBadge}
                      style={{
                        background: (globalSettings.maxTabletSessions ?? 1) > 0 ? 'rgba(168, 85, 247, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                        color: (globalSettings.maxTabletSessions ?? 1) > 0 ? '#a855f7' : 'var(--text-muted)',
                      }}
                    >
                      {(globalSettings.maxTabletSessions ?? 1) === 0 ? 'Disabled' : `${globalSettings.maxTabletSessions ?? 1} Slot${(globalSettings.maxTabletSessions ?? 1) > 1 ? 's' : ''}`}
                    </span>
                  </div>
                  <p className={styles.policyCardDesc}>
                    Max registered iPad or Android tablets allowed per student.
                  </p>
                </div>
                <div className={styles.policyCardControl}>
                  <select
                    value={globalSettings.maxTabletSessions ?? 1}
                    onChange={(e) => handleUpdateGlobalSetting({ maxTabletSessions: parseInt(e.target.value) })}
                    className={styles.customSelect}
                  >
                    <option value={0}>0 - Disabled</option>
                    <option value={1}>1 Tablet Slot</option>
                    <option value={2}>2 Tablet Slots (Max)</option>
                  </select>
                  <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }}>
                    <ChevronDown size={14} />
                  </div>
                </div>
              </div>

              {/* 5. Mobile Smartphone Slots Card */}
              <div className={styles.policyCardItem}>
                <div className={styles.policyCardTop}>
                  <div className={styles.policyCardHeader}>
                    <div className={styles.policyCardTitle}>
                      <Smartphone size={17} style={{ color: (globalSettings.maxMobileSessions ?? 1) > 0 ? '#22c55e' : 'var(--text-muted)' }} />
                      <span>Mobile Smartphone</span>
                    </div>
                    <span
                      className={styles.policyCardBadge}
                      style={{
                        background: (globalSettings.maxMobileSessions ?? 1) > 0 ? 'rgba(34, 197, 94, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                        color: (globalSettings.maxMobileSessions ?? 1) > 0 ? '#22c55e' : 'var(--text-muted)',
                      }}
                    >
                      {(globalSettings.maxMobileSessions ?? 1) === 0 ? 'Disabled' : `${globalSettings.maxMobileSessions ?? 1} Slot${(globalSettings.maxMobileSessions ?? 1) > 1 ? 's' : ''}`}
                    </span>
                  </div>
                  <p className={styles.policyCardDesc}>
                    Max registered smartphone browsers allowed per student.
                  </p>
                </div>
                <div className={styles.policyCardControl}>
                  <select
                    value={globalSettings.maxMobileSessions ?? 1}
                    onChange={(e) => handleUpdateGlobalSetting({ maxMobileSessions: parseInt(e.target.value) })}
                    className={styles.customSelect}
                  >
                    <option value={0}>0 - Disabled</option>
                    <option value={1}>1 Mobile Slot</option>
                    <option value={2}>2 Mobile Slots (Max)</option>
                  </select>
                  <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }}>
                    <ChevronDown size={14} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Search, Filter Pills & Live Sync Toolbar */}
      <div className={styles.toolbarCard}>
        <div className={styles.toolbarTopRow}>
          {/* Search Input */}
          <div className={styles.searchBox}>
            <Search size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
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
                fontSize: '0.92rem',
              }}
            />
            {(isFetching || searchQuery !== debouncedSearch) && (
              <span title="Searching..." style={{ display: 'inline-flex', alignItems: 'center' }}>
                <RefreshCw
                  size={14}
                  style={{
                    color: 'var(--primary)',
                    animation: 'spin 1s linear infinite',
                    flexShrink: 0,
                  }}
                />
              </span>
            )}
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

          {/* Controls: Live Sync Badge, Manual Refresh, Sort */}
          <div className={styles.toolbarControls}>
            <div className={styles.syncBadge}>
              <span className={styles.pulsingDot} />
              <span>Live Sync (12s)</span>
            </div>

            <button
              onClick={() => fetchUsers(currentPage, debouncedSearch, sortBy, 'background')}
              className={styles.iconBtn}
              title="Refresh student list immediately"
            >
              <RefreshCw size={14} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
            </button>

            {/* Sort Dropdown */}
            <div className={styles.sortSelectWrapper}>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setCurrentPage(1);
                }}
                className={styles.customSelect}
              >
                <option value="lastActive">Sort: Last Active</option>
                <option value="newest">Sort: Newest First</option>
                <option value="oldest">Sort: Oldest First</option>
                <option value="name_asc">Sort: Name (A-Z)</option>
                <option value="name_desc">Sort: Name (Z-A)</option>
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

      {/* 4. Student Directory Cards: Row 1 = Details + Actions, Row 2 = Meta + Device Slots */}
      <div
        className={styles.studentCardList}
        style={{
          opacity: isFetching ? 0.7 : 1,
          transition: 'opacity 0.2s ease',
        }}
      >
        {isFetching && filteredUsers.length === 0 ? (
          <div className={styles.studentCard} style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <RefreshCw size={28} style={{ color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--foreground)' }}>Searching directory...</span>
            </div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className={styles.studentCard} style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <Users size={36} style={{ opacity: 0.3, color: 'var(--primary)' }} />
              <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--foreground)' }}>No students found</span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
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
          </div>
        ) : (
          filteredUsers.map((userObj) => {
            const latestSession = userObj.currentSession || [...(userObj.sessions || [])].sort((a, b) => new Date(b.lastActivityAt || b.createdAt).getTime() - new Date(a.lastActivityAt || a.createdAt).getTime())[0];
            const maxDesktop = globalSettings.maxDesktopSessions ?? 1;
            const maxTablet = globalSettings.maxTabletSessions ?? 1;
            const maxMobile = globalSettings.maxMobileSessions ?? 1;

            // Arrays of bound devices per category
            const desktops = userObj.boundDevices?.desktops || (userObj.boundDevices?.desktop ? [userObj.boundDevices.desktop] : []);
            const tablets = userObj.boundDevices?.tablets || (userObj.boundDevices?.tablet ? [userObj.boundDevices.tablet] : []);
            const mobiles = userObj.boundDevices?.mobiles || (userObj.boundDevices?.mobile ? [userObj.boundDevices.mobile] : []);

            return (
              <div key={userObj.id} className={styles.studentCard}>
                {/* ROW 1: Details (Left) + Action Buttons (Right) */}
                <div className={styles.studentCardTop}>
                  {/* Left: Identity, Presence, Network Snippet */}
                  <div className={styles.studentIdentityCol}>
                    <div className={styles.avatarWrapper}>
                      <div className={`${styles.avatarCircle} ${userObj.isOnline ? styles.avatarCircleOnline : ''}`}>
                        {userObj.profileImage ? (
                          <Image src={userObj.profileImage} alt={userObj.fullName} fill style={{ objectFit: 'cover' }} unoptimized />
                        ) : getInitials(userObj.fullName)}
                      </div>
                      {userObj.isOnline && <span className={styles.onlineBadgeDot} title="Active Online Now" />}
                    </div>

                    <div className={styles.studentInfo}>
                      <div className={styles.studentNameRow}>
                        <span className={styles.nameText}>{userObj.fullName || 'Unnamed Student'}</span>

                        {userObj.isOnline ? (
                          <span className={styles.badgeOnline}>
                            <span className={styles.pulsingDotGreen} />
                            Online
                          </span>
                        ) : (
                          <span className={styles.badgeOffline}>
                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#64748b' }} />
                            Offline
                          </span>
                        )}

                        {userObj.isBanned && (
                          <span className={styles.badgeBanned}>
                            Banned
                          </span>
                        )}

                        {userObj.isSessionLockedExempt && (
                          <span className={styles.badgeExempt}>
                            Exempted
                          </span>
                        )}

                        <span style={{
                          fontSize: '0.66rem',
                          textTransform: 'uppercase',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '6px',
                          background: 'var(--surface-soft)',
                          border: '1px solid var(--glass-border)',
                          color: 'var(--text-muted)',
                        }}>
                          {userObj.role}
                        </span>
                      </div>

                      <div className={styles.emailText}>{userObj.email}</div>

                      {/* Live Network & Activity Snippet */}
                      <div className={styles.studentNetworkSnippet}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Wifi size={12} style={{ color: userObj.isOnline ? '#22c55e' : 'var(--text-muted)' }} />
                          <code>{latestSession?.ipAddress || '127.0.0.1'}</code>
                        </div>
                        <span>•</span>
                        <span>{latestSession?.browserName || 'Browser'}{latestSession?.osInfo ? ` (${latestSession.osInfo})` : ''}</span>
                        <span>•</span>
                        <span style={{ color: userObj.isOnline ? '#22c55e' : 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <Activity size={10} />
                          {userObj.isOnline ? 'Active Just Now' : `Last active ${getRelativeActivity(userObj.lastActiveAt)}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Action Buttons (Logout, Exempt, Ban, Delete) */}
                  <div className={styles.studentActionsCol}>
                    {userObj.activeSessions.length > 0 && (
                      <button
                        className={styles.actionBtnLogout}
                        onClick={() =>
                          userObj.activeSessions.forEach((s) => handleLogoutSession(s.id))
                        }
                        title="Terminate active student session immediately"
                      >
                        <LogOut size={13} />
                        <span>Logout</span>
                      </button>
                    )}

                    <button
                      className={`${styles.actionBtnExempt} ${userObj.isSessionLockedExempt ? styles.actionBtnExemptActive : ''}`}
                      onClick={() => handleToggleExempt(userObj.id, userObj.isSessionLockedExempt)}
                      title={userObj.isSessionLockedExempt ? "Enforce device constraints for this student" : "Exempt student from all session limits"}
                    >
                      {userObj.isSessionLockedExempt ? <Unlock size={13} /> : <Lock size={13} />}
                      <span>{userObj.isSessionLockedExempt ? 'Exempted' : 'Exempt'}</span>
                    </button>

                    <button
                      className={`${styles.actionBtnBan} ${userObj.isBanned ? styles.actionBtnBanActive : ''}`}
                      onClick={() => handleToggleBan(userObj.id, userObj.isBanned, userObj.fullName || userObj.email)}
                      title={userObj.isBanned ? "Unban student account" : "Ban student account and terminate login"}
                    >
                      {userObj.isBanned ? <UserCheck size={13} /> : <ShieldAlert size={13} />}
                      <span>{userObj.isBanned ? 'Unban' : 'Ban'}</span>
                    </button>

                    <button
                      className={styles.actionBtnDelete}
                      onClick={() => handleDeleteUser(userObj.id, userObj.fullName || userObj.email)}
                      title="Permanently delete user and cascade purge all records"
                    >
                      <Trash2 size={13} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>

                {/* ROW 2: Enrolled Courses & Joined Meta (Left) + Hardware Device Slots (Right) */}
                <div className={styles.studentCardBottom}>
                  {/* Left: Enrolled Courses & Joined Info */}
                  <div className={styles.studentMetaCol}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Joined {formatDateGMT6(userObj.createdAt)}
                    </span>

                    {userObj.enrolledCourses && userObj.enrolledCourses.length > 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        {userObj.enrolledCourses.slice(0, 3).map((c) => (
                          <span key={c.courseId} className={styles.coursePill} title={c.courseTitle}>
                            <BookOpen size={11} style={{ opacity: 0.6 }} />
                            {c.courseTitle.length > 22 ? `${c.courseTitle.slice(0, 22)}…` : c.courseTitle}
                          </span>
                        ))}
                        {userObj.enrolledCourses.length > 3 && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                            +{userObj.enrolledCourses.length - 3} more
                          </span>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        No courses enrolled
                      </span>
                    )}
                  </div>

                  {/* Right: Dynamic Hardware Device Slots */}
                  <div className={styles.studentDevicesCol}>
                    {/* Render Desktop Slots */}
                    {maxDesktop > 0 && Array.from({ length: maxDesktop }).map((_, idx) => {
                      const session = desktops[idx] || null;
                      return renderDeviceSlot(
                        session,
                        'Desktop',
                        Monitor,
                        userObj.id,
                        'desktop',
                        userObj.fullName || userObj.email,
                        maxDesktop > 1 ? idx + 1 : null
                      );
                    })}

                    {/* Render Tablet Slots */}
                    {maxTablet > 0 && Array.from({ length: maxTablet }).map((_, idx) => {
                      const session = tablets[idx] || null;
                      return renderDeviceSlot(
                        session,
                        'Tablet',
                        Tablet,
                        userObj.id,
                        'tablet',
                        userObj.fullName || userObj.email,
                        maxTablet > 1 ? idx + 1 : null
                      );
                    })}

                    {/* Render Mobile Slots */}
                    {maxMobile > 0 && Array.from({ length: maxMobile }).map((_, idx) => {
                      const session = mobiles[idx] || null;
                      return renderDeviceSlot(
                        session,
                        'Mobile',
                        Smartphone,
                        userObj.id,
                        'mobile',
                        userObj.fullName || userObj.email,
                        maxMobile > 1 ? idx + 1 : null
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          borderRadius: '14px',
          background: 'var(--surface-soft)',
          border: '1px solid var(--glass-border)',
          fontSize: '0.85rem',
          color: 'var(--text-muted)',
          marginTop: '12px',
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
