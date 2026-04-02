'use client'

import { useState } from 'react'
import styles from './Checkout.module.css'

interface BkashDisplayProps {
  amount: number
}

export function BkashDisplay({ amount }: BkashDisplayProps) {
  const bkashNumber = '01700000000'
  const [copied, setCopied] = useState(false)

  const copyToClipboard = () => {
    navigator.clipboard.writeText(bkashNumber)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={styles.bkashDisplay}>
      <h3>Send Payment via bKash</h3>
      <div className={styles.bkashNumber}>
        <p>bKash Number:</p>
        <p className={styles.number}>{bkashNumber}</p>
        <button onClick={copyToClipboard} className={styles.copyBtn}>
          {copied ? '✓ Copied' : 'Copy Number'}
        </button>
      </div>
      <div className={styles.amountContainer}>
        <p>Amount to Send: <strong>{amount} TK</strong></p>
      </div>
      <div className={styles.qrCode}>
        <img src="/bkash-qr.png" alt="bKash QR Code" />
        <p>Scan QR code to send payment</p>
      </div>
    </div>
  )
}
