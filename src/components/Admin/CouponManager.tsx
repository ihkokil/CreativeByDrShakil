'use client'

import { useEffect, useMemo, useState } from 'react'
import styles from './CouponManager.module.css'

type Coupon = {
  id: string
  code: string
  discountAmount: number
  maxUses: number
  usedCount: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

type CouponForm = {
  code: string
  discountAmount: string
  maxUses: string
  usedCount: string
  isActive: string
}

const DEFAULT_FORM: CouponForm = {
  code: '',
  discountAmount: '0',
  maxUses: '-1',
  usedCount: '0',
  isActive: 'true',
}

export default function CouponManager() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CouponForm>(DEFAULT_FORM)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const token = useMemo(() => localStorage.getItem('auth_token'), [])

  const authHeaders: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}
  const jsonHeaders: HeadersInit = token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' }

  const fetchCoupons = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/coupons', {
        headers: authHeaders,
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to fetch coupons')
      }

      setCoupons(Array.isArray(data?.coupons) ? data.coupons : [])
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch coupons')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCoupons()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const resetForm = () => {
    setForm(DEFAULT_FORM)
    setEditingId(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)

    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        discountAmount: Number(form.discountAmount),
        maxUses: Number(form.maxUses),
        usedCount: Number(form.usedCount),
        isActive: form.isActive === 'true',
      }

      if (!payload.code) throw new Error('Coupon code is required')
      if (Number.isNaN(payload.discountAmount) || payload.discountAmount < 0) {
        throw new Error('Discount amount must be 0 or greater')
      }
      if (Number.isNaN(payload.maxUses) || payload.maxUses < -1) {
        throw new Error('Max uses must be -1 or greater')
      }
      if (Number.isNaN(payload.usedCount) || payload.usedCount < 0) {
        throw new Error('Used count must be 0 or greater')
      }

      const isEditing = Boolean(editingId)
      const endpoint = isEditing ? `/api/admin/coupons/${editingId}` : '/api/admin/coupons'
      const method = isEditing ? 'PATCH' : 'POST'

      const response = await fetch(endpoint, {
        method,
        headers: jsonHeaders,
        body: JSON.stringify(payload),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to save coupon')
      }

      setSuccess(isEditing ? 'Coupon updated successfully.' : 'Coupon created successfully.')
      resetForm()
      await fetchCoupons()
    } catch (err: any) {
      setError(err?.message || 'Failed to save coupon')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (coupon: Coupon) => {
    setEditingId(coupon.id)
    setForm({
      code: coupon.code,
      discountAmount: String(coupon.discountAmount),
      maxUses: String(coupon.maxUses),
      usedCount: String(coupon.usedCount),
      isActive: String(coupon.isActive),
    })
    setError('')
    setSuccess('')
  }

  const handleToggleStatus = async (coupon: Coupon) => {
    setError('')
    setSuccess('')
    try {
      const response = await fetch(`/api/admin/coupons/${coupon.id}`, {
        method: 'PATCH',
        headers: jsonHeaders,
        body: JSON.stringify({ isActive: !coupon.isActive }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Failed to update coupon status')

      setSuccess(`Coupon ${coupon.code} ${coupon.isActive ? 'deactivated' : 'activated'}.`)
      await fetchCoupons()
    } catch (err: any) {
      setError(err?.message || 'Failed to update coupon status')
    }
  }

  const handleDelete = async (coupon: Coupon) => {
    const shouldDelete = window.confirm(`Delete coupon ${coupon.code}? This cannot be undone.`)
    if (!shouldDelete) return

    setError('')
    setSuccess('')
    try {
      const response = await fetch(`/api/admin/coupons/${coupon.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Failed to delete coupon')

      setSuccess(`Coupon ${coupon.code} deleted.`)
      if (editingId === coupon.id) resetForm()
      await fetchCoupons()
    } catch (err: any) {
      setError(err?.message || 'Failed to delete coupon')
    }
  }

  return (
    <div className={styles.wrapper}>
      <section className={styles.formCard}>
        <h3 className={styles.formTitle}>{editingId ? 'Edit Coupon' : 'Create Coupon'}</h3>

        <form onSubmit={handleSubmit}>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label>Code</label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                placeholder="EID2026"
                required
              />
            </div>
            <div className={styles.field}>
              <label>Discount Amount (TK)</label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.discountAmount}
                onChange={(e) => setForm((p) => ({ ...p, discountAmount: e.target.value }))}
                required
              />
            </div>
            <div className={styles.field}>
              <label>Max Uses (-1 = unlimited)</label>
              <input
                type="number"
                min="-1"
                step="1"
                value={form.maxUses}
                onChange={(e) => setForm((p) => ({ ...p, maxUses: e.target.value }))}
                required
              />
            </div>
            <div className={styles.field}>
              <label>Used Count</label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.usedCount}
                onChange={(e) => setForm((p) => ({ ...p, usedCount: e.target.value }))}
                required
              />
            </div>
            <div className={`${styles.field} ${styles.fullWidth}`}>
              <label>Status</label>
              <select
                value={form.isActive}
                onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.value }))}
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>

          <div className={styles.formActions}>
            <button className={styles.primaryBtn} type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : editingId ? 'Update Coupon' : 'Create Coupon'}
            </button>
            {editingId && (
              <button className={styles.ghostBtn} type="button" onClick={resetForm}>
                Cancel Edit
              </button>
            )}
          </div>
        </form>

        {error && <p className={styles.error}>{error}</p>}
        {success && <p className={styles.success}>{success}</p>}
      </section>

      <section className={styles.listCard}>
        <div className={styles.listHead}>
          <h3 className={styles.formTitle}>Existing Coupons</h3>
          <button className={styles.secondaryBtn} type="button" onClick={fetchCoupons}>
            Refresh
          </button>
        </div>

        {loading ? (
          <p>Loading coupons...</p>
        ) : coupons.length === 0 ? (
          <p>No coupons found.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Discount</th>
                  <th>Usage</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((coupon) => {
                  const maxUsesLabel = coupon.maxUses === -1 ? 'Unlimited' : String(coupon.maxUses)
                  return (
                    <tr key={coupon.id}>
                      <td className={styles.code}>{coupon.code}</td>
                      <td>{coupon.discountAmount} TK</td>
                      <td>{coupon.usedCount} / {maxUsesLabel}</td>
                      <td>
                        <span className={`${styles.badge} ${coupon.isActive ? styles.active : styles.inactive}`}>
                          {coupon.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className={styles.inlineActions}>
                          <button className={styles.ghostBtn} type="button" onClick={() => handleEdit(coupon)}>
                            Edit
                          </button>
                          <button className={styles.secondaryBtn} type="button" onClick={() => handleToggleStatus(coupon)}>
                            {coupon.isActive ? 'Disable' : 'Enable'}
                          </button>
                          <button className={styles.dangerBtn} type="button" onClick={() => handleDelete(coupon)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
