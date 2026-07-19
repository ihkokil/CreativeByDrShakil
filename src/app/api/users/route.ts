import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { getGlobalSessionSettings, resolveAutoLockSetting } from '@/lib/session-manager';

/**
 * GET /api/users?page=1&limit=20&search=query
 * Returns a paginated list of student users with device sessions and enrolled courses.
 * Accessible by: Admin, Teacher
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getSession();

    if (!auth || (auth.user.role !== 'admin' && auth.user.role !== 'teacher')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const search = searchParams.get('search')?.trim() || '';
    const sortBy = searchParams.get('sortBy') || 'lastActive';
    const offset = (page - 1) * limit;

    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('User')
      .select('id, fullName, email, role, isBanned, isSessionLockedExempt, createdAt, profileImage, image', { count: 'exact' })
      .eq('role', 'student');

    if (search) {
      query = query.or(`fullName.ilike.%${search}%,email.ilike.%${search}%`);
    }

    let users: any[] = [];
    let totalCount = 0;

    // Supabase RPC or custom sorting is tricky with joins unless we have a view.
    // For now, if sorting by lastActive, we fetch all matching users and sort in memory,
    // otherwise we let Supabase handle pagination. This is a compromise for migrating.
    
    // We will do a generic approach: fetch base users first. 
    // Supabase can't sort by an aggregate subquery on a different table easily without a view or RPC.
    
    // If it's not lastActive, we can do it directly.
    if (sortBy === 'name_asc') {
      query = query.order('fullName', { ascending: true });
    } else if (sortBy === 'name_desc') {
      query = query.order('fullName', { ascending: false });
    } else if (sortBy === 'newest') {
      query = query.order('createdAt', { ascending: false });
    } else if (sortBy === 'oldest') {
      query = query.order('createdAt', { ascending: true });
    }

    if (sortBy !== 'lastActive') {
      query = query.range(offset, offset + limit - 1);
      const { data: dbUsers, count: countResult } = await query;
      users = dbUsers || [];
      totalCount = countResult || 0;
    } else {
      // For lastActive, fetch all matching (this might be slow for large datasets but required without RPC)
      const { data: allDbUsers, count: countResult } = await query;
      let allUsers = allDbUsers || [];
      totalCount = countResult || 0;
      
      const allUserIds = allUsers.map((u: any) => u.id);
      
      const { data: latestSessions = [] } = allUserIds.length > 0
        ? await supabase
            .from('DeviceSession')
            .select('userId, lastActivityAt')
            .in('userId', allUserIds)
        : { data: [] };
        
      const latestActivityMap = new Map<string, string>();
      for (const session of (latestSessions as any[] || [])) {
        const existing = latestActivityMap.get(session.userId);
        if (!existing || new Date(session.lastActivityAt) > new Date(existing)) {
          latestActivityMap.set(session.userId, session.lastActivityAt);
        }
      }
      
      allUsers.sort((a: any, b: any) => {
        const aDate = new Date(latestActivityMap.get(a.id) || a.createdAt).getTime();
        const bDate = new Date(latestActivityMap.get(b.id) || b.createdAt).getTime();
        return bDate - aDate;
      });
      
      users = allUsers.slice(offset, offset + limit);
    }
    
    const globalSettings = await getGlobalSessionSettings();

    const totalPages = Math.ceil(totalCount / limit);

    const userIds = users.map((u: any) => u.id);
    
    const [{ data: deviceSessions = [] }, { data: orders = [] }] = await Promise.all([
      userIds.length > 0
        ? supabase.from('DeviceSession').select('*').in('userId', userIds).order('createdAt', { ascending: false })
        : Promise.resolve({ data: [] }),
      userIds.length > 0
        ? supabase.from('Order').select('id, userId, courseId, enrolledAt, expiresAt').in('userId', userIds).eq('status', 'approved')
        : Promise.resolve({ data: [] }),
    ]);

    const orderCourseIds = [...new Set((orders || []).map((o: any) => o.courseId))];
    const { data: courses = [] } = orderCourseIds.length > 0
      ? await supabase.from('Course').select('id, title, slug').in('id', orderCourseIds)
      : { data: [] };
      
    const courseMap = new Map((courses || []).map((c: any) => [c.id, c]));

    const deviceSessionsMap = new Map<string, any[]>();
    for (const ds of (deviceSessions as any[] || [])) {
      const list = deviceSessionsMap.get(ds.userId) || [];
      list.push(ds);
      deviceSessionsMap.set(ds.userId, list);
    }

    const ordersMap = new Map<string, any[]>();
    for (const o of (orders as any[] || [])) {
      const list = ordersMap.get(o.userId) || [];
      const course = courseMap.get(o.courseId);
      if (course) {
        list.push({ ...o, course });
      }
      ordersMap.set(o.userId, list);
    }

    const formattedUsers = await Promise.all(
      users.map(async (u: any) => {
        const userDeviceSessions = deviceSessionsMap.get(u.id) || [];
        const activeSessions = userDeviceSessions.filter((s: any) => !s.loggedOutAt && !s.isLocked);

        const latestSession = [...userDeviceSessions].sort(
          (a: any, b: any) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
        )[0];
        const lastActiveAt = latestSession ? latestSession.lastActivityAt : u.createdAt;

        let autoLockSetting = globalSettings.autoLockFirstBrowser;
        let hasUserOverride = false;
        let userAutoLockSetting = null;

        const resolved = await resolveAutoLockSetting(u.id);
        autoLockSetting = resolved.effectiveAutoLockFirstBrowser;
        hasUserOverride = resolved.hasUserOverride;
        userAutoLockSetting = resolved.userAutoLockFirstBrowser;

        const userOrders = ordersMap.get(u.id) || [];
        return {
          id: u.id,
          fullName: u.fullName,
          email: u.email,
          role: u.role,
          isBanned: u.isBanned,
          isSessionLockedExempt: u.isSessionLockedExempt,
          createdAt: u.createdAt,
          profileImage: u.profileImage || u.image || null,
          activeSessions,
          sessions: userDeviceSessions,
          lastActiveAt,
          autoLockSetting,
          hasUserOverride,
          userAutoLockSetting,
          enrolledCourses: userOrders.map((order: any) => ({
            orderId: order.id,
            courseId: order.course.id,
            courseTitle: order.course.title,
            courseSlug: order.course.slug,
            enrolledAt: order.enrolledAt,
            expiresAt: order.expiresAt,
          })),
        };
      })
    );


    return NextResponse.json({
      users: formattedUsers,
      globalSettings,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.', stack: error.stack }, { status: 500 });
  }
}
