import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { requirePaymentManager } from '@/lib/admin-auth';

const ALLOWED_STATUSES = new Set(['pending', 'approved', 'rejected']);

export async function GET(request: NextRequest) {
  try {
    const adminCheck = await requirePaymentManager(request);
    if (!adminCheck.ok) {
      return adminCheck.response;
    }

    const { searchParams } = new URL(request.url);
    const requestedStatus = (searchParams.get('status') || 'pending').toLowerCase();
    const status = ALLOWED_STATUSES.has(requestedStatus) ? requestedStatus : 'pending';

    const supabase = getSupabaseAdmin();
    
    const { data: orders = [], error } = await supabase
      .from('Order')
      .select('*')
      .eq('status', status)
      .order('updatedAt', { ascending: false });

    if (error) throw error;

    let ordersWithRelations: any[] = orders || [];
    if (ordersWithRelations.length > 0) {
      const userIds = [...new Set(ordersWithRelations.map(o => o.userId))];
      const courseIds = [...new Set(ordersWithRelations.map(o => o.courseId))];
      const orderIds = ordersWithRelations.map(o => o.id);
      
      const [usersResponse, coursesResponse, paymentsResponse] = await Promise.all([
        userIds.length ? supabase.from('User').select('id, fullName, email').in('id', userIds) : Promise.resolve({ data: [] }),
        courseIds.length ? supabase.from('Course').select('id, title, slug').in('id', courseIds) : Promise.resolve({ data: [] }),
        orderIds.length ? supabase.from('Payment').select('orderId, phoneNumber, transactionId, amount, status, submittedAt').in('orderId', orderIds) : Promise.resolve({ data: [] }),
      ]);
      
      const users = usersResponse.data || [];
      const courses = coursesResponse.data || [];
      const payments = paymentsResponse.data || [];

      const userMap = new Map(users.map((u: any) => [u.id, u]));
      const courseMap = new Map(courses.map((c: any) => [c.id, c]));
      const paymentMap = new Map<string, any[]>();
      
      for (const p of payments as any[]) {
        const arr = paymentMap.get(p.orderId) || [];
        arr.push(p);
        paymentMap.set(p.orderId, arr);
      }
      
      ordersWithRelations = ordersWithRelations.map(o => ({
        ...o,
        user: userMap.get(o.userId) || null,
        course: courseMap.get(o.courseId) || null,
        payments: paymentMap.get(o.id) || [],
      }));
    }

    return NextResponse.json({ orders: ordersWithRelations });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
