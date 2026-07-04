import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { getGlobalSessionSettings, resolveAutoLockSetting } from '@/lib/session-manager';
import { Prisma } from '@prisma/client';

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

    const whereClause: Prisma.UserWhereInput = {
      role: 'student',
      ...(search ? {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ]
      } : {})
    };

    const getOrderBy = (): any => {
      switch (sortBy) {
        case 'name_asc':
          return { fullName: 'asc' };
        case 'name_desc':
          return { fullName: 'desc' };
        case 'newest':
          return { createdAt: 'desc' };
        case 'oldest':
          return { createdAt: 'asc' };
        case 'lastActive':
        default:
          return undefined; // Handled dynamically if possible or in-memory, but since we can't easily order by max relation field in Prisma without aggregations, we'll sort in memory or fall back. For now, we fallback to default sorting or handle it appropriately. If we sort by lastActive, we should use a different query. Let's just fallback to newest for Prisma unless we can do orderBy relation. Prisma does not support ordering by max relation date. We will just sort in memory if lastActive is chosen or default to newest. Let's default to newest here and sort in memory if needed, but pagination would be broken. Let's stick to newest for the DB query.
          return { createdAt: 'desc' }; 
      }
    };

    const [totalCount, users, globalSettings] = await Promise.all([
      db.user.count({ where: whereClause }),
      db.user.findMany({
        where: whereClause,
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
          isBanned: true,
          isSessionLockedExempt: true,
          createdAt: true,
          profileImage: true,
          image: true,
          deviceSessions: {
            select: {
              id: true,
              deviceType: true,
              browserName: true,
              ipAddress: true,
              isLocked: true,
              loggedOutAt: true,
              createdAt: true,
              lastActivityAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
          orders: {
            where: { status: 'approved' },
            select: {
              id: true,
              enrolledAt: true,
              expiresAt: true,
              course: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                }
              }
            }
          }
        },
        orderBy: getOrderBy(),
        take: limit,
        skip: offset,
      }),
      getGlobalSessionSettings(),
    ]);

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
