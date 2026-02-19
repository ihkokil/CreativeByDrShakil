'use client'

import { useState } from 'react'
import styles from './Checkout.module.css'

interface CouponInputProps {
  onApply: (code: string, discount: number) => void
  onRemove: () => void
  appliedCoupon?: string
}

export function CouponInput({ onApply, onRemove, appliedCoupon }: CouponInputProps) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleApply = async () => {
    if (!code.trim()) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/coupons/validate?code=${code}`)
      const data = await res.json()

      if (res.ok) {
        onApply(code, data.discountAmount)
        setCode('')
      } else {
        setError(data.error || 'Invalid coupon')
      }
    } catch {
      setError('Failed to validate coupon')
    } finally {
      setLoading(false)
    }
  }

  if (appliedCoupon) {
    return (
      <div className={styles.couponApplied}>
        <p>Coupon Applied: <strong>{appliedCoupon}</strong></p>
        <button onClick={onRemove}>Remove</button>
      </div>
    )
  }

  return (
    <div className={styles.couponInput}>
      <input
        type="text"
        placeholder="Enter coupon code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
      />
      <button onClick={handleApply} disabled={loading}>
        {loading ? '...' : 'Apply'}
      </button>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  )
}
