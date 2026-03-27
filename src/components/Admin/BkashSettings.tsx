'use client'

import { useEffect, useState, useRef } from 'react'
import styles from './BkashSettings.module.css'

interface BkashConfig {
  sendMoneyNumber: string
  qrCodeUrl: string
}

export default function BkashSettings() {
  const [config, setConfig] = useState<BkashConfig>({
    sendMoneyNumber: '',
    qrCodeUrl: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
          qrCodeUrl: data.qrCodeUrl || '',
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
        setMessage({ type: 'success', text: 'Settings saved successfully' })
        if (data.config?.qrCodeUrl) {
          setConfig((prev) => ({ ...prev, qrCodeUrl: data.config.qrCodeUrl }))
        }
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save' })
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save settings' })
    } finally {
      setSaving(false)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('file', file)

    setSaving(true)
    try {
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (res.ok && data.url) {
        setConfig((prev) => ({ ...prev, qrCodeUrl: data.url }))
        setMessage({ type: 'success', text: 'QR code uploaded' })
      } else {
        setMessage({ type: 'error', text: data.error || 'Upload failed' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to upload image' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className={styles.loader}>Loading settings...</div>
  }

  return (
    <div className={styles.bkashSettings}>
      <div className={styles.bkashSettingsHeader}>
        <h3>bKash Payment Configuration</h3>
        <p>Configure the bKash number and QR code displayed during checkout</p>
      </div>

      <div className={styles.bkashForm}>
        <div className={styles.formGroup}>
          <label htmlFor="bkash-number">bKash Send Money Number</label>
          <input
            id="bkash-number"
            type="tel"
            value={config.sendMoneyNumber}
            onChange={(e) => setConfig((prev) => ({ ...prev, sendMoneyNumber: e.target.value }))}
            placeholder="01XXXXXXXXX"
          />
        </div>

        <div className={styles.formGroup}>
          <label>bKash QR Code</label>
          <div className={styles.qrUpload}>
            {config.qrCodeUrl ? (
              <div className={styles.qrPreview}>
                <img src={config.qrCodeUrl} alt="bKash QR Code" />
                <button
                  type="button"
                  className={styles.removeQr}
                  onClick={() => setConfig((prev) => ({ ...prev, qrCodeUrl: '' }))}
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className={styles.qrPlaceholder}>
                <span>No QR code uploaded</span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className={styles.fileInput}
            />
            <button
              type="button"
              className={styles.uploadBtn}
              onClick={() => fileInputRef.current?.click()}
              disabled={saving}
            >
              {saving ? 'Uploading...' : 'Upload QR Code'}
            </button>
          </div>
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
            <p className={styles.previewLabel}>bKash Number</p>
            <p className={styles.previewValue}>{config.sendMoneyNumber || 'Not set'}</p>
          </div>
          {config.qrCodeUrl && (
            <div>
              <p className={styles.previewLabel}>QR Code</p>
              <div className={styles.previewQr}>
                <img src={config.qrCodeUrl} alt="Preview" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}