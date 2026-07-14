import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { eq, inArray, and, or, desc } from 'drizzle-orm';
import { requireTeacherPayload } from '@/lib/route-auth';
import { collectVideoNodes, parseCurriculumJson } from '@/lib/teacher-course-builder';
import { populateMediaVaultNodes, populateMediaVaultNodesBatch } from '@/lib/media-vault-populator';
import { 
  course as courseSchema, 
  order as orderSchema, 
  user as userSchema, 
  lessonProgress as lessonProgressSchema, 
  quiz as quizSchema, 
  quizAttempt as quizAttemptSchema 
} from '@/db/schema';

export async function GET(request: NextRequest) {
  try {
    const payload = await requireTeacherPayload(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const teacherId = payload.sub;

    // 1. Get all courses in the system
    const courses = await db.select({
      id: courseSchema.id,
      title: courseSchema.title,
      curriculumJson: courseSchema.curriculumJson,
    })
    .from(courseSchema);

    const courseIds = courses.map((c) => c.id);

    if (courseIds.length === 0) {
      return NextResponse.json({
        totalCourses: 0,
        totalStudents: 0,
        totalEnrollments: 0,
        totalLessonsCompleted: 0,
        courseProgress: [],
        aggregateProgress: 0,
      });
    }

    // 2. Get approved orders for these courses from users with 'student' role
    const approvedOrders = await db.select({
      id: orderSchema.id,
      userId: orderSchema.userId,
      courseId: orderSchema.courseId,
      user: {
        role: userSchema.role,
      }
    })
    .from(orderSchema)
    .innerJoin(userSchema, eq(orderSchema.userId, userSchema.id))
    .where(and(
      inArray(orderSchema.courseId, courseIds),
      eq(orderSchema.status, 'approved'),
      eq(userSchema.role, 'student')
    ));

    const uniqueStudentIds = new Set(approvedOrders.map(o => o.userId));
    const totalStudents = uniqueStudentIds.size;

    // 3. Get progress entries for these courses (only for students)
    const progressEntries = await db.select({
      userId: lessonProgressSchema.userId,
      courseId: lessonProgressSchema.courseId,
      lessonNodeId: lessonProgressSchema.lessonNodeId,
      user: {
        role: userSchema.role,
      }
    })
    .from(lessonProgressSchema)
    .innerJoin(userSchema, eq(lessonProgressSchema.userId, userSchema.id))
    .where(and(
      inArray(lessonProgressSchema.courseId, courseIds),
      eq(userSchema.role, 'student')
    ));

    // 4. Group data to calculate averages
    const rawCurriculums = courses.map((course) => parseCurriculumJson(course.curriculumJson));
    const populatedCurriculums = await populateMediaVaultNodesBatch(rawCurriculums);

    const courseStats = courses.map((course, index) => {
      const courseOrders = approvedOrders.filter((o) => o.courseId === course.id);
      const enrollmentCount = courseOrders.length;
      
      const curriculum = populatedCurriculums[index];
      const lessonNodes = collectVideoNodes(curriculum);
      const totalLessonsInCourse = lessonNodes.length;

      let avgProgress = 0;
      if (enrollmentCount > 0 && totalLessonsInCourse > 0) {
        // Find progress for each student enrolled in this course
        const studentIds = courseOrders.map(o => o.userId);
        const courseProgressEntries = progressEntries.filter(p => p.courseId === course.id);
        
        let totalPercentageSum = 0;
        studentIds.forEach(sid => {
          const studentProgressCount = courseProgressEntries.filter(p => p.userId === sid).length;
          const studentPercentage = Math.round((studentProgressCount / totalLessonsInCourse) * 100);
          totalPercentageSum += studentPercentage;
        });

        avgProgress = Math.round(totalPercentageSum / enrollmentCount);
      }

      return {
        courseId: course.id,
        courseTitle: course.title,
        enrollmentCount,
        avgProgress,
      };
    });

    const totalEnrollments = approvedOrders.length;
    const totalLessonsCompleted = progressEntries.length;

    // Calculate overall aggregate progress (weighted average)
    let aggregateProgress = 0;
    if (totalEnrollments > 0) {
      const totalProgressSum = courseStats.reduce((sum, cs) => sum + (cs.avgProgress * cs.enrollmentCount), 0);
      aggregateProgress = Math.round(totalProgressSum / totalEnrollments);
    }

    // Quiz Statistics
    const allQuizzes = await db.select({
      id: quizSchema.id,
      status: quizSchema.status,
    })
    .from(quizSchema);

    const totalQuizzes = allQuizzes.length;
    const activeQuizzes = allQuizzes.filter(q => q.status === 'published').length;

    const recentAttemptsRaw = await db.select()
      .from(quizAttemptSchema)
      .where(or(
        eq(quizAttemptSchema.status, 'submitted'),
        eq(quizAttemptSchema.status, 'auto_submitted')
      ))
      .orderBy(desc(quizAttemptSchema.submittedAt))
      .limit(5);

    const attemptQuizIds = Array.from(new Set(recentAttemptsRaw.map(ra => ra.quizId)));
    const attemptStudentIds = Array.from(new Set(recentAttemptsRaw.map(ra => ra.studentId)));

    const [quizzesList, studentsList] = await Promise.all([
      attemptQuizIds.length > 0
        ? db.select({ id: quizSchema.id, title: quizSchema.title })
            .from(quizSchema)
            .where(inArray(quizSchema.id, attemptQuizIds))
        : Promise.resolve([]),
      attemptStudentIds.length > 0
        ? db.select({ id: userSchema.id, fullName: userSchema.fullName })
            .from(userSchema)
            .where(inArray(userSchema.id, attemptStudentIds))
        : Promise.resolve([]),
    ]);

    const quizMap = new Map(quizzesList.map(q => [q.id, q]));
    const studentMap = new Map(studentsList.map(s => [s.id, s]));

    const recentQuizActivity = recentAttemptsRaw.map(ra => ({
      id: ra.id,
      quizTitle: quizMap.get(ra.quizId)?.title || 'Unknown Quiz',
      studentName: studentMap.get(ra.studentId)?.fullName || 'Unknown Student',
      netScore: ra.netScore,
      percentageScore: ra.percentageScore,
      submittedAt: ra.submittedAt,
    }));

    const quizStats = {
      totalQuizzes,
      activeQuizzes,
      recentActivity: recentQuizActivity,
    };

    return NextResponse.json({
      totalCourses: courses.length,
      totalStudents,
      totalEnrollments,
      totalLessonsCompleted,
      courseProgress: courseStats,
      aggregateProgress,
      quizStats,
    });
  } catch (error: any) {
    console.error('[TEACHER_STATS_ERROR]', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
