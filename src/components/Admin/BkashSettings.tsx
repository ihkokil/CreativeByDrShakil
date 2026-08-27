'use client'

import { useEffect, useState } from 'react'
import Loader from "@/components/UI/Loader"
import { Wallet, Save, CheckCircle2 } from "lucide-react";
import styles from './BkashSettings.module.css'

interface BkashConfig {
  sendMoneyNumber: string
}

export default function BkashSettings() {
  const [config, setConfig] = useState<BkashConfig>({
    sendMoneyNumber: '01723084529',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/admin/payment-config', { cache: 'no-store' })
      const data = await res.json()
      if (data?.sendMoneyNumber) {
        setConfig({
          sendMoneyNumber: data.sendMoneyNumber,
        })
      }
    } catch (err) {
      console.error('Failed to fetch config', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!config.sendMoneyNumber.trim()) {
      setMessage({ type: 'error', text: 'bKash number is required' })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch('/api/admin/payment-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      const data = await res.json()

      if (res.ok) {
        setMessage({ type: 'success', text: 'bKash number updated successfully!' })
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save settings' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <Loader variant="inline" text="Loading settings..." />
  }

  return (
    <div className={styles.bkashSettings}>
      <div className={styles.bkashSettingsHeader}>
        <h3>bKash Payment Configuration</h3>
        <p>Configure the bKash Send Money number displayed during course checkout</p>
      </div>

      <div className={styles.bkashForm}>
        <div className={styles.formGroup}>
          <label htmlFor="bkash-number">bKash Send Money Number</label>
          <input
            id="bkash-number"
            type="tel"
            value={config.sendMoneyNumber}
            onChange={(e) => setConfig({ sendMoneyNumber: e.target.value })}
            placeholder="01XXXXXXXXX"
          />
        </div>

        <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>

        {message && (
          <div className={`${styles.formMessage} ${styles[message.type]}`}>
            {message.text}
          </div>
        )}
      </div>

      <div className={styles.bkashPreview}>
        <h4>Checkout Preview</h4>
        <div className={styles.previewCard}>
          <div>
            <p className={styles.previewLabel}>bKash Send Money Number</p>
            <p className={styles.previewValue}>{config.sendMoneyNumber || 'Not set'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}