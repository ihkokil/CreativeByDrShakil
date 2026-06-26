'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import Image from 'next/image';
import styles from '@/components/Admin/SessionsManager.module.css';
import { Smartphone, Monitor, Tablet, Lock, Unlock, AlertCircle, Search, UserCheck, ShieldAlert, Trash2, Settings2, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { LogOut } from 'lucide-react';
import SessionDetailsModal from '@/components/Admin/SessionDetailsModal';
import { formatDateGMT6, formatDateTimeGMT6 } from '@/lib/date-format';

interface SessionData {
  id: string;
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

interface UserData {
  id: string;
  fullName: string;
  email: string;
  role: string;
  isBanned: boolean;
  isSessionLockedExempt: boolean;
  createdAt: string;
  lastActiveAt: string;
  profileImage?: string | null;
  autoLockSetting: boolean;
  hasUserOverride: boolean;
  userAutoLockSetting: boolean | null;
  activeSessions: SessionData[];
  sessions: SessionData[];
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
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
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

  const fetchUsers = useCallback(async (page = currentPage, search = debouncedSearch, sort = sortBy) => {
    setLoading(true);
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
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [token, currentPage, debouncedSearch, sortBy]);

  useEffect(() => {
    fetchUsers(1, '', 'lastActive');
  }, [token]);

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

  const handleToggleBan = async (userId: string, currentlyBanned: boolean) => {
    const action = currentlyBanned ? 'unban' : 'ban';
    const confirmMessage = currentlyBanned
      ? 'Are you sure you want to unban this user? They will be allowed to log in again.'
      : 'Are you sure you want to ban this user? They will be locked out immediately.';

    if (!window.confirm(confirmMessage)) return;

    try {
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
    } catch (err: any) {
      setError(err.message || `Failed to ${action} user`);
    }
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

  const handleDeleteUser = async (userId: string, userName: string) => {
    const confirmMessage = `Are you sure you want to permanently delete user "${userName}"? This will delete the user, their enrolled programs, and sessions entirely from the database and application. This action cannot be undone.`;
    if (!window.confirm(confirmMessage)) return;

    try {
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
    } catch (err: any) {
      setError(err.message || 'Failed to delete user');
    }
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

  const renderSessionBadges = (sessions: SessionData[], IconComponent: any) => {
    if (!sessions || sessions.length === 0) {
      return <span className={styles.empty}>—</span>;
    }

    return (
      <div className={styles.sessionList}>
        {sessions.map((session) => {
          const isLocked = session.isLocked;
          const label = session.deviceLabel || session.browserName || 'Device';
          
          const dateVal = isLocked 
            ? (session.loggedOutAt || session.lastActivityAt) 
            : session.createdAt;
          const formattedDate = new Date(dateVal).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
          });

          return (
            <div
              key={session.id}
              className={`${styles.sessionBadge} ${isLocked ? styles.locked : styles.active}`}
              onClick={() => setSelectedSession(session)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                padding: '4px 8px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                opacity: isLocked ? 0.65 : 1,
                border: isLocked ? '1px dashed rgba(239, 68, 68, 0.4)' : '1px solid rgba(34, 197, 94, 0.3)',
                cursor: 'pointer',
                width: '140px',
                marginBottom: '4px',
                alignItems: 'stretch'
              }}
            >
              {/* Row 1: Icon + Device Label */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
                <IconComponent size={14} style={{ flexShrink: 0 }} />
                <span 
                  style={{ 
                    fontWeight: 600, 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis', 
                    whiteSpace: 'nowrap' 
                  }}
                  title={label}
                >
                  {label}
                </span>
              </div>
              
              {/* Row 2: Date + Lock Status/Action */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '4px', minHeight: '18px' }}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                  {formattedDate}
                  {isLocked && (
                    <>
                      {' - '}
                      <span style={{ color: '#ef4444', fontWeight: 600 }}>Locked</span>
                    </>
                  )}
                </span>
                
                {!isLocked && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm('Are you sure you want to force-lock this active session?')) {
                        handleLockSession(session.id);
                      }
                    }}
                    style={{
                      background: 'rgba(239, 68, 68, 0.12)',
                      border: 'none',
                      color: '#ef4444',
                      borderRadius: '4px',
                      padding: '1px 4px',
                      fontSize: '0.62rem',
                      cursor: 'pointer',
                      fontWeight: 700,
                    }}
                    title="Lock"
                  >
                    Lock
                  </button>
                )}
              </div>
            </div>
          );
        })}
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

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: '24%' }}>User Information</th>
              <th style={{ width: '14%' }}>Desktop Sessions</th>
              <th style={{ width: '14%' }}>Tablet Sessions</th>
              <th style={{ width: '14%' }}>Mobile Sessions</th>
              <th style={{ width: '12%' }}>Last Active</th>
              <th style={{ width: '10%' }}>Account Actions</th>
              <th style={{ width: '12%', textAlign: 'right' }}>Session Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((userObj) => {
              const desktopSessions = (userObj.sessions || []).filter((s) => s.deviceType === 'desktop' && !s.loggedOutAt).slice(0, 1);
              const tabletSessions = (userObj.sessions || []).filter((s) => s.deviceType === 'tablet' && !s.loggedOutAt).slice(0, 1);
              const mobileSessions = (userObj.sessions || []).filter((s) => s.deviceType === 'mobile' && !s.loggedOutAt).slice(0, 1);

              const latestSession = [...(userObj.sessions || [])].sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime())[0];
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
                          {userObj.isBanned ? (
                            <span style={{
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              color: '#ef4444',
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.2)',
                              padding: '2px 8px',
                              borderRadius: '12px'
                            }}>
                              Banned
                            </span>
                          ) : (
                            <span style={{
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              color: '#22c55e',
                              background: 'rgba(34, 197, 94, 0.1)',
                              border: '1px solid rgba(34, 197, 94, 0.2)',
                              padding: '2px 8px',
                              borderRadius: '12px'
                            }}>
                              Active
                            </span>
                          )}
                        </div>
                        <span className={styles.emailCell}>{userObj.email}</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Joined {formatDateGMT6(userObj.createdAt)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    {renderSessionBadges(desktopSessions, Monitor)}
                  </td>
                  <td>
                    {renderSessionBadges(tabletSessions, Tablet)}
                  </td>
                  <td>
                    {renderSessionBadges(mobileSessions, Smartphone)}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--foreground)', fontWeight: 500 }}>
                        {lastActiveText}
                      </span>
                    </div>
                  </td>

                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '135px' }}>
                      <button
                        className={styles.actionBtn}
                        onClick={() => handleToggleBan(userObj.id, userObj.isBanned)}
                        title={userObj.isBanned ? "Unban user and allow login" : "Ban user and prevent login"}
                        style={{
                          color: userObj.isBanned ? '#22c55e' : '#f97316',
                          borderColor: userObj.isBanned ? 'rgba(34, 197, 94, 0.3)' : 'rgba(249, 115, 22, 0.3)',
                          background: userObj.isBanned ? 'rgba(34, 197, 94, 0.08)' : 'rgba(249, 115, 22, 0.08)',
                          width: '100%',
                          justifyContent: 'flex-start',
                        }}
                      >
                        {userObj.isBanned ? <UserCheck size={16} /> : <ShieldAlert size={16} />}
                        <span>{userObj.isBanned ? 'Unban' : 'Ban'}</span>
                      </button>

                      <button
                        className={styles.actionBtn}
                        onClick={() => handleDeleteUser(userObj.id, userObj.fullName)}
                        title="Delete user entirely from database and application"
                        style={{
                          color: '#ef4444',
                          borderColor: 'rgba(239, 68, 68, 0.3)',
                          background: 'rgba(239, 68, 68, 0.08)',
                          width: '100%',
                          justifyContent: 'flex-start',
                        }}
                      >
                        <Trash2 size={16} />
                        <span>Delete</span>
                      </button>
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '135px', marginLeft: 'auto' }}>
                      <button
                        className={styles.actionBtn}
                        onClick={() => handleToggleExempt(userObj.id, userObj.isSessionLockedExempt)}
                        title={userObj.isSessionLockedExempt ? "Enforce session lock constraints for this user" : "Exempt this user from session lock constraints"}
                        style={{
                          color: userObj.isSessionLockedExempt ? '#22c55e' : 'var(--text-muted)',
                          borderColor: userObj.isSessionLockedExempt ? 'rgba(34, 197, 94, 0.3)' : 'var(--glass-border)',
                          background: userObj.isSessionLockedExempt ? 'rgba(34, 197, 94, 0.08)' : 'transparent',
                          width: '100%',
                          justifyContent: 'flex-start',
                        }}
                      >
                        {userObj.isSessionLockedExempt ? <Unlock size={16} /> : <Lock size={16} />}
                        <span>Exempt</span>
                      </button>

                      {userObj.activeSessions.length > 0 && (
                        <button
                          className={styles.actionBtn}
                          onClick={() =>
                            userObj.activeSessions.forEach((s) => handleLogoutSession(s.id))
                          }
                          title="Logout all sessions"
                          style={{ width: '100%', justifyContent: 'flex-start' }}
                        >
                          <LogOut size={16} />
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
        />
      )}


    </div>
  );
}
