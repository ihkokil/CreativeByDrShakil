"use client";

import { useAuth } from "@/context/AuthContext";
import DashboardShell from "@/components/DashboardShell/DashboardShell";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { LayoutDashboard, UserCog, Upload, Trash2, Phone, User as UserIcon, IdCard } from "lucide-react";
import styles from "./TeacherUserPage.module.css";

export default function TeacherUserPage() {
    const { user, loading, role, refreshSession, signOut } = useAuth();
    const router = useRouter();

    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [bmdcNumber, setBmdcNumber] = useState("");
    const [profileImage, setProfileImage] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    useEffect(() => {
        if (!loading && (!user || role !== "teacher")) {
            router.push("/");
            return;
        }

        if (user) {
            setFullName(user.user_metadata?.full_name || user.email?.split("@")[0] || "");
            setPhone(user.user_metadata?.phone || user.phone || "");
            setBmdcNumber(user.user_metadata?.bmdc_number || "");
            setProfileImage(user.user_metadata?.profile_image || null);
        }
    }, [loading, role, router, user]);

    const navItems = useMemo(
        () => [
            { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, mobilePrimary: true },
            { key: "user", label: "User Page", icon: UserCog, mobilePrimary: true },
        ],
        []
    );

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

        setSaving(false);
    };

    const handleLogout = async () => {
        await signOut();
        router.push("/");
    };

    if (loading || !user || role !== "teacher") {
        return <div className={styles.loader}>Loading user page...</div>;
    }

    return (
        <DashboardShell
            title="Teacher User Page"
            subtitle="Manage your doctor profile and professional details."
            roleLabel="Teacher"
            userName={user.user_metadata?.full_name || user.email?.split("@")[0] || "Doctor"}
            userEmail={user.email}
            userAvatarUrl={user.user_metadata?.profile_image || null}
            items={navItems}
            activeKey="user"
            onSelect={(key) => router.push(key === "dashboard" ? "/teacher/dashboard" : "/teacher/dashboard/user")}
            onLogout={handleLogout}
        >
            <section className={styles.panel}>
                <h2 className={styles.panelTitle}>Doctor Profile</h2>

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
                                Upload Image
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

                            <small>PNG/JPG up to 2MB.</small>
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
                            <input value={user.email || ""} disabled className={styles.disabledInput} />
                        </div>

                        <div className={styles.field}>
                            <label>Phone</label>
                            <div className={styles.inputWrap}>
                                <Phone size={16} />
                                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+8801XXXXXXXXX" />
                            </div>
                        </div>

                        <div className={styles.field}>
                            <label>BMDC Number</label>
                            <div className={styles.inputWrap}>
                                <IdCard size={16} />
                                <input value={bmdcNumber} onChange={(e) => setBmdcNumber(e.target.value)} placeholder="BMDC-XXXX" />
                            </div>
                        </div>
                    </div>

                    {message && <div className={`${styles.message} ${styles[message.type]}`}>{message.text}</div>}

                    <button type="submit" className={styles.saveBtn} disabled={saving}>
                        {saving ? "Saving..." : "Save Profile"}
                    </button>
                </form>
            </section>
        </DashboardShell>
    );
}
