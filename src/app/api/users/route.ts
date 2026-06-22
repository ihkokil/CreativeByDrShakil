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
        createdAt: true,
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

      return {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        activeSessions,
        sessions: activeSessions, // compatibility
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

    return NextResponse.json({ users: formattedUsers });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}
