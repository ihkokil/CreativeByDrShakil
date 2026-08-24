'use client'

import { useState } from 'react'
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
