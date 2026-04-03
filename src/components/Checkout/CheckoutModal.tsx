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
  const [coupon, setCoupon] = useState<string | null>(null)
  const [discount, setDiscount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [order, setOrder] = useState<any>(null)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const amount = course.price - discount

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
    } catch (err) {
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
    } catch (err) {
      setError('Payment submission failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.modal}>
      <div className={styles.modalContent}>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>

        {step === 1 && (
          <>
            <h2>Checkout - {course.title}</h2>
            <p>Price: {course.price} TK</p>
            <CouponInput
              onApply={(code, disc) => {
                setCoupon(code)
                setDiscount(disc)
              }}
              onRemove={() => {
                setCoupon(null)
                setDiscount(0)
              }}
            />
            <p className={styles.total}>Total: {amount} TK</p>
            <button onClick={handleInitiateOrder} disabled={loading}>
              {loading ? '...' : 'Continue to Payment'}
            </button>
            {error && <p className={styles.error}>{error}</p>}
          </>
        )}

        {step === 2 && order && (
          <>
            <h2>Send Payment</h2>
            <BkashDisplay amount={amount} />
            <PaymentForm
              orderId={order.id}
              amount={amount}
              onSubmit={handlePaymentSubmit}
              loading={loading}
            />
            {error && <p className={styles.error}>{error}</p>}
          </>
        )}

        {step === 3 && (
          <>
            <h2>✓ Payment Submitted</h2>
            <p>Your payment has been submitted and is pending admin approval.</p>
            <p>You will receive an email once approved.</p>
            <button onClick={onClose}>Close</button>
          </>
        )}
      </div>
    </div>
  )
}
