'use client';

import { useEffect, useState, useMemo } from 'react';
import styles from '@/components/Admin/SessionsManager.module.css';
import { Smartphone, Monitor, Lock, LogOut, AlertCircle, Search, UserCheck } from 'lucide-react';
import SessionDetailsModal from '@/components/Admin/SessionDetailsModal';

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
  createdAt: string;
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

  const getSessionStatus = (session: SessionData) => {
    if (session.isLocked) return 'locked';
    if (session.loggedOutAt) return 'loggedout';
    return 'active';
  };

  const filteredUsers = useMemo(() => {
    return users.filter((user) => 
      user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.role.toLowerCase().includes(searchQuery.toLowerCase())
    );
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
              <th>User Info</th>
              <th>Role</th>
              <th>Desktop Sessions</th>
              <th>Mobile Sessions</th>
              <th>Enrolled Programs</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((userObj) => {
              const desktopSessions = userObj.activeSessions.filter((s) => s.deviceType === 'desktop');
              const mobileSessions = userObj.activeSessions.filter((s) => s.deviceType === 'mobile');

              return (
                <tr key={userObj.id}>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span className={styles.nameCell}>{userObj.fullName}</span>
                      <span className={styles.emailCell}>{userObj.email}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Joined {new Date(userObj.createdAt).toLocaleDateString('en-GB')}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      background: userObj.role === 'admin' ? 'rgba(239, 68, 68, 0.12)' : userObj.role === 'teacher' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                      color: userObj.role === 'admin' ? '#ef4444' : userObj.role === 'teacher' ? '#f59e0b' : '#3b82f6',
                    }}>
                      {userObj.role}
                    </span>
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '240px' }}>
                      {userObj.enrolledCourses.length > 0 ? (
                        userObj.enrolledCourses.map((c) => (
                          <div key={c.courseId} style={{
                            display: 'flex',
                            flexDirection: 'column',
                            padding: '6px 8px',
                            background: 'var(--surface-soft)',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                          }}>
                            <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>
                              {c.courseTitle}
                            </span>
                            {c.expiresAt && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                Expires: {new Date(c.expiresAt).toLocaleDateString('en-GB')}
                              </span>
                            )}
                          </div>
                        ))
                      ) : (
                        <span className={styles.empty}>None</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className={styles.actionsCell}>
                      {userObj.activeSessions.length > 0 && (
                        <>
                          <button
                            className={styles.actionBtn}
                            onClick={() =>
                              userObj.activeSessions.forEach((s) => handleLockSession(s.id))
                            }
                            title="Lock all active sessions"
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
                          >
                            <LogOut size={16} />
                            <span>Logout Active</span>
                          </button>
                        </>
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
