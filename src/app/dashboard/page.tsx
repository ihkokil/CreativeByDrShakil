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
    CalendarDays,
    Timer,
    GraduationCap,
    Sparkles,
    Play
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import StudentOverview from "@/components/Student/StudentOverview";
import profileStyles from "./ProfileTab.module.css";
import { Camera, Mail, Stethoscope, Save, Trash2, KeyRound, Lock, ShieldCheck, Clock } from "lucide-react";
import PasswordManager from "@/components/Shared/PasswordManager";
import Loader from "@/components/UI/Loader";
import ImageCropper from "@/components/Shared/ImageCropper";

interface DashboardCourse {
    orderId: string;
    courseId: string;
    courseSlug: string | null;
    courseTitle: string;
    imageUrl?: string | null;
    duration: string;
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
    purchaseHistory: Array<{
        id: string;
        status: string;
        totalAmount: number;
        createdAt: string;
        updatedAt: string;
        course: { id: string; title: string; slug: string | null };
        payment: null | {
            id: string;
            status: string;
            transactionId: string;
            phoneNumber: string;
            submittedAt: string;
            approvedAt: string | null;
        };
    }>;
}

function StudentDashboardContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeTab = (searchParams.get("tab") as "overview" | "courses" | "purchases" | "profile" | "security") || "overview";

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

  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);

  const handleProfileImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setProfileMessage({ type: "error", text: "Please choose a valid image file." });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setProfileMessage({ type: "error", text: "Original image must be 5MB or smaller." });
      return;
    }

    // Instead of uploading right away, we load it into the cropper
    const reader = new FileReader();
    reader.onload = () => {
        setCropImageSrc(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    setCropImageSrc(null);
    setProfileMessage({ type: "success", text: "Optimizing and uploading profile image..." });
    const formData = new FormData();
    // Pass the cropped blob as a webp file
    formData.append("file", croppedBlob, "profile.webp");
    formData.append("folder", "profiles");

    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setProfileForm((prev) => ({ ...prev, profileImage: data.url }));
        setProfileMessage({ type: "success", text: "Image optimized and uploaded! Remember to click Save." });
      } else {
        setProfileMessage({ type: "error", text: data.error || "Failed to upload image." });
      }
    } catch (err) {
      setProfileMessage({ type: "error", text: "Failed to upload image." });
    }
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


  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  };

  const getExpiryDate = (dateStr: string) => {
    const date = new Date(dateStr);
    date.setFullYear(date.getFullYear() + 1);
    return formatDate(date.toISOString());
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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
        <div className={styles.coursesTab}>
          {/* Courses Header */}
          <div className={styles.coursesHeader}>
            <div className={styles.coursesHeaderLeft}>
              <div className={styles.coursesHeaderIcon}>
                <GraduationCap size={22} />
              </div>
              <div>
                <h2 className={styles.coursesTitle}>My Learning</h2>
                <p className={styles.coursesSubtitle}>
                  {data.enrolledCourses.length} {data.enrolledCourses.length === 1 ? 'course' : 'courses'} enrolled
                </p>
              </div>
            </div>
            {data.enrolledCourses.length > 0 && (
              <div className={styles.coursesHeaderStats}>
                <div className={styles.coursesMiniStat}>
                  <span>{data.studyStats.completedLessons}</span>
                  <label>Lessons Done</label>
                </div>
                <div className={styles.coursesMiniStat}>
                  <span>{data.studyStats.averageProgress}%</span>
                  <label>Avg. Progress</label>
                </div>
              </div>
            )}
          </div>

          {data.enrolledCourses.length === 0 ? (
            <div className={styles.coursesEmpty}>
              <div className={styles.coursesEmptyIcon}>
                <Sparkles size={32} />
              </div>
              <h3>No courses yet</h3>
              <p>Your learning journey starts here. Enroll in a course to begin.</p>
            </div>
          ) : (
            <div className={styles.coursesGrid}>
              {data.enrolledCourses.map((course) => {
                const pct = course.progress.percentage;
                const circumference = 2 * Math.PI * 28;
                const dashOffset = circumference - (pct / 100) * circumference;
                const isComplete = pct === 100;
                return (
                  <article key={course.orderId} className={styles.courseCard2}>
                    {/* Card Image / Gradient Header */}
                    <div className={styles.courseCardHeader}>
                      {course.imageUrl ? (
                        <Image
                          src={course.imageUrl}
                          alt={course.courseTitle}
                          fill
                          className={styles.courseCardImg}
                          unoptimized
                        />
                      ) : null}
                      <div className={styles.courseCardOverlay} />
                      {/* Circular Progress */}
                      <div className={styles.courseCardRing}>
                        <svg viewBox="0 0 64 64" className={styles.ringChart}>
                          <circle cx="32" cy="32" r="28" className={styles.ringBg} />
                          <circle
                            cx="32" cy="32" r="28"
                            className={styles.ringFill}
                            strokeDasharray={circumference}
                            strokeDashoffset={dashOffset}
                            style={{ '--ring-color': isComplete ? '#10b981' : '#3b82f6' } as React.CSSProperties}
                          />
                        </svg>
                        <span className={styles.ringLabel}>{pct}%</span>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div className={styles.courseCardBody}>
                      <h3 className={styles.courseCardTitle}>{course.courseTitle}</h3>

                      <div className={styles.courseCardMeta}>
                        <div className={styles.courseCardMetaItem}>
                          <Timer size={13} />
                          <span>{course.duration}</span>
                        </div>
                        <div className={styles.courseCardMetaItem}>
                          <BookOpen size={13} />
                          <span>{course.progress.completedCount}/{course.progress.totalCount}</span>
                        </div>
                      </div>

                      {/* Linear Progress */}
                      <div className={styles.courseCardProgress}>
                        <div className={styles.courseCardTrack}>
                          <div
                            className={styles.courseCardFill}
                            style={{
                              width: `${pct}%`,
                              background: isComplete
                                ? 'linear-gradient(90deg, #10b981, #34d399)'
                                : 'linear-gradient(90deg, #3b82f6, #8b5cf6)'
                            }}
                          />
                        </div>
                      </div>

                      <div className={styles.courseCardDates}>
                        <div className={styles.courseCardDate}>
                          <CalendarDays size={12} />
                          <span>Joined {formatDate(course.enrolledAt)}</span>
                        </div>
                        <div className={styles.courseCardDate} style={{ color: 'var(--primary)' }}>
                          <Timer size={12} />
                          <span>Expires {getExpiryDate(course.enrolledAt)}</span>
                        </div>
                      </div>

                      {course.courseSlug ? (
                        <Link href={`/study/${course.courseSlug}`} className={styles.courseCardAction}>
                          <Play size={15} />
                          {isComplete ? 'Review Course' : pct > 0 ? 'Continue Learning' : 'Start Learning'}
                          <ArrowRight size={15} />
                        </Link>
                      ) : (
                        <span className={styles.courseCardActionDisabled}>
                          Access Restricted
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "purchases" && data && (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Payments</h2>
              <p className={styles.subtitle}>
                Track your payment approvals. Course access is enabled after admin approval.
              </p>
            </div>
          </div>

          {data.purchaseHistory.length === 0 ? (
            <p className={styles.emptyText}>No purchases yet.</p>
          ) : (
            <div className={styles.courseList}>
              {data.purchaseHistory.map((order) => {
                const orderStatus = String(order.status || "").toLowerCase();
                const paymentStatus = String(order.payment?.status || orderStatus || "").toLowerCase();
                const isApproved = orderStatus === "approved";
                const isRejected = orderStatus === "rejected";
                const isPending = !isApproved && !isRejected;

                return (
                  <article key={order.id} className={styles.courseListCard}>
                    <div className={styles.courseListTop}>
                      <div>
                        <h3>{order.course?.title || "Course"}</h3>
                        <p>
                          Amount: ৳{Math.round(order.totalAmount)}
                        </p>
                      </div>
                      <span className={styles.enrolledAt}>Requested {formatDate(order.createdAt)}</span>
                    </div>

                    <div className={styles.progressRow} style={{ alignItems: "center" }}>
                      <div>
                        <strong>Status:</strong>{" "}
                        <span
                          style={{
                            fontWeight: 800,
                            color: isApproved ? "var(--success)" : isRejected ? "var(--danger)" : "var(--primary)",
                          }}
                        >
                          {isApproved ? "APPROVED" : isRejected ? "REJECTED" : "PENDING"}
                        </span>
                        <div style={{ color: "var(--text-muted)", marginTop: 4 }}>
                          Payment: {paymentStatus ? paymentStatus.toUpperCase() : "—"}
                          {order.payment?.transactionId ? ` · TX: ${order.payment.transactionId}` : ""}
                        </div>
                        {order.payment?.submittedAt ? (
                          <div style={{ color: "var(--text-muted)", marginTop: 2 }}>
                            Submitted {formatDateTime(order.payment.submittedAt)}
                          </div>
                        ) : null}
                        {order.payment?.approvedAt ? (
                          <div style={{ color: "var(--text-muted)", marginTop: 2 }}>
                            Approved {formatDateTime(order.payment.approvedAt)}
                          </div>
                        ) : null}
                      </div>

                      <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
                        {isApproved && order.course?.slug ? (
                          <Link href={`/study/${order.course.slug}`} className={styles.resumeBtn}>
                            Enter Classroom
                          </Link>
                        ) : isPending ? (
                          <span className={styles.resumeBtnDisabled}>Awaiting approval</span>
                        ) : (
                          <span className={styles.resumeBtnDisabled}>Access denied</span>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {activeTab === "profile" && data && (
        <div className={profileStyles.wrapper}>
          <header className={profileStyles.header}>
            <div className={profileStyles.headerTitle}>
              <h2>Profile Settings</h2>
              <p>Manage your medical credentials and personal identity</p>
            </div>
            <button 
              className={`${profileStyles.editButton} ${editingProfile ? profileStyles.active : ""}`} 
              onClick={() => setEditingProfile(!editingProfile)}
            >
              <UserCog size={18} />
              {editingProfile ? "Finish Editing" : "Edit Profile"}
            </button>
          </header>

          <div className={profileStyles.bentoGrid}>
            <aside className={`${profileStyles.card} ${profileStyles.identityCard}`}>
              <div className={profileStyles.avatarWrapper}>
                <div className={profileStyles.avatar}>
                  {profileForm.profileImage ? (
                    <Image 
                      src={profileForm.profileImage} 
                      alt={profileForm.fullName || "Profile"} 
                      fill 
                      className={profileStyles.avatarImage} 
                      unoptimized 
                    />
                  ) : (
                    <span>{(profileForm.fullName || data.profile.fullName).slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
              </div>

              {editingProfile && (
                <div className={profileStyles.avatarActions}>
                  <label className={profileStyles.uploadBtn}>
                    <Camera size={16} />
                    Update Photo
                    <input type="file" accept="image/*" onChange={handleProfileImageSelect} />
                  </label>
                  <button 
                    type="button" 
                    className={profileStyles.removeBtn}
                    onClick={() => setProfileForm(prev => ({ ...prev, profileImage: null }))}
                    title="Remove Photo"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}

              <h3 className={profileStyles.userName}>{profileForm.fullName || data.profile.fullName}</h3>
              <p className={profileStyles.userEmail}>{data.profile.email}</p>
              
              <div className={profileStyles.roleBadge}>
                {data.profile.role} Student
              </div>

              <div className={profileStyles.statsRow}>
                <div className={profileStyles.statItem}>
                  <span className={profileStyles.statLabel}>Member Since</span>
                  <span className={profileStyles.statValue}>{formatDate(data.profile.createdAt)}</span>
                </div>
                <div className={profileStyles.statItem}>
                  <span className={profileStyles.statLabel}>Active Courses</span>
                  <span className={profileStyles.statValue}>{data.studyStats.activeCourses}</span>
                </div>
              </div>
            </aside>

            <main className={profileStyles.formSections}>
              <section className={profileStyles.card}>
                <div className={profileStyles.sectionHeader}>
                  <UserCog size={20} className={profileStyles.sectionIcon} />
                  <h3>Personal Information</h3>
                </div>
                
                <form className={profileStyles.profileForm} onSubmit={handleSaveProfile}>
                  <div className={profileStyles.formGrid}>
                    <div className={profileStyles.formGroup}>
                      <label>Full Name</label>
                      <input
                        className={profileStyles.input}
                        value={profileForm.fullName}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, fullName: e.target.value }))}
                        disabled={!editingProfile}
                        placeholder="Dr. John Doe"
                        required
                      />
                    </div>
                    <div className={profileStyles.formGroup}>
                      <label>Email Address</label>
                      <div style={{ position: 'relative' }}>
                        <input className={profileStyles.input} value={data.profile.email} disabled />
                        <Mail size={16} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      </div>
                    </div>
                    <div className={profileStyles.formGroup}>
                      <label>Contact Phone</label>
                      <input
                        className={profileStyles.input}
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, phone: e.target.value }))}
                        disabled={!editingProfile}
                        placeholder="+880..."
                      />
                    </div>
                    <div className={profileStyles.formGroup}>
                      <label>BM&DC Number</label>
                      <input
                        className={profileStyles.input}
                        value={profileForm.bmdcNumber}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, bmdcNumber: e.target.value }))}
                        disabled={!editingProfile}
                        placeholder="A-12345"
                      />
                    </div>
                  </div>

                  <div style={{ marginTop: '24px' }}>
                    <div className={profileStyles.sectionHeader}>
                      <Stethoscope size={20} className={profileStyles.sectionIcon} />
                      <h3>Professional Details</h3>
                    </div>
                    <div className={profileStyles.formGrid}>
                      <div className={profileStyles.formGroup}>
                        <label>Current Designation</label>
                        <input
                          className={profileStyles.input}
                          value={profileForm.designation}
                          onChange={(e) => setProfileForm(prev => ({ ...prev, designation: e.target.value }))}
                          disabled={!editingProfile}
                          placeholder="Medical Officer"
                        />
                      </div>
                      <div className={profileStyles.formGroup}>
                        <label>Affiliated Institution</label>
                        <input
                          className={profileStyles.input}
                          value={profileForm.institution}
                          onChange={(e) => setProfileForm(prev => ({ ...prev, institution: e.target.value }))}
                          disabled={!editingProfile}
                          placeholder="DMC / BSMMU"
                        />
                      </div>
                      <div className={`${profileStyles.formGroup} ${profileStyles.fullWidth}`}>
                        <label>Degrees</label>
                        <input
                          className={profileStyles.input}
                          value={profileForm.degrees}
                          onChange={(e) => setProfileForm(prev => ({ ...prev, degrees: e.target.value }))}
                          disabled={!editingProfile}
                          placeholder="MBBS, FCPS Part 1 (Surgery)"
                        />
                      </div>
                    </div>
                  </div>

                  {profileMessage && (
                    <div className={`${profileStyles.message} ${profileStyles[profileMessage.type]}`}>
                      {profileMessage.text}
                    </div>
                  )}

                  {editingProfile && (
                    <button className={profileStyles.saveButton} type="submit" disabled={savingProfile}>
                      {savingProfile ? <Loader2 size={18} className="spinner" /> : <Save size={18} />}
                      {savingProfile ? "Encrypting Changes..." : "Save Profile Details"}
                    </button>
                  )}
                </form>
              </section>
            </main>
          </div>
        </div>
      )}

      {activeTab === "security" && (
        <PasswordManager />
      )}

      {cropImageSrc && (
        <ImageCropper
            imageSrc={cropImageSrc}
            onClose={() => setCropImageSrc(null)}
            onCropComplete={handleCropComplete}
        />
      )}
    </>
  );
}

export default function StudentDashboard() {
  return (
    <Suspense fallback={<Loader text="Loading student portal..." />}>
      <StudentDashboardContent />
    </Suspense>
  );
}
