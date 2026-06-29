'use client'

import { useState } from 'react'
import Link from 'next/link'
import styles from './Checkout.module.css'

interface PaymentFormProps {
  orderId: string
  amount: number
  onSubmit: (data: any) => void
  loading?: boolean
}

export function PaymentForm({ orderId, amount, onSubmit, loading }: PaymentFormProps) {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [sentAmount, setSentAmount] = useState(String(amount))
  const [transactionId, setTransactionId] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!phoneNumber || !transactionId || !sentAmount) return

    onSubmit({
      orderId,
      phoneNumber,
      transactionId,
      amount,
      sentAmount: Number(sentAmount),
    })
  }

  return (
    <form onSubmit={handleSubmit} className={styles.paymentForm}>
      <div className={styles.formGrid}>
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
            placeholder="bKash transaction ID"
            value={transactionId}
            onChange={(e) => setTransactionId(e.target.value)}
            required
          />
        </div>
      </div>

      <div>
        <label>Sent Amount</label>
        <input
          type="number"
          inputMode="numeric"
          min="0"
          step="1"
          placeholder="Amount sent including charge"
          value={sentAmount}
          onChange={(e) => setSentAmount(e.target.value)}
          required
        />
        <p className={styles.fieldHint}>Example: if the payable amount is 6000, you can enter 6045 if that is what you sent.</p>
      </div>

      <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '16px', textAlign: 'center' }}>
        By submitting this payment, you agree to our <Link href="/terms" target="_blank" style={{ textDecoration: 'underline' }}>Terms</Link> and <Link href="/refund" target="_blank" style={{ textDecoration: 'underline' }}>Refund Policy</Link>.
      </div>

      <button type="submit" disabled={loading}>
        {loading ? 'Submitting...' : 'Submit Payment'}
      </button>
    </form>
  )
}
