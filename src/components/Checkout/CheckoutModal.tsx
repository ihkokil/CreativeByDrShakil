'use client'

import { useState } from 'react'
import { BkashDisplay } from './BkashDisplay'
import { CouponInput } from './CouponInput'
import { PaymentForm } from './PaymentForm'
import styles from './Checkout.module.css'

interface CheckoutModalProps {
  course: any
  isOpen: boolean
  onClose: () => void
}

export function CheckoutModal({ course, isOpen, onClose }: CheckoutModalProps) {
  const [step, setStep] = useState(1)
  const [showCoupon, setShowCoupon] = useState(false)
  const [coupon, setCoupon] = useState<string | null>(null)
  const [discount, setDiscount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [order, setOrder] = useState<any>(null)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const amount = course.price - discount

  const priceLabel = new Intl.NumberFormat('en-BD', {
    maximumFractionDigits: 0,
  }).format(course.price)

  const totalLabel = new Intl.NumberFormat('en-BD', {
    maximumFractionDigits: 0,
  }).format(amount)

  const handleInitiateOrder = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/orders/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: course.id,
          couponCode: coupon,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data?.order) {
        setError(data?.error || 'Could not start checkout. Please try again.')
        return
      }
      setOrder(data.order)
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
      const res = await fetch('/api/payments/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData),
      })
      const data = await res.json()
      if (res.ok) {
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
           <h2 className={styles.title}>{step === 1 ? 'Review & continue' : 'Send money'}</h2>
          <p className={styles.subtitle}>{course.title}</p>
        </div>

        {step === 1 && (
          <div className={styles.contentBlock}>
            <div className={styles.summaryCard}>
              <div className={styles.summaryRow}>
                <span>Course price</span>
                <strong>{priceLabel} TK</strong>
              </div>
              {discount > 0 && (
                <div className={styles.summaryRow}>
                  <span>Coupon discount</span>
                  <strong className={styles.discountText}>- {discount} TK</strong>
                </div>
              )}
              <div className={`${styles.summaryRow} ${styles.totalRow}`}>
                 <span>Total payable</span>
                <strong>{totalLabel} TK</strong>
              </div>
            </div>

            {!coupon ? (
              <button
                type="button"
                className={styles.couponToggle}
                onClick={() => setShowCoupon((prev) => !prev)}
              >
                {showCoupon ? 'Hide coupon code' : 'Do you have a coupon?'}
              </button>
            ) : (
              <div className={styles.appliedCouponBar}>
                <span>Coupon applied: <strong>{coupon}</strong></span>
                <button
                  type="button"
                  onClick={() => {
                    setCoupon(null)
                    setDiscount(0)
                    setShowCoupon(false)
                  }}
                >
                  Remove
                </button>
              </div>
            )}

            {showCoupon && !coupon && (
              <div className={styles.couponSection}>
                <CouponInput
                  onApply={(code, disc) => {
                    setCoupon(code)
                    setDiscount(disc)
                    setShowCoupon(false)
                  }}
                  onRemove={() => {
                    setCoupon(null)
                    setDiscount(0)
                  }}
                />
              </div>
            )}

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
              <p className={styles.successBadge}>Payment submitted</p>
              <h3>We’ve received your request</h3>
              <p>
                Your payment is now under review. You’ll get access after approval.
              </p>
            </div>

            <button onClick={onClose} className={styles.primaryBtn}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
