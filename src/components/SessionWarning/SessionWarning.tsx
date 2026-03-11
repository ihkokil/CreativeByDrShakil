"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import styles from "./SessionWarning.module.css";
import { AlertCircle } from "lucide-react";

export default function SessionWarningToast() {
  const { hasSessionTerminated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (hasSessionTerminated) {
      const timer = setTimeout(() => {
        setTimeout(() => {
          router.push("/");
        }, 300);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [hasSessionTerminated, router]);

  if (!hasSessionTerminated) return null;

  return (
    <div className={styles.toastContainer}>
      <div className={styles.toast}>
        <AlertCircle size={20} />
        <div className={styles.content}>
          <p className={styles.title}>Session Ended</p>
          <p className={styles.message}>
            Your session was logged out from another device. Please log in again.
          </p>
        </div>
      </div>
    </div>
  );
}
