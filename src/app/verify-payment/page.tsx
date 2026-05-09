"use client";

import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Info,
  Loader2,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import styles from "./page.module.css";

function getStatusCopy(status: string | null, action: string | null, message: string | null) {
  if (status === "success") {
    return {
      tone: "success",
      icon: CheckCircle2,
      eyebrow: "Verification complete",
      title: action === "approve" ? "Payment approved" : "Payment rejected",
      body:
        action === "approve"
          ? "The purchase is now marked as approved and the student can continue into the course flow."
          : "The purchase has been rejected and the student should be notified with the reason if needed.",
    };
  }

  if (status === "error") {
    return {
      tone: "error",
      icon: XCircle,
      eyebrow: "Verification failed",
      title: "We could not complete the request",
      body: message || "The payment verification request could not be processed. Please try again or review the admin record.",
    };
  }

  if (status === "info") {
    return {
      tone: "info",
      icon: Info,
      eyebrow: "Information",
      title: "Verification update received",
      body: message || "A verification update is being processed.",
    };
  }

  return {
    tone: "loading",
    icon: Loader2,
    eyebrow: "Preparing",
    title: "Checking verification details",
    body: "Please wait while we load the payment verification summary.",
  };
}

function VerifyPaymentContent() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const message = searchParams.get("message");
  const action = searchParams.get("action");
  const student = searchParams.get("student");
  const course = searchParams.get("course");
  const copy = getStatusCopy(status, action, message);
  const StatusIcon = copy.icon;

  return (
    <main className={styles.pageShell}>
      <div className={styles.orbTop} />
      <div className={styles.orbBottom} />

      <section className={styles.heroCard}>
        <div className={styles.heroCopy}>
          <div className={styles.badgeRow}>
            <span className={`${styles.statusBadge} ${styles[copy.tone]}`}>
              <StatusIcon className={`${styles.statusIcon} ${copy.tone === "loading" ? styles.spinIcon : ""}`} />
              {copy.eyebrow}
            </span>
            <span className={styles.subBadge}>
              <ShieldCheck className={styles.smallIcon} />
              Secure verification
            </span>
          </div>

          <h1>{copy.title}</h1>
          <p className={styles.lead}>{copy.body}</p>

          <div className={styles.metaGrid}>
            <div className={styles.metaCard}>
              <Sparkles className={styles.metaIcon} />
              <div>
                <strong>Action</strong>
                <span>{action || "pending"}</span>
              </div>
            </div>
            <div className={styles.metaCard}>
              <CreditCard className={styles.metaIcon} />
              <div>
                <strong>Payment status</strong>
                <span>{status || "loading"}</span>
              </div>
            </div>
            <div className={styles.metaCard}>
              <BadgeCheck className={styles.metaIcon} />
              <div>
                <strong>Platform</strong>
                <span>Creative By Dr. Shakil</span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.heroVisual}>
          <div className={styles.visualTopLine}>
            <ClipboardList className={styles.visualIcon} />
            <span>Verification summary</span>
          </div>

          <div className={styles.summaryCard}>
            <div className={styles.summaryHeader}>
              <div>
                <p>Student</p>
                <h2>{student || "Not provided"}</h2>
              </div>
              <div className={`${styles.miniState} ${styles[copy.tone]}`}>
                {status || "loading"}
              </div>
            </div>

            <div className={styles.summaryRows}>
              <div>
                <span>Course</span>
                <strong>{course || "Not provided"}</strong>
              </div>
              <div>
                <span>Verification note</span>
                <strong>{message || "Waiting for a confirmation payload"}</strong>
              </div>
            </div>

            <div className={styles.summaryFooter}>
              <div className={styles.footerPill}>
                <ShieldCheck className={styles.smallIcon} />
                Telegram verified
              </div>
              <div className={styles.footerPill}>
                <CheckCircle2 className={styles.smallIcon} />
                Admin audit ready
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.detailGrid}>
        <article className={styles.detailCard}>
          <p className={styles.cardLabel}>What happened</p>
          <h3>{status === "success" ? "Verified successfully" : status === "error" ? "Manual follow-up needed" : "Awaiting final status"}</h3>
          <p>
            {status === "success"
              ? `The purchase for ${course || "this course"} was ${action === "approve" ? "approved" : "rejected"} by the reviewer.`
              : message || "This page will reflect the state returned from the verification link."}
          </p>
        </article>

        <article className={styles.detailCard}>
          <p className={styles.cardLabel}>Next step</p>
          <h3>Keep the admin flow moving</h3>
          <p>
            Review the order in your dashboard, notify the student if needed, and continue the access flow once the payment decision is final.
          </p>
        </article>
      </section>

      <div className={styles.actionsRow}>
        <Link href="/" className={styles.primaryButton}>
          <ArrowLeft className={styles.buttonIcon} />
          Back to homepage
        </Link>
        <span className={styles.helperText}>Secure verification for student payments and approvals.</span>
      </div>
    </main>
  );
}

export default function VerifyPaymentPage() {
  return (
    <Suspense fallback={
      <main className={styles.pageShell}>
        <div className={styles.loadingCard}>
          <Loader2 className={styles.loadingIcon} />
          <p>Loading verification details...</p>
        </div>
      </main>
    }>
      <VerifyPaymentContent />
    </Suspense>
  );
}
