"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import styles from "./Dashboard.module.css";
import {
    LayoutDashboard,
    UserCog,
    TrendingUp,
    BookOpen,
    ArrowRight,
    Loader2,
    AlertTriangle,
    KeyRound,
    Lock,
    ShieldCheck,
    Clock
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import StudentOverview from "@/components/Student/StudentOverview";

interface DashboardCourse {
    orderId: string;
    courseId: string;
    courseSlug: string | null;
    courseTitle: string;
    imageUrl?: string | null;
    duration: string;
    category: string;
    enrolledAt: string;
    progress: {
        completedCount: number;
        totalCount: number;
        percentage: number;
    };
}

interface DashboardProfile {
    id: string;
    email: string;
    phone: string | null;
    role: string;
    fullName: string;
    profileImage: string | null;
    bmdcNumber: string | null;
    designation: string | null;
    institution: string | null;
    degrees: string | null;
    createdAt: string;
}

interface DashboardPayload {
    profile: DashboardProfile;
    studyStats: {
        activeCourses: number;
        completedLessons: number;
        averageProgress: number;
        totalPurchases: number;
    };
    enrolledCourses: DashboardCourse[];
}

function StudentDashboardContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeTab = (searchParams.get("tab") as "overview" | "courses" | "profile" | "security") || "overview";

  const [data, setData] = useState<DashboardPayload | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Profile Edit State
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    fullName: "",
    phone: "",
    bmdcNumber: "",
    designation: "",
    institution: "",
    degrees: "",
    profileImage: "" as string | null
  });
  const [profileMessage, setProfileMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Password Change State
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    const fetchDashboard = async () => {
      setFetching(true);
      setError(null);
      try {
        const token = localStorage.getItem("auth_token");
        const res = await fetch("/api/me/dashboard", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const d = await res.json();
        if (res.ok) {
          setData(d);
          setProfileForm({
            fullName: d.profile.fullName || "",
            phone: d.profile.phone || "",
            bmdcNumber: d.profile.bmdcNumber || "",
            designation: d.profile.designation || "",
            institution: d.profile.institution || "",
            degrees: d.profile.degrees || "",
            profileImage: d.profile.profileImage || null
          });
        } else {
          setError(d.error || "Could not load dashboard data.");
        }
      } catch (err) {
        setError("Network error when loading dashboard.");
      } finally {
        setFetching(false);
      }
    };
    fetchDashboard();
  }, [user]);

  const handleProfileImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setProfileForm((prev) => ({ ...prev, profileImage: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMessage(null);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/user/update-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(profileForm),
      });
      const resData = await res.json();
      if (res.ok) {
        setProfileMessage({ type: "success", text: "Profile updated successfully!" });
        setEditingProfile(false);
        // Refresh local names
        if (data) {
          setData({ ...data, profile: { ...data.profile, ...profileForm } });
        }
      } else {
        setProfileMessage({ type: "error", text: resData.error || "Update failed." });
      }
    } catch (err: any) {
      setProfileMessage({ type: "error", text: err.message || "Failed to save profile." });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage({ type: "error", text: "New passwords do not match." });
      return;
    }
    setChangingPassword(true);
    setPasswordMessage(null);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/user/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Password change failed.");

      setPasswordMessage({ type: "success", text: "Password changed successfully!" });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (changeError: any) {
      setPasswordMessage({ type: "error", text: changeError.message || "Failed to change password." });
    } finally {
      setChangingPassword(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  };

  if (loading || !user) {
    return (
        <div className={styles.loadingOverlay}>
            <Loader2 className={styles.spinner} />
            <span>Syncing Workspace...</span>
        </div>
    );
  }

  return (
    <>
      {error && (
        <section className={styles.alertCard}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </section>
      )}

      {fetching && !data ? <div className={styles.loaderInline}>Securing your workspace...</div> : null}

      {activeTab === "overview" && data && (
        <div className={styles.stack}>
          <StudentOverview 
            courseCount={data.studyStats.activeCourses}
            completionPercent={data.studyStats.averageProgress}
            completedLessons={data.studyStats.completedLessons}
            enrolledCourses={data.enrolledCourses}
            onTabChange={(tab) => {
              const url = new URL(window.location.href);
              url.searchParams.set("tab", tab);
              router.push(url.toString());
            }}
          />
        </div>
      )}

      {activeTab === "courses" && data && (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
                <h2>Academic Programs</h2>
                <p className={styles.subtitle}>{data.enrolledCourses.length} active enrollments</p>
            </div>
          </div>

          {data.enrolledCourses.length === 0 ? (
            <p className={styles.emptyText}>No active courses yet. Start by purchasing a course from the catalog.</p>
          ) : (
            <div className={styles.courseList}>
              {data.enrolledCourses.map((course) => (
                <article key={course.orderId} className={styles.courseListCard}>
                  <div className={styles.courseListTop}>
                    <div>
                      <h3>{course.courseTitle}</h3>
                      <p>{course.category} · {course.duration}</p>
                    </div>
                    <span className={styles.enrolledAt}>Joined {formatDate(course.enrolledAt)}</span>
                  </div>

                  <div className={styles.progressRow}>
                    <div className={styles.progressTrackLarge}>
                      <div className={styles.progressFill} style={{ width: `${course.progress.percentage}%` }} />
                    </div>
                    <strong>{course.progress.percentage}%</strong>
                  </div>

                  <div className={styles.courseListBottom}>
                    <span>{course.progress.completedCount}/{course.progress.totalCount} lessons finished</span>
                    {course.courseSlug ? (
                      <Link href={`/study/${course.courseSlug}`} className={styles.resumeBtn}>Enter Classroom</Link>
                    ) : (
                      <span className={styles.resumeBtnDisabled}>Restricted</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === "profile" && data && (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
                <h2>Academic Profile</h2>
                <p className={styles.subtitle}>Manage your credentials and identity</p>
            </div>
            <button className={styles.secondaryBtn} onClick={() => setEditingProfile((prev) => !prev)}>
              <UserCog size={16} /> {editingProfile ? "Cancel" : "Edit Profile"}
            </button>
          </div>

          <div className={styles.profileGrid}>
            <div className={styles.profileCardAside}>
              <div className={styles.profileAvatar}>
                {profileForm.profileImage ? (
                  <Image src={profileForm.profileImage} alt={profileForm.fullName || "Profile"} fill className={styles.profileAvatarImage} unoptimized />
                ) : (
                  <span>{(profileForm.fullName || data.profile.fullName).slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <h3>{profileForm.fullName || data.profile.fullName}</h3>
              <p>{data.profile.email}</p>
              <span className={styles.memberSince}>Account active since {formatDate(data.profile.createdAt)}</span>

              {editingProfile && (
                <label className={styles.uploadBtn}>
                  Change Avatar
                  <input type="file" accept="image/*" onChange={handleProfileImageSelect} />
                </label>
              )}
            </div>

            <div>
              <form className={styles.profileForm} onSubmit={handleSaveProfile}>
                <div className={styles.formRowTwo}>
                  <div className={styles.formGroup}>
                    <label>Full Name</label>
                    <input
                      value={profileForm.fullName}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, fullName: event.target.value }))}
                      disabled={!editingProfile}
                      required
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Registration ID (Email)</label>
                    <input value={data.profile.email} disabled />
                  </div>
                </div>

                <div className={styles.formRowTwo}>
                  <div className={styles.formGroup}>
                    <label>Contact Phone</label>
                    <input
                      value={profileForm.phone}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, phone: event.target.value }))}
                      disabled={!editingProfile}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>BMDC Number</label>
                    <input
                      value={profileForm.bmdcNumber}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, bmdcNumber: event.target.value }))}
                      disabled={!editingProfile}
                    />
                  </div>
                </div>

                <div className={styles.formRowTwo}>
                  <div className={styles.formGroup}>
                    <label>Primary Designation</label>
                    <input
                      value={profileForm.designation}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, designation: event.target.value }))}
                      disabled={!editingProfile}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Affiliated Institution</label>
                    <input
                      value={profileForm.institution}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, institution: event.target.value }))}
                      disabled={!editingProfile}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Academic Degrees</label>
                  <input
                    value={profileForm.degrees}
                    onChange={(event) => setProfileForm((prev) => ({ ...prev, degrees: event.target.value }))}
                    disabled={!editingProfile}
                  />
                </div>

                {profileMessage && (
                  <div className={`${styles.message} ${profileMessage.type === "success" ? styles.success : styles.error}`}>
                    {profileMessage.text}
                  </div>
                )}

                {editingProfile && (
                  <button className={styles.primaryBtn} type="submit" disabled={savingProfile}>
                    {savingProfile ? "Encrypting Changes..." : "Save Profile Details"}
                  </button>
                )}
              </form>
            </div>
          </div>
        </section>
      )}

      {activeTab === "security" && (
        <div className={styles.stack}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h2>Privacy & Key Access</h2>
                <p className={styles.subtitle}>Protect your account with robust credentials</p>
              </div>
            </div>

            <form className={styles.securityForm} onSubmit={handleChangePassword}>
              <div className={styles.formGroup}>
                <label>Current Secure Key</label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(event) => setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
                  required
                />
              </div>

              <div className={styles.formRowTwo}>
                <div className={styles.formGroup}>
                  <label>New Secure Key</label>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(event) => setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))}
                    required
                    minLength={8}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Confirm New Key</label>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                    required
                    minLength={8}
                  />
                </div>
              </div>

              {passwordMessage && (
                <div className={`${styles.message} ${passwordMessage.type === "success" ? styles.success : styles.error}`}>
                  {passwordMessage.text}
                </div>
              )}

              <button className={styles.primaryBtn} type="submit" disabled={changingPassword}>
                <KeyRound size={16} /> {changingPassword ? "Updating Keys..." : "Update Security Key"}
              </button>
            </form>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>System Security Protocols</h2>
            </div>
            <ul className={styles.tipList}>
              <li><ShieldCheck size={15} /> Use unique alphanumeric combinations with special characters.</li>
              <li><Clock size={15} /> Rotate your security keys every 90 days for maximum safety.</li>
              <li><Lock size={15} /> Multi-device sessions are monitored to prevent unauthorized access.</li>
            </ul>
          </section>
        </div>
      )}
    </>
  );
}

export default function StudentDashboard() {
  return (
    <Suspense fallback={<div className={styles.loader}>Loading student portal...</div>}>
      <StudentDashboardContent />
    </Suspense>
  );
}
