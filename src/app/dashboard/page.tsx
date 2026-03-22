"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import DashboardShell from "@/components/DashboardShell/DashboardShell";
import styles from "./Dashboard.module.css";
import {
    LayoutDashboard,
    UserCog,
    TrendingUp,
    ClipboardList,
    BookOpen,
    Trophy,
    Clock,
    ArrowRight,
    Phone,
    User as UserIcon,
    Loader2,
    AlertTriangle,
    CheckCircle2,
    CreditCard,
    ExternalLink,
    KeyRound,
    Lock,
    Receipt,
    ShieldCheck,
    Wallet,
    LineChart,
    User,
    Smartphone
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

interface PurchaseItem {
    id: string;
    status: "pending" | "approved" | "rejected";
    totalAmount: number;
    discountAmount: number;
    couponCode: string | null;
    createdAt: string;
    updatedAt: string;
    course: {
        id: string;
        title: string;
        slug: string | null;
    };
    payment: {
        id: string;
        status: string;
        transactionId: string;
        phoneNumber: string;
        submittedAt: string;
        approvedAt: string | null;
    } | null;
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
    purchaseHistory: PurchaseItem[];
}

type TabKey = "overview" | "courses" | "purchases" | "profile" | "security" | "exams";

const formatDate = (value?: string | null) => {
    if (!value) return "N/A";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "N/A";
    return date.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "2-digit" });
};

