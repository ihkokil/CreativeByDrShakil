'use client'

import { useEffect, useState } from 'react'

interface Order {
  id: string
  user: { id: string; fullName: string; email: string }
  course: { id: string; title: string }
  totalAmount: number
  status: string
  createdAt: string
  payment: {
    phoneNumber: string
    transactionId: string
    amount: number
    status: string
    submittedAt: string
  } | null
}

interface AdminPaymentsListProps {
  onApprove?: (orderId: string) => void
  onReject?: (orderId: string) => void
}

export function AdminPaymentsList({ onApprove, onReject }: AdminPaymentsListProps) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null)

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const token = localStorage.getItem('auth_token')
        const res = await fetch('/api/admin/orders?status=pending', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (!res.ok) throw new Error('Failed to fetch orders')
        const data = await res.json()
        setOrders(Array.isArray(data.orders) ? data.orders : [])
      } catch (err) {
        setError('Failed to load pending payments')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchOrders()
  }, [])

  const handleDecision = async (orderId: string, decision: 'approve' | 'reject') => {
    setProcessingOrderId(orderId)
    try {
      const token = localStorage.getItem('auth_token')
      const res = await fetch(`/api/admin/orders/${orderId}/decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ decision }),
      })

      if (res.ok) {
        setOrders(orders.filter(o => o.id !== orderId))
        if (decision === 'approve') {
          onApprove?.(orderId)
        } else {
          onReject?.(orderId)
        }
      } else {
        const payload = await res.json().catch(() => ({ error: 'Request failed' }))
        setError(payload.error || 'Request failed')
      }
    } catch (err) {
      console.error('Order decision failed:', err)
      setError('Failed to process this order')
    } finally {
      setProcessingOrderId(null)
    }
  }

  if (loading) return <p>Loading...</p>

  return (
    <div style={{ padding: '1.5rem' }}>
      <h2>Pending Payments</h2>
      
      {error && <p style={{ color: '#c62828', background: '#ffebee', padding: '1rem', borderRadius: '4px' }}>{error}</p>}
      
      {orders.length === 0 ? (
        <p style={{ color: '#666', background: '#f5f5f5', padding: '1rem', borderRadius: '4px', textAlign: 'center' }}>
          No pending payments.
        </p>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
            <thead>
              <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #e0e0e0' }}>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>Student</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>Course</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>Amount</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>Payment Proof</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                  <td style={{ padding: '1rem' }}>
                    <div>
                      <div style={{ fontWeight: '500' }}>{order.user.fullName}</div>
                      <div style={{ fontSize: '0.85rem', color: '#666' }}>{order.user.email}</div>
                    </div>
                  </td>
                  <td style={{ padding: '1rem' }}>{order.course.title}</td>
                  <td style={{ padding: '1rem' }}>৳{order.totalAmount.toFixed(0)}</td>
                  <td style={{ padding: '1rem' }}>
                    {order.payment ? (
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{order.payment.phoneNumber}</div>
                        <div style={{ fontSize: '0.78rem', color: '#666' }}>{order.payment.transactionId}</div>
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.82rem', color: '#666' }}>No payment submitted</span>
                    )}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <button
                      onClick={() => handleDecision(order.id, 'approve')}
                      disabled={processingOrderId === order.id}
                      style={{
                        marginRight: '0.5rem',
                        background: '#4CAF50',
                        color: 'white',
                        border: 'none',
                        padding: '0.5rem 1rem',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: '500',
                        fontSize: '0.85rem',
                        opacity: processingOrderId === order.id ? 0.7 : 1,
                      }}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleDecision(order.id, 'reject')}
                      disabled={processingOrderId === order.id}
                      style={{
                        background: '#f44336',
                        color: 'white',
                        border: 'none',
                        padding: '0.5rem 1rem',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: '500',
                        fontSize: '0.85rem',
                        opacity: processingOrderId === order.id ? 0.7 : 1,
                      }}
                    >
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
