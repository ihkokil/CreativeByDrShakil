'use client'

import { useEffect, useState } from 'react'
import styles from './Checkout.module.css'

interface BkashDisplayProps {
  amount: number
}

export function BkashDisplay({ amount }: BkashDisplayProps) {
  const [bkashNumber, setBkashNumber] = useState('01700000000')
  const [qrCodeUrl, setQrCodeUrl] = useState('/uploads/bkash-qr/bkash-qr.png')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let mounted = true

    const loadConfig = async () => {
      try {
        const response = await fetch('/api/payment-config', { cache: 'no-store' })
        const data = await response.json()
        if (!mounted) return

        if (data?.sendMoneyNumber) setBkashNumber(data.sendMoneyNumber)
        if (data?.qrCodeUrl) setQrCodeUrl(data.qrCodeUrl)
      } catch {
        // Keep defaults on error.
      }
    }

    loadConfig()
    return () => {
      mounted = false
    }
  }, [])

  const copyToClipboard = () => {
    navigator.clipboard.writeText(bkashNumber)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={styles.bkashDisplay}>
      <h3>Send Money via bKash</h3>
      <div className={styles.bkashNumber}>
        <div className={styles.numberRow}>
          <div>
            <p>bKash send money number</p>
            <p className={styles.number}>{bkashNumber}</p>
          </div>
          <button onClick={copyToClipboard} className={styles.copyBtn}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <div className={styles.amountContainer}>
        <p>Pay exact or include charge:</p>
        <strong>{amount} TK</strong>
      </div>
      <div className={styles.qrCode}>
        <img src={qrCodeUrl} alt="bKash QR code" />
        <p>Scan QR code for send money</p>
      </div>
    </div>
  )
}
