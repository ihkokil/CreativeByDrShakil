"use client";

import { useAuth } from "@/context/AuthContext";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Upload, Trash2, Phone, User as UserIcon, IdCard, CheckCircle2, AlertCircle } from "lucide-react";
import styles from "./ProfileTab.module.css";

export default function ProfileTab() {
    const { user, refreshSession, role } = useAuth();

    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [bmdcNumber, setBmdcNumber] = useState("");
    const [profileImage, setProfileImage] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    useEffect(() => {
        if (user) {
            setFullName(user.user_metadata?.full_name || user.email?.split("@")[0] || "");
            setPhone(user.user_metadata?.phone || user.phone || "");
            setBmdcNumber(user.user_metadata?.bmdc_number || "");
            setProfileImage(user.user_metadata?.profile_image || null);
        }
    }, [user]);

    const initials = (fullName || user?.email || "DR")
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

    const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        if (!file.type.startsWith("image/")) {
            setMessage({ type: "error", text: "Please choose a valid image file." });
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            setMessage({ type: "error", text: "Image must be 2MB or smaller." });
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === "string") {
                setProfileImage(reader.result);
                setMessage(null);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async (event: React.FormEvent) => {
        event.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            const token = localStorage.getItem("auth_token");
            const response = await fetch("/api/user/update-profile", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    fullName,
                    phone,
                    bmdcNumber,
                    profileImage,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setMessage({ type: "error", text: data.error || "Failed to update profile." });
            } else {
                setMessage({ type: "success", text: "Profile updated successfully." });
                await refreshSession();
            }
        } catch (err) {
            setMessage({ type: "error", text: "An error occurred while saving profile." });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={styles.stack}>
            <section className={styles.panel}>
                <div className={styles.header}>
                    <h2 className={styles.panelTitle}>{role === 'admin' ? 'Administrative Profile' : 'Professional Profile'}</h2>
                    <p className={styles.subtitle}>{role === 'admin' ? 'Manage your administrative identity and contact details.' : 'Update your identity and clinical credentials.'}</p>
                </div>

                <form className={styles.form} onSubmit={handleSave}>
                    <div className={styles.avatarRow}>
                        <div className={styles.avatarPreview}>
                            {profileImage ? (
                                <Image src={profileImage} alt="Profile preview" fill unoptimized className={styles.avatarImage} sizes="120px" />
                            ) : (
                                <span>{initials}</span>
                            )}
                        </div>

                        <div className={styles.avatarActions}>
                            <label className={styles.uploadBtn}>
                                <Upload size={16} />
                                Update Profile Photo
                                <input type="file" accept="image/*" onChange={handleImageSelect} />
                            </label>

                            <button
                                type="button"
                                className={styles.clearBtn}
                                onClick={() => setProfileImage(null)}
                            >
                                <Trash2 size={16} />
                                Remove
                            </button>

                            <small>PNG/JPG up to 2MB. Recommended 1:1 ratio.</small>
                        </div>
                    </div>

                    <div className={styles.grid}>
                        <div className={styles.field}>
                            <label>Full Name</label>
                            <div className={styles.inputWrap}>
                                <UserIcon size={16} />
                                <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                            </div>
                        </div>

                        <div className={styles.field}>
                            <label>Email Address</label>
                            <input value={user?.email || ""} disabled className={styles.disabledInput} />
                            <small>Email cannot be changed.</small>
                        </div>

                        <div className={styles.field}>
                            <label>Contact Phone</label>
                            <div className={styles.inputWrap}>
                                <Phone size={16} />
                                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+8801XXXXXXXXX" />
                            </div>
                        </div>

                        {role === 'teacher' && (
                            <div className={styles.field}>
                                <label>BMDC Number</label>
                                <div className={styles.inputWrap}>
                                    <IdCard size={16} />
                                    <input value={bmdcNumber} onChange={(e) => setBmdcNumber(e.target.value)} placeholder="BMDC-XXXX" />
                                </div>
                            </div>
                        )}
                    </div>

                    {message && (
                        <div className={`${styles.message} ${styles[message.type]}`}>
                            {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                            {message.text}
                        </div>
                    )}

                    <div className={styles.formFooter}>
                        <button type="submit" className={styles.saveBtn} disabled={saving}>
                            {saving ? "Syncing Changes..." : "Secure Save"}
                        </button>
                    </div>
                </form>
            </section>
        </div>
    );
}
