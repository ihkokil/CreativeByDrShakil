import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const adminCheck = await requireAdmin(request);
    if (!adminCheck.ok) return adminCheck.response;

    const supabase = getSupabaseAdmin();

    const [coursesRes, studentsRes, teachersRes, ordersRes, pendingRes, quizzesRes] = await Promise.all([
      supabase.from('Course').select('id, status, price', { count: 'exact' }),
      supabase.from('User').select('id', { count: 'exact', head: true }).eq('role', 'student'),
      supabase.from('User').select('id', { count: 'exact', head: true }).eq('role', 'teacher'),
      supabase.from('Order').select('id, totalAmount, courseId, createdAt').eq('status', 'approved'),
      supabase.from('Order').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('Quiz').select('id', { count: 'exact', head: true }).eq('status', 'published'),
    ]);

    const courses = coursesRes.data || [];
    const approvedOrders = ordersRes.data || [];
    const totalRevenue = approvedOrders.reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0);

    // Monthly revenue (last 12 months)
    const now = new Date();
    const monthlyRevenue: { month: string; revenue: number; enrollments: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = d.toISOString();
      const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString();
      const monthOrders = approvedOrders.filter((o: any) => o.createdAt >= monthStart && o.createdAt < nextMonth);
      monthlyRevenue.push({
        month: d.toISOString().slice(0, 7),
        revenue: monthOrders.reduce((s: number, o: any) => s + (o.totalAmount || 0), 0),
        enrollments: monthOrders.length,
      });
    }

    return NextResponse.json({
      totalCourses: courses.length,
      publishedCourses: courses.filter((c: any) => c.status === 'published').length,
      totalStudents: studentsRes.count || 0,
      totalTeachers: teachersRes.count || 0,
      totalEnrollments: approvedOrders.length,
      totalRevenue,
      pendingOrders: pendingRes.count || 0,
      publishedQuizzes: quizzesRes.count || 0,
      monthlyRevenue,
    });
  } catch (error: any) {
    console.error('[admin/stats] error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
