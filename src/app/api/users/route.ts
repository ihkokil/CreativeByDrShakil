import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSession } from '@/lib/auth-server';

/**
 * GET /api/users
 * Returns a list of all users, their roles, active device sessions, and enrolled courses.
 * Accessible by: Admin, Teacher
 */
export async function GET() {
  try {
    const auth = await getSession();

    if (!auth || (auth.user.role !== 'admin' && auth.user.role !== 'teacher')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const users = await db.query.user.findMany({
      columns: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isBanned: true,
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
      orderBy: (u, { desc }) => [desc(u.createdAt)],
    });

    const formattedUsers = users.map((user) => {
      const activeSessions = user.deviceSessions.filter((s) => !s.loggedOutAt && !s.isLocked);

      // Calculate last active timestamp from all deviceSessions, falling back to createdAt
      const latestSession = [...user.deviceSessions].sort(
        (a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
      )[0];
      const lastActiveAt = latestSession ? latestSession.lastActivityAt : user.createdAt;

      return {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        isBanned: user.isBanned,
        createdAt: user.createdAt,
        profileImage: user.profileImage || user.image || null,
        activeSessions,
        sessions: user.deviceSessions, // return all sessions to enable historical last active timestamp on client
        lastActiveAt,
        enrolledCourses: user.orders.map((order) => ({
          orderId: order.id,
          courseId: order.course.id,
          courseTitle: order.course.title,
          courseSlug: order.course.slug,
          enrolledAt: order.enrolledAt,
          expiresAt: order.expiresAt,
        })),
      };
    });

    // Sort users by lastActiveAt descending
    formattedUsers.sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime());

    return NextResponse.json({ users: formattedUsers });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
