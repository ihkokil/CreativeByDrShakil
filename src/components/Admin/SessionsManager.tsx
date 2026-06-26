'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './SessionsManager.module.css';
import { Smartphone, Monitor, Lock, LogOut, Settings2, AlertCircle } from 'lucide-react';
import SessionDetailsModal from './SessionDetailsModal';
import SessionSettingsModal from './SessionSettingsModal';

interface SessionData {
  id: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  browserName: string;
  ipAddress: string;
  isLocked: boolean;
  loggedOutAt: string | null;
  createdAt: string;
  lastActivityAt: string;
}

interface StudentData {
  id: string;
  fullName: string;
  email: string;
  autoLockSetting: boolean;
  hasUserOverride: boolean;
  userAutoLockSetting: boolean | null;
  activeSessions: SessionData[];
  sessions: SessionData[];
}

export default function SessionsManager() {
  const [students, setStudents] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [globalAutoLock, setGlobalAutoLock] = useState(true);
  const [selectedSession, setSelectedSession] = useState<SessionData | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const token = useMemo(() => localStorage.getItem('auth_token'), []);

  const fetchSessions = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/sessions', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) throw new Error('Failed to fetch sessions');

      const data = await response.json();
      setStudents(data.students || []);
      setGlobalAutoLock(data.globalAutoLockSetting ?? true);
    } catch (err: any) {
      setError(err.message || 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [token]);

  const handleToggleGlobalAutoLock = async () => {
    try {
      const response = await fetch('/api/admin/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ autoLockFirstBrowser: !globalAutoLock }),
      });

      if (response.ok) {
        setGlobalAutoLock(!globalAutoLock);
      }
    } catch {
      setError('Failed to update global setting');
    }
  };

  const handleLockSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/admin/sessions/${sessionId}/lock`, {
        method: 'PUT',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (response.ok) {
        fetchSessions();
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
        fetchSessions();
      }
    } catch {
      setError('Failed to logout session');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB') + ' ' + date.toLocaleTimeString('en-GB');
  };

  const getSessionStatus = (session: SessionData) => {
    if (session.isLocked) return 'locked';
    if (session.loggedOutAt) return 'loggedout';
    return 'active';
  };

  if (loading) {
    return <div className={styles.loading}>Loading sessions...</div>;
  }

  return (
    <div className={styles.container}>
      {error && <div className={styles.error}>{error}</div>}

      {/* Global Settings */}
      <div className={styles.settingsPanel}>
        <div className={styles.settingsHeader}>
          <h3>Auto-Lock First Device</h3>
          <p className={styles.description}>
            When enabled, a student logging in from a new browser on the same device will be blocked until they manually log out from the previous session.
          </p>
        </div>
        <button
          className={`${styles.toggleButton} ${globalAutoLock ? styles.enabled : ''}`}
          onClick={handleToggleGlobalAutoLock}
        >
          <span className={styles.toggleTrack}>
            <span className={styles.toggleThumb} />
          </span>
          <span>{globalAutoLock ? 'Enabled' : 'Disabled'}</span>
        </button>
      </div>

      {/* Sessions Table */}
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Student Name</th>
              <th>Email</th>
              <th>Desktop Sessions</th>
              <th>Mobile Sessions</th>
              <th>Auto-Lock Setting</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => {
              const desktopSessions = student.activeSessions.filter((s) => s.deviceType === 'desktop');
              const mobileSessions = student.activeSessions.filter((s) => s.deviceType === 'mobile');

              return (
                <tr key={student.id}>
                  <td className={styles.nameCell}>{student.fullName}</td>
                  <td className={styles.emailCell}>{student.email}</td>
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
                    <button
                      className={`${styles.settingButton} ${
                        student.autoLockSetting ? styles.enabled : styles.disabled
                      }`}
                      onClick={() => setSelectedUserId(student.id)}
                      title="Click to override"
                    >
                      <Settings2 size={14} />
                      {student.autoLockSetting ? 'ON' : 'OFF'}
                      {student.hasUserOverride ? '' : ' (GLOBAL)'}
                    </button>
                  </td>
                  <td>
                    <div className={styles.actionsCell}>
                      {student.activeSessions.length > 0 && (
                        <>
                          <button
                            className={styles.actionBtn}
                            onClick={() =>
                              student.activeSessions.forEach((s) => handleLockSession(s.id))
                            }
                            title="Lock all active sessions"
                          >
                            <Lock size={16} />
                            <span>Lock Active</span>
                          </button>
                          <button
                            className={styles.actionBtn}
                            onClick={() =>
                              student.activeSessions.forEach((s) => handleLogoutSession(s.id))
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

        {students.length === 0 && !loading && (
          <div className={styles.emptyState}>
            <AlertCircle size={32} />
            <p>No student sessions found</p>
          </div>
        )}
      </div>

      {/* Modals */}
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

      {selectedUserId && (
        <SessionSettingsModal
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
          onSave={() => {
            fetchSessions();
            setSelectedUserId(null);
          }}
        />
      )}
    </div>
  );
}
