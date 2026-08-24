'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Clock, Copy, Check, ShieldCheck, ArrowRight } from 'lucide-react'
import { BkashDisplay } from './BkashDisplay'
import { PaymentForm } from './PaymentForm'
import styles from './Checkout.module.css'

interface CheckoutModalProps {
  course: any
  isOpen: boolean
  onClose: () => void
}

export function CheckoutModal({ course, isOpen, onClose }: CheckoutModalProps) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [order, setOrder] = useState<any>(null)
  const [error, setError] = useState('')
  const [submittedPayment, setSubmittedPayment] = useState<{
    orderId: string
    phoneNumber: string
    transactionId: string
    amount: number
    sentAmount: number
    submittedAt: string
  } | null>(null)
  const [copiedOrderId, setCopiedOrderId] = useState(false)
  const router = useRouter()

  if (!isOpen) return null

  const amount = course.price

  const priceLabel = new Intl.NumberFormat('en-BD', {
    maximumFractionDigits: 0,
  }).format(course.price)

  const totalLabel = priceLabel

  const handleInitiateOrder = async () => {
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('auth_token')
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch('/api/orders/initiate', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          courseId: course.id,
        }),
      })
      const data = await res.json()
      const orderData = data?.order || (data?.orderId ? { id: data.orderId, totalAmount: data.totalAmount } : null)
      if (!res.ok || !orderData) {
        setError(data?.error || 'Could not start checkout. Please try again.')
        return
      }
      setOrder(orderData)
      setStep(2)
    } catch {
      setError('Could not start checkout. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handlePaymentSubmit = async (paymentData: any) => {
    setLoading(true)
    setError('')
    try {
      const token = localStorage.getItem('auth_token')
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch('/api/payments/submit', {
        method: 'POST',
        headers,
        body: JSON.stringify(paymentData),
      })
      const data = await res.json()
      if (res.ok) {
        setSubmittedPayment({
          orderId: paymentData.orderId,
          phoneNumber: paymentData.phoneNumber,
          transactionId: paymentData.transactionId,
          amount: paymentData.amount,
          sentAmount: paymentData.sentAmount,
          submittedAt: new Date().toISOString(),
        })
        setStep(3)
      } else {
        setError(data?.error || 'Payment submission failed. Please try again.')
      }
    } catch {
      setError('Payment submission failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.modal}>
      <div className={styles.modalContent}>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close checkout">
          ✕
        </button>

        <div className={styles.header}>
          <p className={styles.kicker}>Secure checkout</p>
          <h2 className={styles.title}>
            {step === 1 ? 'Review & continue' : step === 2 ? 'Send money' : 'Order Confirmation'}
          </h2>
          <p className={styles.subtitle}>{course.title}</p>
        </div>

        {step === 1 && (
          <div className={styles.contentBlock}>
            <div className={styles.summaryCard}>
              <div className={styles.summaryRow}>
                <span>Course price</span>
                <strong>{priceLabel} TK</strong>
              </div>
              <div className={`${styles.summaryRow} ${styles.totalRow}`}>
                <span>Total payable</span>
                <strong>{totalLabel} TK</strong>
              </div>
            </div>

            <button
              onClick={handleInitiateOrder}
              disabled={loading}
              className={styles.primaryBtn}
            >
              {loading ? 'Please wait...' : 'Continue to send money'}
            </button>

            {error && <p className={styles.error}>{error}</p>}
          </div>
        )}

        {step === 2 && order && (
          <div className={styles.contentBlock}>
            <div className={styles.summaryCard}>
              <div className={styles.summaryRow}>
                <span>Send money via bKash</span>
                <strong>{totalLabel} TK</strong>
              </div>
              <p className={styles.helpText}>
                You may send exact amount or include charge. Then submit your transaction details.
              </p>
            </div>

            <BkashDisplay amount={amount} />

            <PaymentForm
              orderId={order.id}
              amount={amount}
              onSubmit={handlePaymentSubmit}
              loading={loading}
            />

            {error && <p className={styles.error}>{error}</p>}
          </div>
        )}

        {step === 3 && (
          <div className={styles.contentBlock}>
            <div className={styles.successCard}>
              <div className={styles.successHeader}>
                <div className={styles.successIconWrapper}>
                  <CheckCircle2 size={30} className={styles.successIcon} />
                </div>
                <div>
                  <span className={styles.successBadge}>
                    <Clock size={13} style={{ marginRight: '5px' }} /> Awaiting Verification
                  </span>
                  <h3 className={styles.successTitle}>Payment Submitted Successfully!</h3>
                  <p className={styles.successSubtitle}>
                    Your transaction details have been received and sent to our team for verification.
                  </p>
                </div>
              </div>

              <div className={styles.receiptContainer}>
                <div className={styles.receiptHeader}>
                  <span>Transaction Summary</span>
                  <span className={styles.receiptDate}>
                    {new Date(submittedPayment?.submittedAt || Date.now()).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <div className={styles.receiptGrid}>
                  <div className={styles.receiptItem}>
                    <span className={styles.receiptLabel}>Course</span>
                    <span className={styles.receiptValue}>{course.title}</span>
                  </div>

                  <div className={styles.receiptItem}>
                    <span className={styles.receiptLabel}>Order ID</span>
                    <div className={styles.orderIdRow}>
                      <code className={styles.receiptCode}>{order?.id || submittedPayment?.orderId}</code>
                      <button
                        type="button"
                        className={styles.miniCopyBtn}
                        onClick={() => {
                          navigator.clipboard.writeText(order?.id || submittedPayment?.orderId || '')
                          setCopiedOrderId(true)
                          setTimeout(() => setCopiedOrderId(false), 2000)
                        }}
                        title="Copy Order ID"
                      >
                        {copiedOrderId ? <Check size={12} /> : <Copy size={12} />}
                        <span>{copiedOrderId ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  <div className={styles.receiptItem}>
                    <span className={styles.receiptLabel}>Transaction ID</span>
                    <code className={styles.receiptHighlightCode}>{submittedPayment?.transactionId || 'N/A'}</code>
                  </div>

                  <div className={styles.receiptItem}>
                    <span className={styles.receiptLabel}>Sender Phone</span>
                    <span className={styles.receiptValue}>{submittedPayment?.phoneNumber || 'N/A'}</span>
                  </div>

                  <div className={styles.receiptItem}>
                    <span className={styles.receiptLabel}>Payable Price</span>
                    <span className={styles.receiptValue}>{priceLabel} TK</span>
                  </div>

                  <div className={styles.receiptItem}>
                    <span className={styles.receiptLabel}>Sent Amount</span>
                    <strong className={styles.receiptAmount}>
                      {new Intl.NumberFormat('en-BD', { maximumFractionDigits: 0 }).format(
                        submittedPayment?.sentAmount || submittedPayment?.amount || amount
                      )}{' '}
                      TK
                    </strong>
                  </div>
                </div>
              </div>

              <div className={styles.infoNotice}>
                <ShieldCheck size={20} className={styles.infoNoticeIcon} />
                <div>
                  <strong>What to expect next:</strong>
                  <ul>
                    <li>Our team verifies your bKash transaction using the ID provided above.</li>
                    <li>Verification typically takes 15–30 minutes (up to a few hours during peak times).</li>
                    <li>Once approved, you’ll receive an email and this course will be instantly available in your dashboard.</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className={styles.successActions}>
              <button
                onClick={() => {
                  onClose()
                  router.push('/dashboard/courses')
                }}
                className={styles.primaryBtn}
              >
                <span>Go to My Dashboard</span>
                <ArrowRight size={18} style={{ marginLeft: '8px', verticalAlign: 'middle' }} />
              </button>
              <button onClick={onClose} className={styles.secondaryBtn}>
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
