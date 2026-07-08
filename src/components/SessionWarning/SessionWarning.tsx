"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import styles from "./SessionWarning.module.css";
import { AlertCircle, X } from "lucide-react";

const SESSION_TOAST_KEY = "session_terminated_toast_shown";

export default function SessionWarningToast() {
  const { hasSessionTerminated, sessionTerminatedReason } = useAuth();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  // Track if we already showed it this browser session
  const shownRef = useRef(false);

  useEffect(() => {
    if (!hasSessionTerminated) return;

    // Already shown once this browser session — don't show again
    if (shownRef.current || sessionStorage.getItem(SESSION_TOAST_KEY)) return;

    shownRef.current = true;
    sessionStorage.setItem(SESSION_TOAST_KEY, "1");
    setVisible(true);
    setClosing(false);
  }, [hasSessionTerminated]);

  const dismiss = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setVisible(false);
      router.push("/");
    }, 300);
  }, [router]);

  // Auto-close after 5 seconds
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => dismiss(), 5000);
    return () => clearTimeout(timer);
  }, [visible, dismiss]);

  if (!visible) return null;

  return (
    <div className={`${styles.toastContainer} ${closing ? styles.closing : ""}`}>
      <div className={styles.toast}>
        <AlertCircle size={20} className={styles.icon} />
        <div className={styles.content}>
          <p className={styles.title}>Session Ended</p>
          <p className={styles.message}>
            {sessionTerminatedReason || "Your session was logged out from another device. Please log in again."}
          </p>
        </div>
        <button
          className={styles.closeButton}
          onClick={dismiss}
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
      <div className={styles.progressBar} />
    </div>
  );
}
