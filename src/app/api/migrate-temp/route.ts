import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/db';

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    
    // Find Basics Course
    const { data: courses } = await supabase.from('Course').select('id, title').ilike('title', '%Basic%');
    
    if (!courses || courses.length === 0) {
      return NextResponse.json({ error: 'Basics course not found', courses });
    }
    
    const course = courses[0];
    
    // Find batches for this course
    const { data: batches } = await (supabase as any).from('Batch').select('*').eq('courseId', course.id);
    
    // Find enrollments (Orders) for this course
    const { data: orders } = await supabase.from('Order').select('id, userId, enrolledAt, batchId, status').eq('courseId', course.id);
    
    return NextResponse.json({ course, batches, orders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message });
  }
}
