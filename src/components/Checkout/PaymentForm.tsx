'use client'

import { useState } from 'react'
import styles from './Checkout.module.css'

interface PaymentFormProps {
  orderId: string
  amount: number
  onSubmit: (data: any) => void
  loading?: boolean
}

export function PaymentForm({ orderId, amount, onSubmit, loading }: PaymentFormProps) {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [transactionId, setTransactionId] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!phoneNumber || !transactionId) return

    onSubmit({
      orderId,
      phoneNumber,
      transactionId,
      amount,
    })
  }

  return (
    <form onSubmit={handleSubmit} className={styles.paymentForm}>
      <div>
        <label>Your Phone Number</label>
        <input
          type="tel"
          placeholder="+880..."
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          required
        />
      </div>
      <div>
        <label>Transaction ID</label>
        <input
          type="text"
          placeholder="Transaction ID from bKash"
          value={transactionId}
          onChange={(e) => setTransactionId(e.target.value)}
          required
        />
      </div>
      <button type="submit" disabled={loading}>
        {loading ? 'Submitting...' : 'Submit Payment'}
      </button>
    </form>
  )
}
