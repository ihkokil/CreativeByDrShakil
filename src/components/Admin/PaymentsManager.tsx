"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Loader from "@/components/UI/Loader";
import { formatDateGMT6 } from "@/lib/date-format";
import styles from "@/app/admin/dashboard/AdminDashboard.module.css";
import { CheckCircle2, Clock, XCircle } from "lucide-react";

type PaymentStatus = "pending" | "approved" | "rejected";

type OrderRow = {
  id: string;
  status: PaymentStatus | string;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
  user: { id: string; fullName: string; email: string };
  course: { id: string; title: string; slug: string | null };
  payment: null | {
    phoneNumber: string;
    transactionId: string;
    amount: number;
    status: PaymentStatus | string;
    submittedAt: string;
  };
};

const STATUS_TABS: { id: PaymentStatus; label: string; icon: any }[] = [
  { id: "pending", label: "Pending Approval", icon: Clock },
  { id: "approved", label: "Approved", icon: CheckCircle2 },
  { id: "rejected", label: "Rejected", icon: XCircle },
];

export default function PaymentsManager() {
  const [status, setStatus] = useState<PaymentStatus>("pending");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const fetchOrders = useCallback(async (nextStatus: PaymentStatus) => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/admin/orders?status=${nextStatus}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load payments.");
      }
      setOrders(Array.isArray(data?.orders) ? data.orders : []);
    } catch (e: any) {
      setError(e?.message || "Failed to load payments.");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders(status);
  }, [status, fetchOrders]);

  const decide = useCallback(
    async (orderId: string, decision: "approve" | "reject") => {
      setActingOn(orderId);
      try {
        const token = localStorage.getItem("auth_token");
        const res = await fetch(`/api/admin/orders/${orderId}/${decision}`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || `Failed to ${decision} payment.`);
        }
        await fetchOrders(status);
        if (expandedOrderId === orderId) {
          setExpandedOrderId(null);
        }
      } catch (e: any) {
        alert(e?.message || `Failed to ${decision} payment.`);
      } finally {
        setActingOn(null);
      }
    },
    [fetchOrders, status, expandedOrderId]
  );

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    return formatDateGMT6(dateStr);
  };

  const pendingCount = useMemo(() => {
    if (status === "pending") return orders.length;
    return null;
  }, [orders.length, status]);

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h2 className={styles.panelTitle}>Payment Verification</h2>
          <p className={styles.subtitle}>
            Approve or reject bKash transactions submitted by students
          </p>
        </div>

        <div className={styles.filterTabs}>
          {STATUS_TABS.map((t) => {
            const Icon = t.icon;
            const active = status === t.id;
            return (
              <button
                key={t.id}
                className={`${styles.filterTab} ${active ? styles.activeTab : ""}`}
                onClick={() => {
                  setStatus(t.id);
                  setExpandedOrderId(null);
                }}
              >
                <Icon size={16} />
                <span>{t.label}</span>
                {t.id === "pending" && typeof pendingCount === "number" && pendingCount > 0 ? (
                  <span className={styles.tabBadge}>{pendingCount}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <div className={styles.infoBox}>{error}</div>
      ) : loading ? (
        <div className={styles.loader}>
          <Loader variant="inline" text="Loading payments..." />
        </div>
      ) : orders.length === 0 ? (
        <div className={styles.infoBox}>No payments found for this status.</div>
      ) : (
        <div className={styles.teacherGrid}>
          {orders.map((o) => {
            const isExpanded = expandedOrderId === o.id;

            return (
              <article
                key={o.id}
                className={`${styles.teacherCard} ${isExpanded ? styles.paymentCardExpanded : ""}`}
                style={{ cursor: "pointer" }}
                onClick={() => setExpandedOrderId(isExpanded ? null : o.id)}
              >
                <div className={styles.cardHeader}>
                  <div className={styles.cardInfo}>
                    <h3 style={{ marginBottom: 2 }}>{o.course?.title || "Course"}</h3>
                    <p style={{ marginBottom: 0 }}>{o.user?.fullName} · {o.user?.email}</p>
                  </div>
                  <button
                    type="button"
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "0.82rem",
                      fontWeight: 600,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedOrderId(isExpanded ? null : o.id);
                    }}
                  >
                    <span>{isExpanded ? "Collapse" : "Inspect"}</span>
                  </button>
                </div>

                <div className={styles.cardContent}>
                  <div className={styles.academicInfo}>
                    <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 10 }}>
                      <span className={`${styles.statusBadge} ${
                        o.status === "approved" ? styles.statusSuccess : 
                        o.status === "rejected" ? styles.statusDanger : 
                        styles.statusWarning
                      }`}>
                        {String(o.status)}
                      </span>
                      <strong style={{ fontSize: "1rem" }}>
                        ৳{Math.round(Number(o.payment?.amount ?? o.totalAmount))}
                      </strong>
                    </div>
                    <p style={{ marginBottom: 0, color: "var(--text-muted)", fontSize: "0.8rem" }}>
                      Updated {formatDateTime(o.updatedAt)}
                    </p>
                  </div>

                  {/* Inline Expanded Details (No Popup) */}
                  {isExpanded && (
                    <div className={styles.paymentAccordionDetails} onClick={(e) => e.stopPropagation()}>
                      <div className={styles.paymentDetailItem}>
                        <span>Student Name</span>
                        <strong>{o.user?.fullName || "—"}</strong>
                      </div>
                      <div className={styles.paymentDetailItem}>
                        <span>Student Email</span>
                        <strong>{o.user?.email || "—"}</strong>
                      </div>
                      <div className={styles.paymentDetailItem}>
                        <span>Course</span>
                        <strong>{o.course?.title || "—"}</strong>
                      </div>
                      <div className={styles.paymentDetailItem}>
                        <span>bKash Phone Number</span>
                        <strong>{o.payment?.phoneNumber || "—"}</strong>
                      </div>
                      <div className={styles.paymentDetailItem}>
                        <span>Transaction ID (TrxID)</span>
                        <strong style={{ color: "var(--primary)", fontFamily: "monospace", fontSize: "0.95rem" }}>
                          {o.payment?.transactionId || "—"}
                        </strong>
                      </div>
                      <div className={styles.paymentDetailItem}>
                        <span>Amount Submitted</span>
                        <strong>৳{Math.round(Number(o.payment?.amount ?? o.totalAmount))}</strong>
                      </div>
                      <div className={styles.paymentDetailItem}>
                        <span>Submitted At</span>
                        <strong>{formatDateTime(o.payment?.submittedAt)}</strong>
                      </div>
                      <div className={styles.paymentDetailItem}>
                        <span>Order Updated</span>
                        <strong>{formatDateTime(o.updatedAt)}</strong>
                      </div>

                      {status === "pending" && (
                        <div className={styles.paymentStickyActions}>
                          <button
                            className={`${styles.actionBtn} ${styles.actionBtnWide} ${styles.danger}`}
                            disabled={actingOn === o.id}
                            onClick={() => decide(o.id, "reject")}
                            title="Reject this payment"
                          >
                            <XCircle size={16} />
                            <span>{actingOn === o.id ? "Saving..." : "Reject Payment"}</span>
                          </button>
                          <button
                            className={`${styles.actionBtn} ${styles.actionBtnWide}`}
                            disabled={actingOn === o.id}
                            onClick={() => decide(o.id, "approve")}
                            title="Approve this payment and enroll student"
                          >
                            <CheckCircle2 size={16} />
                            <span>{actingOn === o.id ? "Saving..." : "Approve Payment"}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {!isExpanded && status === "pending" ? (
                    <div className={styles.cardFooter} style={{ marginTop: 12 }}>
                      <div className={styles.cardActions} onClick={(e) => e.stopPropagation()}>
                        <button
                          className={`${styles.actionBtn} ${styles.actionBtnWide}`}
                          disabled={actingOn === o.id}
                          onClick={() => decide(o.id, "approve")}
                          title="Approve"
                        >
                          <CheckCircle2 size={16} />
                          <span>Approve</span>
                        </button>
                        <button
                          className={`${styles.actionBtn} ${styles.actionBtnWide} ${styles.danger}`}
                          disabled={actingOn === o.id}
                          onClick={() => decide(o.id, "reject")}
                          title="Reject"
                        >
                          <XCircle size={16} />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
