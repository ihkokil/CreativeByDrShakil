import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/db';
import { getAuthPayload } from '@/lib/route-auth'
import { scopedToUser } from '@/lib/db-helpers';

export async function GET(request: NextRequest) {
  try {
    const payload = await getAuthPayload(request)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabaseAdmin();

    const { data: orders = [], error: ordersError } = await scopedToUser(
      supabase.from('Order').select('*'),
      payload.sub
    ).order('createdAt', { ascending: false });
      
    if (ordersError) throw ordersError;

    let ordersWithRelations = orders || [];
    if (ordersWithRelations.length > 0) {
      const courseIds = [...new Set(ordersWithRelations.map((o: any) => o.courseId).filter(Boolean))] as string[];
      const orderIds = ordersWithRelations.map((o: any) => o.id) as string[];
      
      const coursesPromise = courseIds.length 
        ? supabase.from('Course').select('*').in('id', courseIds) 
        : Promise.resolve({ data: [] });
      const paymentsPromise = orderIds.length 
        ? supabase.from('Payment').select('*').in('orderId', orderIds) 
        : Promise.resolve({ data: [] });
        
      const [coursesRes, paymentsRes] = await Promise.all([coursesPromise, paymentsPromise]);
      const courses = coursesRes.data || [];
      const payments = paymentsRes.data || [];
      
      const courseMap = new Map(courses.map((c: any) => [c.id, c]));
      const paymentMap = new Map<string, any[]>();
      for (const p of (payments as any[])) {
        const arr = paymentMap.get(p.orderId) || [];
        arr.push(p);
        paymentMap.set(p.orderId, arr);
      }
      
      ordersWithRelations = ordersWithRelations.map((o: any) => ({
        ...o,
        course: courseMap.get(o.courseId) || null,
        payments: paymentMap.get(o.id) || [],
      }));
    }

    return NextResponse.json(ordersWithRelations)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
