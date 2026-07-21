"use client";

import { useDashboardData } from "@/hooks/useDashboardData";
import styles from "../Dashboard.module.css";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { formatDateTextGMT6, formatDateTimeGMT6 } from "@/lib/date-format";

export default function PurchasesPage() {
    const { data, fetching, error } = useDashboardData();

    if (fetching && !data) return <div className={styles.loaderInline}>Securing your workspace...</div>;
    if (error) return <section className={styles.alertCard}><AlertTriangle size={18} /><span>{error}</span></section>;
    if (!data) return null;

    return (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2>Payments</h2>
              <p className={styles.subtitle}>
                Track your payment approvals. Course access is enabled after admin approval.
              </p>
            </div>
          </div>

          {data.purchaseHistory.length === 0 ? (
            <p className={styles.emptyText}>No purchases yet.</p>
          ) : (
            <div className={styles.courseList}>
              {data.purchaseHistory.map((order: any) => {
                const orderStatus = String(order.status || "").toLowerCase();
                const paymentStatus = String(order.payment?.status || orderStatus || "").toLowerCase();
                const isApproved = orderStatus === "approved";
                const isRejected = orderStatus === "rejected";
                const isPending = !isApproved && !isRejected;

                return (
                  <article key={order.id} className={styles.courseListCard}>
                    <div className={styles.courseListTop}>
                      <div>
                        <h3>{order.course?.title || "Course"}</h3>
                        <p>Amount: ৳{Math.round(order.totalAmount)}</p>
                      </div>
                      <span className={styles.enrolledAt}>Requested {formatDateTextGMT6(order.createdAt)}</span>
                    </div>

                    <div className={styles.progressRow} style={{ alignItems: "center" }}>
                      <div>
                        <strong>Status:</strong>{" "}
                        <span style={{ fontWeight: 800, color: isApproved ? "var(--success)" : isRejected ? "var(--danger)" : "var(--primary)" }}>
                          {isApproved ? "APPROVED" : isRejected ? "REJECTED" : "PENDING"}
                        </span>
                        <div style={{ color: "var(--text-muted)", marginTop: 4 }}>
                          Payment: {paymentStatus ? paymentStatus.toUpperCase() : "—"}
                          {order.payment?.transactionId ? ` · TX: ${order.payment.transactionId}` : ""}
                        </div>
                        {order.payment?.submittedAt ? (
                          <div style={{ color: "var(--text-muted)", marginTop: 2 }}>
                            Submitted {formatDateTimeGMT6(order.payment.submittedAt)}
                          </div>
                        ) : null}
                        {order.payment?.approvedAt ? (
                          <div style={{ color: "var(--text-muted)", marginTop: 2 }}>
                            Approved {formatDateTimeGMT6(order.payment.approvedAt)}
                          </div>
                        ) : null}
                      </div>

                      <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
                        {isApproved && order.course?.slug ? (
                          <Link href={`/study/${order.course.slug}`} className={styles.resumeBtn}>
                            Enter Classroom
                          </Link>
                        ) : isPending ? (
                          <span className={styles.resumeBtnDisabled}>Awaiting approval</span>
                        ) : (
                          <span className={styles.resumeBtnDisabled}>Access denied</span>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
    );
}
