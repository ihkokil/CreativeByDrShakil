import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { getGlobalSessionSettings, resolveAutoLockSetting } from '@/lib/session-manager';
import { user, deviceSession as deviceSessionSchema, order as orderSchema, course as courseSchema } from '@/db/schema';
import { sql, eq, or, ilike, and, count, desc, asc, inArray } from 'drizzle-orm';

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

    // Build where conditions: only students, with optional search
    const conditions = [eq(user.role, 'student')];
    if (search) {
      conditions.push(
        or(
          ilike(user.fullName, `%${search}%`),
          ilike(user.email, `%${search}%`)
        )!
      );
    }
    const whereClause = and(...conditions);

    // Build orderBy based on sortBy param
    const getOrderBy = (): any => {
      switch (sortBy) {
        case 'name_asc':
          return [asc(user.fullName)];
        case 'name_desc':
          return [desc(user.fullName)];
        case 'newest':
          return [desc(user.createdAt)];
        case 'oldest':
          return [asc(user.createdAt)];
        case 'lastActive':
        default:
          // Subquery: order by most recent device session activity. Note the alias "user" instead of "User"
          return [sql`(SELECT MAX(lastActivityAt) FROM DeviceSession WHERE userId = user.id) DESC`];
      }
    };

    // Fetch count + paginated users + globalSettings in parallel
    const [totalResult, users, globalSettings] = await Promise.all([
      db.select({ total: count() }).from(user).where(whereClause),
      db.select({
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        isBanned: user.isBanned,
        isSessionLockedExempt: user.isSessionLockedExempt,
        createdAt: user.createdAt,
        profileImage: user.profileImage,
        image: user.image,
      }).from(user).where(whereClause).orderBy(getOrderBy()).limit(limit).offset(offset),
      getGlobalSessionSettings(),
    ]);

    const totalCount = totalResult[0]?.total ?? 0;
    const totalPages = Math.ceil(totalCount / limit);

    const userIds = users.map(u => u.id);
    const [deviceSessions, orders] = await Promise.all([
      userIds.length > 0
        ? db.select({
            id: deviceSessionSchema.id,
            userId: deviceSessionSchema.userId,
            deviceType: deviceSessionSchema.deviceType,
            browserName: deviceSessionSchema.browserName,
            ipAddress: deviceSessionSchema.ipAddress,
            isLocked: deviceSessionSchema.isLocked,
            loggedOutAt: deviceSessionSchema.loggedOutAt,
            createdAt: deviceSessionSchema.createdAt,
            lastActivityAt: deviceSessionSchema.lastActivityAt,
          }).from(deviceSessionSchema).where(inArray(deviceSessionSchema.userId, userIds)).orderBy(desc(deviceSessionSchema.createdAt))
        : [],
      userIds.length > 0
        ? db.select({
            id: orderSchema.id,
            userId: orderSchema.userId,
            courseId: orderSchema.courseId,
            enrolledAt: orderSchema.enrolledAt,
            expiresAt: orderSchema.expiresAt,
          }).from(orderSchema).where(and(inArray(orderSchema.userId, userIds), eq(orderSchema.status, 'approved')))
        : [],
    ]);

    const orderCourseIds = [...new Set(orders.map(o => o.courseId))];
    const courses = orderCourseIds.length > 0
      ? await db.select({
          id: courseSchema.id,
          title: courseSchema.title,
          slug: courseSchema.slug,
        }).from(courseSchema).where(inArray(courseSchema.id, orderCourseIds))
      : [];
    const courseMap = new Map(courses.map(c => [c.id, c]));

    const deviceSessionsMap = new Map<string, typeof deviceSessions>();
    for (const ds of deviceSessions) {
      const list = deviceSessionsMap.get(ds.userId) || [];
      list.push(ds);
      deviceSessionsMap.set(ds.userId, list);
    }

    const ordersMap = new Map<string, any[]>();
    for (const o of orders) {
      const list = ordersMap.get(o.userId) || [];
      list.push({ ...o, course: courseMap.get(o.courseId) || null });
      ordersMap.set(o.userId, list);
    }

    const formattedUsers = await Promise.all(
      users.map(async (u) => {
        const userDeviceSessions = deviceSessionsMap.get(u.id) || [];
        const activeSessions = userDeviceSessions.filter((s) => !s.loggedOutAt && !s.isLocked);

        const latestSession = [...userDeviceSessions].sort(
          (a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
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
          enrolledCourses: userOrders.map((order) => ({
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
