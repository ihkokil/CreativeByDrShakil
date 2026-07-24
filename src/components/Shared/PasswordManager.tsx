"use client";

import Loader from "@/components/UI/Loader";
import { useState } from "react";
import { 
  KeyRound, 
  ShieldCheck, 
  Lock, 
  RefreshCcw, 
  AlertCircle, 
  CheckCircle2, 
  ShieldAlert,
  Smartphone
} from "lucide-react";
import { motion, AnimatePresence } from 'framer-motion';
import styles from "./PasswordManager.module.css";

export default function PasswordManager() {
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage({ type: "error", text: "New passwords do not match." });
      return;
    }

    setLoading(true);
    setMessage(null);

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

      const data = await response.json();

      if (!response.ok) {
        setMessage({ type: "error", text: data.error || "Failed to update password." });
      } else {
        setMessage({ type: "success", text: "Password updated successfully." });
        setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      }
    } catch (err) {
      setMessage({ type: "error", text: "An unexpected error occurred." });
    } finally {
      setLoading(false);
    }
  };

  const securityTips = [
    {
      icon: <ShieldCheck size={20} />,
      title: "Strong Password Policy",
      desc: "Use at least 8 characters with a mix of symbols, numbers, and cases."
    },
    {
      icon: <RefreshCcw size={20} />,
      title: "Regular Rotation",
      desc: "We recommend updating your password every 90 days for maximum safety."
    },
    {
      icon: <Smartphone size={20} />,
      title: "Session Monitoring",
      desc: "Changes to your password will require re-authentication on all devices."
    }
  ];

  return (
    <div className={styles.wrapper}>
      <div className={styles.bentoGrid}>
        {/* Info Card */}
        <div className={`${styles.card} ${styles.infoSection}`}>
          <div className={styles.titleGroup}>
            <h2>Account Security</h2>
            <p>Maintain control over your identity and digital credentials.</p>
          </div>

          <div className={styles.tipList}>
            {securityTips.map((tip, i) => (
              <div key={i} className={styles.tipItem}>
                {tip.icon}
                <div className={styles.tipText}>
                  <strong>{tip.title}</strong>
                  <span>{tip.desc}</span>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.securityBanner}>
            <ShieldAlert size={18} />
            <span>Never share your password with anyone. We will never ask for it via email.</span>
          </div>
        </div>

        {/* Form Card */}
        <div className={`${styles.card} ${styles.formSection}`}>
          <div className={styles.titleGroup}>
            <h2>Update Password</h2>
            <p>Enter your current credentials to authorize a change.</p>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.inputGroup}>
              <label>Current Password</label>
              <div className={styles.inputWrapper}>
                <Lock size={18} />
                <input
                  type="password"
                  className={styles.input}
                  placeholder="••••••••"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm(p => ({ ...p, currentPassword: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label>New Password</label>
              <div className={styles.inputWrapper}>
                <KeyRound size={18} />
                <input
                  type="password"
                  className={styles.input}
                  placeholder="Min. 8 characters"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm(p => ({ ...p, newPassword: e.target.value }))}
                  required
                  minLength={8}
                />
              </div>
            </div>

            <div className={styles.inputGroup}>
              <label>Confirm New Password</label>
              <div className={styles.inputWrapper}>
                <ShieldCheck size={18} />
                <input
                  type="password"
                  className={styles.input}
                  placeholder="Confirm new password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm(p => ({ ...p, confirmPassword: e.target.value }))}
                  required
                  minLength={8}
                />
              </div>
            </div>

            {message && (
              <div className={`${styles.message} ${styles[message.type]}`}>
                {message.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                {message.text}
              </div>
            )}

            <button type="submit" className={styles.submitButton} disabled={loading}>
              {loading ? <Loader variant="button" /> : <RefreshCcw size={18} />}
              {loading ? "Syncing Credentials..." : "Update Password"}
            </button>
          </form>
        </div>
      </div>
      
    </div>
  );
}
