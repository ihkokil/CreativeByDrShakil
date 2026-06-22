'use client';

import { useEffect, useState, useMemo } from 'react';
import styles from '@/components/Admin/SessionsManager.module.css';
import { Smartphone, Monitor, Lock, LogOut, AlertCircle, Search, UserCheck, ShieldAlert, Trash2 } from 'lucide-react';
import SessionDetailsModal from '@/components/Admin/SessionDetailsModal';
import { formatDateGMT6, formatDateTimeGMT6 } from '@/lib/date-format';

interface SessionData {
  id: string;
  deviceType: 'desktop' | 'mobile';
  browserName: string;
  ipAddress: string;
  isLocked: boolean;
  loggedOutAt: string | null;
  createdAt: string;
  lastActivityAt: string;
}

interface UserData {
  id: string;
  fullName: string;
  email: string;
  role: string;
  isBanned: boolean;
  createdAt: string;
  lastActiveAt: string;
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
  const [selectedSession, setSelectedSession] = useState<SessionData | null>(null);
  
  const token = useMemo(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth_token');
    }
    return null;
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/users', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) throw new Error('Failed to fetch users');

      const data = await response.json();
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [token]);

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

  const filteredUsers = useMemo(() => {
    const list = users.filter((user) => 
      user.role === 'student' && (
        user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase())
      )
    );

    // Sort by last active descending (newest activity first)
    return list.sort((a, b) => {
      const timeA = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : new Date(a.createdAt).getTime();
      const timeB = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : new Date(b.createdAt).getTime();
      return timeB - timeA;
    });
  }, [users, searchQuery]);

  if (loading) {
    return <div className={styles.loading}>Loading directory...</div>;
  }

  return (
    <div className={styles.container}>
      {error && <div className={styles.error}>{error}</div>}

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
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: '25%' }}>User Information</th>
              <th style={{ width: '14%' }}>Desktop Session</th>
              <th style={{ width: '14%' }}>Mobile Session</th>
              <th style={{ width: '17%' }}>Last Active</th>
              <th style={{ width: '15%' }}>Account Actions</th>
              <th style={{ width: '15%' }}>Session Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((userObj) => {
              const desktopSessions = userObj.activeSessions.filter((s) => s.deviceType === 'desktop');
              const mobileSessions = userObj.activeSessions.filter((s) => s.deviceType === 'mobile');
              
              const latestSession = [...(userObj.sessions || [])].sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime())[0];
              const lastActiveText = latestSession ? formatDateTimeGMT6(latestSession.lastActivityAt) : 'Never';

              return (
                <tr key={userObj.id}>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                  </td>
                  <td>
                    <div className={styles.sessionList}>
                      {desktopSessions.length > 0 ? (
                        desktopSessions.map((session) => (
                          <div
                            key={session.id}
                            className={`${styles.sessionBadge} ${styles[getSessionStatus(session)]}`}
                            onClick={() => setSelectedSession(session)}
                          >
                            <Monitor size={14} />
                            <span>{session.browserName}</span>
                          </div>
                        ))
                      ) : (
                        <span className={styles.empty}>—</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className={styles.sessionList}>
                      {mobileSessions.length > 0 ? (
                        mobileSessions.map((session) => (
                          <div
                            key={session.id}
                            className={`${styles.sessionBadge} ${styles[getSessionStatus(session)]}`}
                            onClick={() => setSelectedSession(session)}
                          >
                            <Smartphone size={14} />
                            <span>{session.browserName}</span>
                          </div>
                        ))
                      ) : (
                        <span className={styles.empty}>—</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--foreground)', fontWeight: 500 }}>
                        {lastActiveText}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '125px' }}>
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
                        <span>{userObj.isBanned ? 'Unban' : 'Ban User'}</span>
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
                        <span>Delete User</span>
                      </button>
                    </div>
                  </td>
                  <td>
                    {userObj.activeSessions.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '125px' }}>
                        <button
                          className={styles.actionBtn}
                          onClick={() =>
                            userObj.activeSessions.forEach((s) => handleLockSession(s.id))
                          }
                          title="Lock all active sessions"
                          style={{ width: '100%', justifyContent: 'flex-start' }}
                        >
                          <Lock size={16} />
                          <span>Lock Active</span>
                        </button>
                        <button
                          className={styles.actionBtn}
                          onClick={() =>
                            userObj.activeSessions.forEach((s) => handleLogoutSession(s.id))
                          }
                          title="Logout all sessions"
                          style={{ width: '100%', justifyContent: 'flex-start' }}
                        >
                          <LogOut size={16} />
                          <span>Logout Active</span>
                        </button>
                      </div>
                    ) : (
                      <span className={styles.empty}>—</span>
                    )}
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
        />
      )}
    </div>
  );
}
