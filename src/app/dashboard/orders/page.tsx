'use client'

import { useEffect, useState } from 'react'
import styles from './Orders.module.css'

interface OrderData {
  id: string
  courseId: string
  course: { id: string; title: string }
  status: 'pending' | 'approved' | 'rejected'
  totalAmount: number
  createdAt: string
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await fetch('/api/me/orders')
        const data = await res.json()
        if (Array.isArray(data)) {
          setOrders(data)
        }
      } catch (err) {
        setError('Failed to load orders')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchOrders()
  }, [])

  return (
    <div className={styles.container}>
      <h1>My Purchases</h1>
      
      {loading && <p className={styles.loading}>Loading...</p>}
      
      {error && <p className={styles.error}>{error}</p>}
      
      {!loading && orders.length === 0 ? (
        <p className={styles.empty}>No purchases yet.</p>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Course</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>{order.course.title}</td>
                  <td>
                    <span className={`${styles.badge} ${styles[`status-${order.status}`]}`}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                  </td>
                  <td>৳{order.totalAmount.toFixed(0)}</td>
                  <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
