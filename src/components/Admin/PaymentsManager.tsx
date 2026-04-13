"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "@/app/admin/dashboard/AdminDashboard.module.css";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

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

const STATUS_TABS: { id: PaymentStatus; label: string }[] = [
  { id: "pending", label: "Pending Approval" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
];

export default function PaymentsManager() {
  const [status, setStatus] = useState<PaymentStatus>("pending");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<OrderRow | null>(null);

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
        const res = await fetch(`/api/admin/orders/${orderId}/decision`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ decision }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || "Failed to update payment decision.");
        }
        await fetchOrders(status);
        setSelected(null);
      } catch (e: any) {
        alert(e?.message || "Failed to update payment decision.");
      } finally {
        setActingOn(null);
      }
    },
    [fetchOrders, status]
  );

  const formatDateTime = useCallback((dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  }, []);

  const totals = useMemo(() => {
    const count = orders.length;
    const amount = orders.reduce((sum, o) => sum + (Number(o.payment?.amount ?? 0) || 0), 0);
    return { count, amount };
  }, [orders]);

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h2 className={styles.panelTitle}>Payments</h2>
          <p className={styles.subtitle}>
            Review manual payments and approve or reject them.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        {STATUS_TABS.map((t) => (
          <button
            key={t.id}
            className={styles.secondaryBtn}
            onClick={() => setStatus(t.id)}
            style={{
              borderColor: status === t.id ? "var(--primary)" : undefined,
              color: status === t.id ? "var(--primary)" : undefined,
            }}
          >
            {t.label}
          </button>
        ))}
        <div style={{ marginLeft: "auto", color: "var(--text-muted)", fontWeight: 600 }}>
          {loading ? "Loading..." : `${totals.count} items · ৳${Math.round(totals.amount)}`}
        </div>
      </div>

      {error ? (
        <div className={styles.infoBox}>{error}</div>
      ) : loading ? (
        <div className={styles.loader}>
          <Loader2 className={styles.spinner} /> Loading payments...
        </div>
      ) : orders.length === 0 ? (
        <div className={styles.infoBox}>No payments found for this status.</div>
      ) : (
        <div className={styles.teacherGrid}>
          {orders.map((o) => (
            <article
              key={o.id}
              className={styles.teacherCard}
              style={{ cursor: "pointer" }}
              onClick={() => setSelected(o)}
            >
              <div className={styles.cardHeader}>
                <div className={styles.cardInfo}>
                  <h3 style={{ marginBottom: 2 }}>{o.course?.title || "Course"}</h3>
                  <p style={{ marginBottom: 0 }}>{o.user?.fullName} · {o.user?.email}</p>
                </div>
              </div>

              <div className={styles.cardContent}>
                <div className={styles.academicInfo}>
                  <p style={{ marginBottom: 8 }}>
                    <strong>Status:</strong> {String(o.status).toUpperCase()}
                  </p>
                  <p style={{ marginBottom: 8 }}>
                    <strong>Amount:</strong> ৳{Math.round(Number(o.payment?.amount ?? o.totalAmount))}
                  </p>
                  <p style={{ marginBottom: 0, color: "var(--text-muted)" }}>
                    Updated {formatDateTime(o.updatedAt)}
                  </p>
                </div>

                {status === "pending" ? (
                  <div className={styles.cardFooter}>
                    <div className={styles.cardActions} onClick={(e) => e.stopPropagation()}>
                      <button
                        className={styles.actionBtn}
                        disabled={actingOn === o.id}
                        onClick={() => decide(o.id, "approve")}
                        title="Approve"
                      >
                        <CheckCircle2 size={16} />
                      </button>
                      <button
                        className={`${styles.actionBtn} ${styles.danger}`}
                        disabled={actingOn === o.id}
                        onClick={() => decide(o.id, "reject")}
                        title="Reject"
                      >
                        <XCircle size={16} />
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}

      {selected ? (
        <div className={styles.confirmBackdrop} role="dialog" aria-modal="true">
          <div className={styles.confirmDialog} style={{ maxWidth: 640 }}>
            <h3>Payment Details</h3>
            <p style={{ marginBottom: 14 }}>
              Review the details before taking action.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <strong>Student</strong>
                <div>{selected.user?.fullName}</div>
                <div style={{ color: "var(--text-muted)" }}>{selected.user?.email}</div>
              </div>
              <div>
                <strong>Course</strong>
                <div>{selected.course?.title}</div>
                <div style={{ color: "var(--text-muted)" }}>{selected.course?.slug || "—"}</div>
              </div>
              <div>
                <strong>Order Status</strong>
                <div>{String(selected.status).toUpperCase()}</div>
              </div>
              <div>
                <strong>Amount</strong>
                <div>৳{Math.round(Number(selected.payment?.amount ?? selected.totalAmount))}</div>
              </div>
              <div>
                <strong>Phone</strong>
                <div>{selected.payment?.phoneNumber || "—"}</div>
              </div>
              <div>
                <strong>Transaction ID</strong>
                <div>{selected.payment?.transactionId || "—"}</div>
              </div>
              <div>
                <strong>Submitted</strong>
                <div>{selected.payment?.submittedAt ? formatDateTime(selected.payment.submittedAt) : "—"}</div>
              </div>
              <div>
                <strong>Last Updated</strong>
                <div>{formatDateTime(selected.updatedAt)}</div>
              </div>
            </div>

            <div className={styles.confirmActions}>
              <button
                className={styles.confirmCancelBtn}
                onClick={() => setSelected(null)}
                disabled={!!actingOn}
              >
                Close
              </button>
              {String(selected.status).toLowerCase() === "pending" ? (
                <>
                  <button
                    className={styles.confirmCancelBtn}
                    onClick={() => decide(selected.id, "reject")}
                    disabled={actingOn === selected.id}
                  >
                    Reject
                  </button>
                  <button
                    className={styles.confirmPrimaryBtn}
                    onClick={() => decide(selected.id, "approve")}
                    disabled={actingOn === selected.id}
                  >
                    {actingOn === selected.id ? "Saving..." : "Approve"}
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

