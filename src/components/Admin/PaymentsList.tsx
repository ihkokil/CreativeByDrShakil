'use client'

import { useEffect, useState } from 'react'

interface Order {
  id: string
  user: { id: string; fullName: string; email: string }
  course: { id: string; title: string }
  totalAmount: number
  status: string
}

interface AdminPaymentsListProps {
  onApprove?: (orderId: string) => void
  onReject?: (orderId: string) => void
}

export function AdminPaymentsList({ onApprove, onReject }: AdminPaymentsListProps) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await fetch('/api/admin/orders')
        if (!res.ok) throw new Error('Failed to fetch orders')
        const data = await res.json()
        setOrders(Array.isArray(data) ? data : [])
      } catch (err) {
        setError('Failed to load pending payments')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchOrders()
  }, [])

  const handleApprove = async (orderId: string) => {
    try {
      const res = await fetch(`/api/orders/approve?token=${orderId}`, { method: 'GET' })
      if (res.ok) {
        setOrders(orders.filter(o => o.id !== orderId))
        onApprove?.(orderId)
      }
    } catch (err) {
      console.error('Approval failed:', err)
    }
  }

  const handleReject = async (orderId: string) => {
    try {
      const res = await fetch(`/api/orders/reject?token=${orderId}`, { method: 'GET' })
      if (res.ok) {
        setOrders(orders.filter(o => o.id !== orderId))
        onReject?.(orderId)
      }
    } catch (err) {
      console.error('Rejection failed:', err)
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
                    <button
                      onClick={() => handleApprove(order.id)}
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
                      }}
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(order.id)}
                      style={{
                        background: '#f44336',
                        color: 'white',
                        border: 'none',
                        padding: '0.5rem 1rem',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: '500',
                        fontSize: '0.85rem',
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
