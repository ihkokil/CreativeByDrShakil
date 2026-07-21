"use client";

import { useState, useEffect } from "react";
import { useDashboardData } from "@/hooks/useDashboardData";
import { UserCog, Camera, Trash2, Mail, Stethoscope, Save, Loader2, AlertTriangle } from "lucide-react";
import Image from "next/image";
import profileStyles from "../ProfileTab.module.css";
import ImageCropper from "@/components/Shared/ImageCropper";
import { formatDateTextGMT6 } from "@/lib/date-format";
import styles from "../Dashboard.module.css";

export default function ProfilePage() {
    const { data, setData, fetching, error } = useDashboardData();
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
    const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);

    useEffect(() => {
        if (data) {
            setProfileForm({
                fullName: data.profile.fullName || "",
                phone: data.profile.phone || "",
                bmdcNumber: data.profile.bmdcNumber || "",
                designation: data.profile.designation || "",
                institution: data.profile.institution || "",
                degrees: data.profile.degrees || "",
                profileImage: data.profile.profileImage || null
            });
        }
    }, [data]);

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
        formData.append("file", croppedBlob, "profile.webp");
        formData.append("folder", "profiles");
    
        try {
          const token = localStorage.getItem("auth_token");
          const res = await fetch("/api/upload", {
            method: "POST",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: formData,
          });
          const resData = await res.json();
          if (res.ok) {
            setProfileForm((prev) => ({ ...prev, profileImage: resData.url }));
            setProfileMessage({ type: "success", text: "Image optimized and uploaded! Remember to click Save." });
          } else {
            setProfileMessage({ type: "error", text: resData.error || "Failed to upload image." });
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

    if (fetching && !data) return <div className={styles.loaderInline}>Securing your workspace...</div>;
    if (error) return <section className={styles.alertCard}><AlertTriangle size={18} /><span>{error}</span></section>;
    if (!data) return null;

    return (
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
                    <span>{(profileForm.fullName || data.profile.fullName || "").slice(0, 2).toUpperCase()}</span>
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
                {data.profile.role.toUpperCase()}
              </div>

              <div className={profileStyles.statsRow}>
                <div className={profileStyles.statItem}>
                  <span className={profileStyles.statLabel}>Member Since</span>
                  <span className={profileStyles.statValue}>{formatDateTextGMT6(data.profile.createdAt)}</span>
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
          
          {cropImageSrc && (
            <ImageCropper
                imageSrc={cropImageSrc}
                onClose={() => setCropImageSrc(null)}
                onCropComplete={handleCropComplete}
            />
          )}
        </div>
    );
}
