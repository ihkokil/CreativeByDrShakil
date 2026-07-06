import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as schema from '@/db/schema';
import { eq, asc, desc, ilike, or, and, count, inArray } from 'drizzle-orm';
import { getSession } from '@/lib/auth-server';
import { getGlobalSessionSettings, resolveAutoLockSetting } from '@/lib/session-manager';

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

    const whereClause = search
      ? and(
          eq(schema.users.role, 'student'),
          or(
            ilike(schema.users.fullName, `%${search}%`),
            ilike(schema.users.email, `%${search}%`)
          )
        )
      : eq(schema.users.role, 'student');

    const getOrderBy = (): any => {
      switch (sortBy) {
        case 'name_asc':
          return asc(schema.users.fullName);
        case 'name_desc':
          return desc(schema.users.fullName);
        case 'newest':
          return desc(schema.users.createdAt);
        case 'oldest':
          return asc(schema.users.createdAt);
        case 'lastActive':
        default:
          return desc(schema.users.createdAt);
      }
    };

    const countResult = await db.select({ count: count() }).from(schema.users).where(whereClause);
    const totalCount = countResult[0].count;

    const [rawUsers, globalSettings] = await Promise.all([
      db.query.users.findMany({
        where: whereClause,
        columns: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          isBanned: true,
          isSessionLockedExempt: true,
          createdAt: true,
          profileImage: true,
          image: true,
        },
        orderBy: [getOrderBy()],
        limit: limit,
        offset: offset,
      }),
      getGlobalSessionSettings(),
    ]);

    const userIds = rawUsers.map(u => u.id);

    const [deviceSessions, orders] = await Promise.all([
      userIds.length > 0
        ? db.query.deviceSessions.findMany({
            where: inArray(schema.deviceSessions.userId, userIds),
            columns: {
              id: true,
              userId: true,
              deviceType: true,
              browserName: true,
              ipAddress: true,
              isLocked: true,
              loggedOutAt: true,
              createdAt: true,
              lastActivityAt: true,
            },
            orderBy: [desc(schema.deviceSessions.createdAt)],
          })
        : Promise.resolve([]),
      userIds.length > 0
        ? db.query.orders.findMany({
            where: and(
              inArray(schema.orders.userId, userIds),
              eq(schema.orders.status, 'approved')
            ),
            columns: {
              id: true,
              userId: true,
              courseId: true,
              enrolledAt: true,
              expiresAt: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const courseIds = [...new Set(orders.map(o => o.courseId).filter(Boolean))] as string[];
    const courses = courseIds.length > 0
      ? await db.query.courses.findMany({
          where: inArray(schema.courses.id, courseIds),
          columns: {
            id: true,
            title: true,
            slug: true,
          },
        })
      : [];

    const courseMap = new Map(courses.map(c => [c.id, c]));

    const deviceSessionsByUser = new Map<string, typeof deviceSessions>();
    for (const session of deviceSessions) {
      const list = deviceSessionsByUser.get(session.userId) || [];
      list.push(session);
      deviceSessionsByUser.set(session.userId, list);
    }

    const ordersByUser = new Map<string, typeof orders>();
    for (const order of orders) {
      const list = ordersByUser.get(order.userId) || [];
      list.push(order);
      ordersByUser.set(order.userId, list);
    }

    const users = rawUsers.map((u) => {
      const uSessions = deviceSessionsByUser.get(u.id) || [];
      const uOrdersRaw = ordersByUser.get(u.id) || [];
      const uOrders = uOrdersRaw.map(order => ({
        ...order,
        course: courseMap.get(order.courseId || '') || null,
      })).filter(order => order.course !== null);

      return {
        ...u,
        deviceSessions: uSessions,
        orders: uOrders,
      };
    });

    const totalPages = Math.ceil(totalCount / limit);

    let finalUsers = users;
    if (sortBy === 'lastActive') {
      finalUsers = [...users].sort((a, b) => {
        const latestSessionA = [...a.deviceSessions].sort((s1, s2) => new Date(s2.lastActivityAt).getTime() - new Date(s1.lastActivityAt).getTime())[0];
        const latestSessionB = [...b.deviceSessions].sort((s1, s2) => new Date(s2.lastActivityAt).getTime() - new Date(s1.lastActivityAt).getTime())[0];
        const lastActiveA = latestSessionA ? new Date(latestSessionA.lastActivityAt).getTime() : new Date(a.createdAt).getTime();
        const lastActiveB = latestSessionB ? new Date(latestSessionB.lastActivityAt).getTime() : new Date(b.createdAt).getTime();
        return lastActiveB - lastActiveA;
      });
    }

    const formattedUsers = await Promise.all(
      finalUsers.map(async (u) => {
        const activeSessions = u.deviceSessions.filter((s) => !s.loggedOutAt && !s.isLocked);

        const latestSession = [...u.deviceSessions].sort(
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
          sessions: u.deviceSessions,
          lastActiveAt,
          autoLockSetting,
          hasUserOverride,
          userAutoLockSetting,
          enrolledCourses: u.orders.map((order) => ({
            orderId: order.id,
            courseId: order.course?.id,
            courseTitle: order.course?.title,
            courseSlug: order.course?.slug,
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
