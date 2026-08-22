"use client";

import { useState, useMemo } from "react";
import { useDashboardData } from "@/hooks/useDashboardData";
import styles from "./Purchases.module.css";
import {
  CreditCard,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Calendar,
  Play,
  Loader2,
  AlertTriangle,
  Sparkles,
  Wallet,
  BookOpen,
  ArrowUpRight
} from "lucide-react";
import Link from "next/link";
import { formatDateTextGMT6, formatDateTimeGMT6 } from "@/lib/date-format";

type StatusFilter = "all" | "pending" | "approved" | "rejected";

export default function PurchasesPage() {
  const { data, fetching, error } = useDashboardData();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [copiedTxId, setCopiedTxId] = useState<string | null>(null);

  const purchaseHistory = useMemo(() => {
    return Array.isArray(data?.purchaseHistory) ? data.purchaseHistory : [];
  }, [data?.purchaseHistory]);

  // Statistics calculation
  const stats = useMemo(() => {
    let totalSpent = 0;
    let pendingCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;

    purchaseHistory.forEach((order: any) => {
      const orderStatus = String(order.status || "").toLowerCase();
      totalSpent += Number(order.totalAmount || 0);

      if (orderStatus === "approved") {
        approvedCount++;
      } else if (orderStatus === "rejected") {
        rejectedCount++;
      } else {
        pendingCount++;
      }
    });

    return {
      totalSpent,
      totalCount: purchaseHistory.length,
      pendingCount,
      approvedCount,
      rejectedCount,
    };
  }, [purchaseHistory]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return purchaseHistory.filter((order: any) => {
      const orderStatus = String(order.status || "").toLowerCase();
      const isApproved = orderStatus === "approved";
      const isRejected = orderStatus === "rejected";
      const isPending = !isApproved && !isRejected;

      // Status tab filter
      if (statusFilter === "pending" && !isPending) return false;
      if (statusFilter === "approved" && !isApproved) return false;
      if (statusFilter === "rejected" && !isRejected) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const courseTitle = String(order.course?.title || "").toLowerCase();
        const txId = String(order.payment?.transactionId || "").toLowerCase();
        const phone = String(order.payment?.phoneNumber || "").toLowerCase();
        const orderId = String(order.id || "").toLowerCase();

        return (
          courseTitle.includes(q) ||
          txId.includes(q) ||
          phone.includes(q) ||
          orderId.includes(q)
        );
      }

      return true;
    });
  }, [purchaseHistory, statusFilter, searchQuery]);

  const handleCopy = (txId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(txId);
    setCopiedTxId(txId);
    setTimeout(() => setCopiedTxId(null), 2000);
  };

  if (fetching && !data) {
    return (
      <div className={styles.loaderWrap}>
        <Loader2 size={32} className="spinner" style={{ color: "var(--primary)" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.alertBox}>
        <AlertTriangle size={20} />
        <span>{error}</span>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className={styles.container}>
      {/* Header Banner */}
      <header className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>
            <CreditCard size={24} />
          </div>
          <div>
            <h1 className={styles.headerTitle}>Orders & Payments</h1>
            <p className={styles.headerSubtitle}>
              Track your course enrollments, verification requests, and transaction receipts.
            </p>
          </div>
        </div>
      </header>

      {/* Overview Stats Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div
            className={styles.statIconWrap}
            style={{
              background: "rgba(59, 130, 246, 0.12)",
              color: "#3b82f6",
            }}
          >
            <Wallet size={22} />
          </div>
          <div>
            <div className={styles.statValue}>৳{stats.totalSpent.toLocaleString()}</div>
            <p className={styles.statLabel}>Total Spent</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div
            className={styles.statIconWrap}
            style={{
              background: "rgba(16, 185, 129, 0.12)",
              color: "#10b981",
            }}
          >
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div className={styles.statValue}>{stats.approvedCount}</div>
            <p className={styles.statLabel}>Active Courses</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div
            className={styles.statIconWrap}
            style={{
              background: "rgba(245, 158, 11, 0.12)",
              color: "#f59e0b",
            }}
          >
            <Clock size={22} />
          </div>
          <div>
            <div className={styles.statValue}>{stats.pendingCount}</div>
            <p className={styles.statLabel}>Pending Verification</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div
            className={styles.statIconWrap}
            style={{
              background: "rgba(168, 85, 247, 0.12)",
              color: "#a855f7",
            }}
          >
            <BookOpen size={22} />
          </div>
          <div>
            <div className={styles.statValue}>{stats.totalCount}</div>
            <p className={styles.statLabel}>Total Orders</p>
          </div>
        </div>
      </div>

      {/* Controls: Search & Filter Tabs */}
      <div className={styles.controlsBar}>
        <div className={styles.searchWrap}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search by course title or TrxID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className={styles.filterTabs}>
          <button
            type="button"
            className={`${styles.filterTab} ${statusFilter === "all" ? styles.activeTab : ""}`}
            onClick={() => setStatusFilter("all")}
          >
            <span>All Orders</span>
            <span className={styles.tabBadge}>{stats.totalCount}</span>
          </button>

          <button
            type="button"
            className={`${styles.filterTab} ${statusFilter === "pending" ? styles.activeTab : ""}`}
            onClick={() => setStatusFilter("pending")}
          >
            <Clock size={14} />
            <span>Pending</span>
            {stats.pendingCount > 0 && (
              <span className={styles.tabBadge}>{stats.pendingCount}</span>
            )}
          </button>

          <button
            type="button"
            className={`${styles.filterTab} ${statusFilter === "approved" ? styles.activeTab : ""}`}
            onClick={() => setStatusFilter("approved")}
          >
            <CheckCircle2 size={14} />
            <span>Approved</span>
            {stats.approvedCount > 0 && (
              <span className={styles.tabBadge}>{stats.approvedCount}</span>
            )}
          </button>

          <button
            type="button"
            className={`${styles.filterTab} ${statusFilter === "rejected" ? styles.activeTab : ""}`}
            onClick={() => setStatusFilter("rejected")}
          >
            <XCircle size={14} />
            <span>Rejected</span>
            {stats.rejectedCount > 0 && (
              <span className={styles.tabBadge}>{stats.rejectedCount}</span>
            )}
          </button>
        </div>
      </div>

      {/* Orders List / Grid */}
      {purchaseHistory.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <Sparkles size={28} />
          </div>
          <h3 className={styles.emptyTitle}>No purchases yet</h3>
          <p className={styles.emptyDesc}>
            When you enroll in a course or workshop, your payment approvals and receipts will appear here.
          </p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <Search size={28} />
          </div>
          <h3 className={styles.emptyTitle}>No matching orders found</h3>
          <p className={styles.emptyDesc}>
            No payment records match your selected filter or search term. Try resetting your search.
          </p>
        </div>
      ) : (
        <div className={styles.ordersGrid}>
          {filteredOrders.map((order: any) => {
            const isExpanded = expandedOrderId === order.id;
            const orderStatus = String(order.status || "").toLowerCase();
            const paymentStatus = String(order.payment?.status || orderStatus || "").toLowerCase();
            const isApproved = orderStatus === "approved";
            const isRejected = orderStatus === "rejected";
            const isPending = !isApproved && !isRejected;

            return (
              <article
                key={order.id}
                className={`${styles.orderCard} ${isExpanded ? styles.orderCardExpanded : ""}`}
                onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
              >
                {/* Card Header */}
                <div className={styles.cardHeader}>
                  <div className={styles.cardInfo}>
                    <h3 className={styles.courseTitle} title={order.course?.title || "Course"}>
                      {order.course?.title || "Course"}
                    </h3>
                    <p className={styles.dateMeta}>
                      <Calendar size={13} />
                      Requested {formatDateTextGMT6(order.createdAt)}
                    </p>
                  </div>

                  <button
                    type="button"
                    className={styles.inspectBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedOrderId(isExpanded ? null : order.id);
                    }}
                  >
                    <span>{isExpanded ? "Less" : "Details"}</span>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>

                {/* Badge & Amount Row */}
                <div className={styles.badgeRow}>
                  <span
                    className={`${styles.statusBadge} ${
                      isApproved
                        ? styles.statusApproved
                        : isRejected
                        ? styles.statusRejected
                        : styles.statusPending
                    }`}
                  >
                    {isApproved ? (
                      <CheckCircle2 size={13} />
                    ) : isRejected ? (
                      <XCircle size={13} />
                    ) : (
                      <Clock size={13} />
                    )}
                    {isApproved ? "Approved" : isRejected ? "Rejected" : "Pending Approval"}
                  </span>

                  <span className={styles.amount}>
                    ৳{Math.round(order.totalAmount).toLocaleString()}
                  </span>
                </div>

                {/* Quick Info Preview */}
                <div className={styles.quickInfoRow}>
                  <span>Method: <strong style={{ textTransform: "capitalize", color: "var(--foreground)" }}>{paymentStatus || "Online"}</strong></span>
                  {order.payment?.transactionId && (
                    <span className={styles.txMeta}>
                      TX: {order.payment.transactionId.slice(0, 10)}...
                    </span>
                  )}
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div
                    className={styles.expandedDetails}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Course Name</span>
                      <span className={styles.detailValue}>{order.course?.title || "—"}</span>
                    </div>

                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Order ID</span>
                      <span className={styles.detailValue} style={{ fontSize: "0.78rem", fontFamily: "monospace" }}>
                        {order.id}
                      </span>
                    </div>

                    {order.payment?.phoneNumber && (
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Sender Phone</span>
                        <span className={styles.detailValue}>{order.payment.phoneNumber}</span>
                      </div>
                    )}

                    {order.payment?.transactionId && (
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Transaction ID</span>
                        <span className={styles.detailValue} style={{ color: "var(--primary)", fontFamily: "monospace" }}>
                          {order.payment.transactionId}
                          <button
                            type="button"
                            className={styles.copyBtn}
                            title="Copy Transaction ID"
                            onClick={(e) => handleCopy(order.payment.transactionId, e)}
                          >
                            {copiedTxId === order.payment.transactionId ? (
                              <Check size={13} style={{ color: "#10b981" }} />
                            ) : (
                              <Copy size={13} />
                            )}
                          </button>
                        </span>
                      </div>
                    )}

                    {order.payment?.submittedAt && (
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Submitted At</span>
                        <span className={styles.detailValue}>
                          {formatDateTimeGMT6(order.payment.submittedAt)}
                        </span>
                      </div>
                    )}

                    {order.payment?.approvedAt && (
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Approved At</span>
                        <span className={styles.detailValue} style={{ color: "#10b981" }}>
                          {formatDateTimeGMT6(order.payment.approvedAt)}
                        </span>
                      </div>
                    )}

                    {/* Action in expanded view */}
                    <div className={styles.cardActions}>
                      {isApproved && order.course?.slug ? (
                        <Link
                          href={`/study/${order.course.slug}`}
                          className={styles.classroomBtn}
                        >
                          <Play size={15} /> Enter Classroom
                        </Link>
                      ) : isPending ? (
                        <div className={styles.disabledActionBtn}>
                          <Loader2 size={14} className="spinner" /> Awaiting Admin Approval
                        </div>
                      ) : (
                        <div className={styles.disabledActionBtn}>
                          <AlertTriangle size={14} /> Access Rejected
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Collapsed view Action Button */}
                {!isExpanded && isApproved && order.course?.slug && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <Link
                      href={`/study/${order.course.slug}`}
                      className={styles.classroomBtn}
                      style={{ padding: "8px 14px", fontSize: "0.82rem" }}
                    >
                      <Play size={14} /> Enter Classroom
                    </Link>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
