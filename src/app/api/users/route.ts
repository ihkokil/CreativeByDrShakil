import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth-server';
import { getGlobalSessionSettings, resolveAutoLockSetting } from '@/lib/session-manager';
import { user } from '@/db/schema';
import { sql, eq, or, ilike, and, count, desc, asc } from 'drizzle-orm';

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
          return [sql`(SELECT MAX("lastActivityAt") FROM "DeviceSession" WHERE "userId" = "user"."id") DESC NULLS LAST`];
      }
    };

    // Fetch count + paginated users + globalSettings in parallel
    const [totalResult, users, globalSettings] = await Promise.all([
      db.select({ total: count() }).from(user).where(whereClause),
      db.query.user.findMany({
        where: () => whereClause!,
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
        with: {
          deviceSessions: {
            columns: {
              id: true,
              deviceType: true,
              browserName: true,
              ipAddress: true,
              isLocked: true,
              loggedOutAt: true,
              createdAt: true,
              lastActivityAt: true,
            },
            orderBy: (ds, { desc }) => [desc(ds.createdAt)],
          },
          orders: {
            where: (o, { eq }) => eq(o.status, 'approved'),
            columns: {
              id: true,
              enrolledAt: true,
              expiresAt: true,
            },
            with: {
              course: {
                columns: {
                  id: true,
                  title: true,
                  slug: true,
                },
              },
            },
          },
        },
        orderBy: getOrderBy(),
        limit,
        offset,
      }),
      getGlobalSessionSettings(),
    ]);

    const totalCount = totalResult[0]?.total ?? 0;
    const totalPages = Math.ceil(totalCount / limit);

    const formattedUsers = await Promise.all(
      users.map(async (u) => {
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