const formatDateTime = (value?: string | null) => {
    if (!value) return "N/A";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "N/A";
    return date.toLocaleString("en-GB", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
};

function StudentDashboardContent() {
    const { user, loading, signOut, refreshSession } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

  const [data, setData] = useState<DashboardPayload | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

    const [editingProfile, setEditingProfile] = useState(false);
    const [savingProfile, setSavingProfile] = useState(false);
    const [profileMessage, setProfileMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const [changingPassword, setChangingPassword] = useState(false);
    const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const [profileForm, setProfileForm] = useState<{
        fullName: string;
        phone: string;
        bmdcNumber: string;
        designation: string;
        institution: string;
        degrees: string;
        profileImage: string | null;
    }>({
        fullName: "",
        phone: "",
        bmdcNumber: "",
        designation: "",
        institution: "",
        degrees: "",
        profileImage: "",
    });

    const [passwordForm, setPasswordForm] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
    });

    const activeTab = (searchParams.get("tab") as TabKey) || "overview";

    const setActiveTab = (tab: TabKey) => {
        const params = new URLSearchParams(searchParams);
        params.set("tab", tab);
        router.push(`?${params.toString()}`);
    };

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (loading || !user) return;

    let cancelled = false;

    const fetchDashboard = async () => {
      try {
        setFetching(true);
        const token = localStorage.getItem("auth_token");
        const response = await fetch("/api/me/dashboard", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "Failed to load dashboard data.");
        }

        if (!cancelled) {
          setData(payload as DashboardPayload);
          const profile = (payload as DashboardPayload).profile;
          setProfileForm({
            fullName: profile.fullName || "",
            phone: profile.phone || "",
            bmdcNumber: profile.bmdcNumber || "",
            designation: profile.designation || "",
            institution: profile.institution || "",
            degrees: profile.degrees || "",
            profileImage: profile.profileImage || "",
          });
          setError(null);
        }
      } catch (fetchError: any) {
        if (!cancelled) {
          setError(fetchError.message || "Failed to load dashboard data.");
        }
      } finally {
        if (!cancelled) {
          setFetching(false);
        }
      }
    };

    fetchDashboard();

    return () => {
      cancelled = true;
    };
  }, [loading, user, router]);

  const navItems = useMemo(
    () => [
      { key: "overview", label: "Overview", icon: LayoutDashboard, mobilePrimary: true },
      { key: "courses", label: "Courses", icon: BookOpen, mobilePrimary: true },
      { key: "purchases", label: "Purchases", icon: Receipt, mobilePrimary: true },
      { key: "profile", label: "Profile", icon: UserCog },
      { key: "security", label: "Security", icon: ShieldCheck },
    ],
    []
  );

  const quickStats = useMemo(() => {
    if (!data) {
      return [
        { label: "Active Courses", value: "0", icon: BookOpen },
        { label: "Completed Lessons", value: "0", icon: CheckCircle2 },
        { label: "Average Progress", value: "0%", icon: LineChart },
        { label: "Total Purchases", value: "0", icon: Wallet },
      ];
    }

    return [
      { label: "Active Courses", value: String(data.studyStats.activeCourses), icon: BookOpen },
      { label: "Completed Lessons", value: String(data.studyStats.completedLessons), icon: CheckCircle2 },
      { label: "Average Progress", value: `${data.studyStats.averageProgress}%`, icon: LineChart },
      { label: "Total Purchases", value: String(data.studyStats.totalPurchases), icon: Wallet },
    ];
  }, [data]);

  const handleLogout = async () => {
    await signOut();
    router.push("/");
  };

  const handleProfileImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setProfileMessage({ type: "error", text: "Please choose a valid image file." });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setProfileMessage({ type: "error", text: "Image size must be 2MB or less." });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setProfileForm((prev) => ({ ...prev, profileImage: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingProfile(true);
    setProfileMessage(null);

    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/user/update-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(profileForm),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to update profile.");
      }

      setProfileMessage({ type: "success", text: "Profile updated successfully." });
      setEditingProfile(false);
      await refreshSession();

      const refreshResponse = await fetch("/api/me/dashboard", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const refreshPayload = await refreshResponse.json();
      if (refreshResponse.ok) {
        setData(refreshPayload as DashboardPayload);
      }
    } catch (saveError: any) {
      setProfileMessage({ type: "error", text: saveError.message || "Failed to update profile." });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordMessage(null);

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordMessage({ type: "error", text: "All password fields are required." });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage({ type: "error", text: "New password and confirmation do not match." });
      return;
    }

    setChangingPassword(true);

    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/user/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to change password.");
      }

      setPasswordMessage({ type: "success", text: "Password changed successfully." });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (changeError: any) {
      setPasswordMessage({ type: "error", text: changeError.message || "Failed to change password." });
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading || !user) {
    return <div className={styles.loader}>Loading student portal...</div>;
  }

  return (
    <DashboardShell
      title="Student Portal"
      subtitle="Your study hub for courses, purchases, profile, and account security."
      roleLabel="Student"
      userName={data?.profile.fullName || user.user_metadata?.full_name || user.email?.split("@")[0] || "Student"}
      userEmail={data?.profile.email || user.email}
      userAvatarUrl={profileForm.profileImage || user.user_metadata?.profile_image || null}
      items={navItems}
      activeKey={activeTab}
      onSelect={(key) => setActiveTab(key as TabKey)}
      onLogout={handleLogout}
    >
      {error && (
        <section className={styles.alertCard}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </section>
      )}

      {fetching && !data ? <div className={styles.loaderInline}>Loading your workspace...</div> : null}

      {activeTab === "overview" && data && (
        <div className={styles.stack}>
          <section className={styles.metricsGrid}>
            {quickStats.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.label} className={styles.metricCard}>
                  <span className={styles.metricIcon}><Icon size={18} /></span>
                  <div>
                    <strong>{item.value}</strong>
                    <p>{item.label}</p>
                  </div>
                </article>
              );
            })}
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>Continue Learning</h2>
              <Link href="/courses" className={styles.inlineLink}>Explore catalog <ExternalLink size={14} /></Link>
            </div>
            <div className={styles.courseGrid}>
              {data.enrolledCourses.slice(0, 3).map((course) => (
                <article key={course.orderId} className={styles.courseCard}>
                  <div className={styles.thumb}>
                    <Image src={course.imageUrl || "/placeholder.svg"} alt={course.courseTitle} fill className={styles.thumbImage} unoptimized />
                  </div>
                  <div className={styles.courseBody}>
                    <span className={styles.category}>{course.category}</span>
                    <h3>{course.courseTitle}</h3>
                    <div className={styles.progressTrack}>
                      <div className={styles.progressFill} style={{ width: `${course.progress.percentage}%` }} />
                    </div>
                    <div className={styles.courseMeta}>
                      <span>{course.progress.completedCount}/{course.progress.totalCount} lessons</span>
                      {course.courseSlug ? (
                        <Link href={`/study/${course.courseSlug}`} className={styles.resumeBtn}>Resume</Link>
                      ) : (
                        <span className={styles.resumeBtnDisabled}>Unavailable</span>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>Helpful Options</h2>
              <span className={styles.panelHint}>Shortcuts</span>
            </div>
            <div className={styles.quickActionGrid}>
              <Link className={styles.quickAction} href="/courses"><BookOpen size={16} /> Browse Courses</Link>
              <Link className={styles.quickAction} href="/dashboard?tab=purchases"><CreditCard size={16} /> Purchase History</Link>
              <Link className={styles.quickAction} href="/contact"><Phone size={16} /> Contact Support</Link>
              <button className={styles.quickAction} onClick={() => setActiveTab("security")}><Lock size={16} /> Security Settings</button>
            </div>
          </section>
        </div>
      )}

      {activeTab === "courses" && data && (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>My Courses & Progress</h2>
            <span className={styles.panelHint}>{data.enrolledCourses.length} active enrollments</span>
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
                    <span className={styles.enrolledAt}>Enrolled {formatDate(course.enrolledAt)}</span>
                  </div>

                  <div className={styles.progressRow}>
                    <div className={styles.progressTrackLarge}>
                      <div className={styles.progressFill} style={{ width: `${course.progress.percentage}%` }} />
                    </div>
                    <strong>{course.progress.percentage}%</strong>
                  </div>

                  <div className={styles.courseListBottom}>
                    <span>{course.progress.completedCount}/{course.progress.totalCount} completed</span>
                    {course.courseSlug ? (
                      <Link href={`/study/${course.courseSlug}`} className={styles.resumeBtn}>Go to Study</Link>
                    ) : (
                      <span className={styles.resumeBtnDisabled}>Course unavailable</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === "purchases" && data && (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Purchase History</h2>
            <span className={styles.panelHint}>{data.purchaseHistory.length} purchases</span>
          </div>

          {data.purchaseHistory.length === 0 ? (
            <p className={styles.emptyText}>You do not have any purchase records yet.</p>
          ) : (
            <div className={styles.purchaseList}>
              {data.purchaseHistory.map((purchase) => (
                <article key={purchase.id} className={styles.purchaseCard}>
                  <div className={styles.purchaseHead}>
                    <div>
                      <h3>{purchase.course.title}</h3>
                      <p>Order #{purchase.id.slice(-8).toUpperCase()}</p>
                    </div>
                    <span className={`${styles.statusBadge} ${styles[`status_${purchase.status}`]}`}>
                      {purchase.status}
                    </span>
                  </div>

                  <div className={styles.purchaseMetaGrid}>
                    <div>
                      <span>Amount</span>
                      <strong>৳{purchase.totalAmount.toLocaleString()}</strong>
                    </div>
                    <div>
                      <span>Discount</span>
                      <strong>৳{purchase.discountAmount.toLocaleString()}</strong>
                    </div>
                    <div>
                      <span>Coupon</span>
                      <strong>{purchase.couponCode || "N/A"}</strong>
                    </div>
                    <div>
                      <span>Purchased</span>
                      <strong>{formatDate(purchase.createdAt)}</strong>
                    </div>
                  </div>

                  <div className={styles.paymentDetails}>
                    <h4><Receipt size={15} /> Payment Details</h4>
                    {purchase.payment ? (
                      <ul>
                        <li>Transaction ID: {purchase.payment.transactionId}</li>
                        <li>Status: {purchase.payment.status}</li>
                        <li>Phone: {purchase.payment.phoneNumber}</li>
                        <li>Submitted: {formatDateTime(purchase.payment.submittedAt)}</li>
                        <li>Approved: {formatDateTime(purchase.payment.approvedAt)}</li>
                      </ul>
                    ) : (
                      <p>No payment details available for this order.</p>
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
            <h2>Profile Details</h2>
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
              <span className={styles.memberSince}>Member since {formatDate(data.profile.createdAt)}</span>

              {editingProfile && (
                <label className={styles.uploadBtn}>
                  Upload Image
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
                    <label>Email</label>
                    <input value={data.profile.email} disabled />
                  </div>
                </div>

                <div className={styles.formRowTwo}>
                  <div className={styles.formGroup}>
                    <label>Phone</label>
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
                    <label>Designation</label>
                    <input
                      value={profileForm.designation}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, designation: event.target.value }))}
                      disabled={!editingProfile}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label>Institution</label>
                    <input
                      value={profileForm.institution}
                      onChange={(event) => setProfileForm((prev) => ({ ...prev, institution: event.target.value }))}
                      disabled={!editingProfile}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label>Degrees</label>
                  <input
                  />
                </div>

                {profileMessage && (
                  <div className={`${styles.message} ${profileMessage.type === "success" ? styles.success : styles.error}`}>
                    {profileMessage.text}
                  </div>
                )}

                {editingProfile && (
                  <button className={styles.primaryBtn} type="submit" disabled={savingProfile}>
                    {savingProfile ? "Saving..." : "Save Profile"}
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
              <h2>Password & Security</h2>
              <span className={styles.panelHint}>Recommended</span>
            </div>

            <form className={styles.securityForm} onSubmit={handleChangePassword}>
              <div className={styles.formGroup}>
                <label>Current Password</label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(event) => setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
                  required
                />
              </div>

              <div className={styles.formRowTwo}>
                <div className={styles.formGroup}>
                  <label>New Password</label>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(event) => setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))}
                    required
                    minLength={8}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Confirm Password</label>
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
                <KeyRound size={16} /> {changingPassword ? "Updating..." : "Change Password"}
              </button>
            </form>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>Helpful Security Tips</h2>
            </div>
            <ul className={styles.tipList}>
              <li><ShieldCheck size={15} /> Use a unique password with letters, numbers, and symbols.</li>
              <li><Clock size={15} /> Update your password regularly, especially after shared-device usage.</li>
              <li><Lock size={15} /> Avoid sharing OTP, session tokens, or login credentials.</li>
            </ul>
          </section>
        </div>
      )}
      {activeTab === "exams" && (
          <section className={styles.panel}>
              <h2 className={styles.panelTitle}>Upcoming Exams</h2>
              <div className={styles.examCards}>
                  <article className={styles.examCard}>
                      <h3>BCPS Part I Mock</h3>
                      <p>March 15 · Timed mock with analytics</p>
                  </article>
                  <article className={styles.examCard}>
                      <h3>Surgery Masterquiz</h3>
                      <p>March 28 · High-yield revision sprint</p>
                  </article>
              </div>
          </section>
      )}
    </DashboardShell>
  );
}

export default function StudentDashboard() {
  return (
    <Suspense fallback={<div className={styles.loader}>Loading student portal...</div>}>
      <StudentDashboardContent />
    </Suspense>
  );
}
