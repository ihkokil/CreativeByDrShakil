"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Loader from "@/components/UI/Loader";
import { formatDateGMT6 } from "@/lib/date-format";
import styles from "./PaymentsManager.module.css";
import { CheckCircle2, Clock, XCircle, ChevronDown, ChevronUp } from "lucide-react";

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
    <div className={styles.container}>
      <div className={styles.topBar}>
        <div className={styles.filterTabs}>
          {STATUS_TABS.map((t) => {
            const Icon = t.icon;
            const active = status === t.id;
            return (
              <button
                key={t.id}
                type="button"
                className={`${styles.filterTab} ${active ? styles.activeTab : ""}`}
                onClick={() => {
                  setStatus(t.id);
                  setExpandedOrderId(null);
                }}
              >
                <Icon size={15} />
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
        <div className={styles.ordersGrid}>
          {orders.map((o) => {
            const isExpanded = expandedOrderId === o.id;

            return (
              <article
                key={o.id}
                className={`${styles.orderCard} ${isExpanded ? styles.orderCardExpanded : ""}`}
                onClick={() => setExpandedOrderId(isExpanded ? null : o.id)}
              >
                <div className={styles.cardHeader}>
                  <div className={styles.cardInfo}>
                    <h3 className={styles.courseTitle}>{o.course?.title || "Course"}</h3>
                    <p className={styles.studentMeta}>{o.user?.fullName} · {o.user?.email}</p>
                  </div>
                  <button
                    type="button"
                    className={styles.inspectBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedOrderId(isExpanded ? null : o.id);
                    }}
                  >
                    <span>{isExpanded ? "Collapse" : "Inspect"}</span>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>

                <div className={styles.badgeRow}>
                  <span className={`${styles.statusBadge} ${
                    o.status === "approved" ? styles.statusApproved : 
                    o.status === "rejected" ? styles.statusRejected : 
                    styles.statusPending
                  }`}>
                    {String(o.status)}
                  </span>
                  <span className={styles.amount}>
                    ৳{Math.round(Number(o.payment?.amount ?? o.totalAmount))}
                  </span>
                </div>

                <div className={styles.timeMeta}>
                  Updated {formatDateTime(o.updatedAt)}
                </div>

                {isExpanded && (
                  <div className={styles.expandedDetails} onClick={(e) => e.stopPropagation()}>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Student Name</span>
                      <span className={styles.detailValue}>{o.user?.fullName || "—"}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Student Email</span>
                      <span className={styles.detailValue}>{o.user?.email || "—"}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Course</span>
                      <span className={styles.detailValue}>{o.course?.title || "—"}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>bKash Number</span>
                      <span className={styles.detailValue}>{o.payment?.phoneNumber || "—"}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Transaction ID</span>
                      <span className={styles.detailValue} style={{ color: "var(--primary)" }}>
                        {o.payment?.transactionId || "—"}
                      </span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Submitted At</span>
                      <span className={styles.detailValue}>{formatDateTime(o.payment?.submittedAt)}</span>
                    </div>

                    {status === "pending" && (
                      <div className={styles.cardActions} style={{ marginTop: 8 }}>
                        <button
                          type="button"
                          className={styles.rejectBtn}
                          disabled={actingOn === o.id}
                          onClick={() => decide(o.id, "reject")}
                        >
                          <XCircle size={15} />
                          <span>{actingOn === o.id ? "Saving..." : "Reject"}</span>
                        </button>
                        <button
                          type="button"
                          className={styles.approveBtn}
                          disabled={actingOn === o.id}
                          onClick={() => decide(o.id, "approve")}
                        >
                          <CheckCircle2 size={15} />
                          <span>{actingOn === o.id ? "Saving..." : "Approve & Enroll"}</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {!isExpanded && status === "pending" ? (
                  <div className={styles.cardActions} onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className={styles.approveBtn}
                      disabled={actingOn === o.id}
                      onClick={() => decide(o.id, "approve")}
                    >
                      <CheckCircle2 size={15} />
                      <span>Approve</span>
                    </button>
                    <button
                      type="button"
                      className={styles.rejectBtn}
                      disabled={actingOn === o.id}
                      onClick={() => decide(o.id, "reject")}
                    >
                      <XCircle size={15} />
                      <span>Reject</span>
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
