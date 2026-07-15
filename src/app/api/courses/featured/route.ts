import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db';

const formatPrice = (price: number) => {
  if (price <= 0) {
    return 'Free';
  }

  return `৳${Math.round(price).toLocaleString('en-BD')}`;
};

export async function GET() {
  try {
    const supabase = getSupabase();
    
    // Perform a PostgREST join by specifying User relation in the select query.
    // Relational mapping uses the foreign key from Course(teacherId) to User(id).
    const { data: results, error } = await supabase
      .from('Course')
      .select(`
        id,
        slug,
        title,
        price,
        duration,
        courseStartDate,
        imageUrl,
        isFeatured,
        instructor,
        publishedAt,
        updatedAt,
        teacher:User(
          id,
          fullName,
          designation,
          profileImage
        )
      `)
      .eq('status', 'published')
      .eq('isFeatured', true)
      .not('slug', 'is', null)
      .order('publishedAt', { ascending: false })
      .order('updatedAt', { ascending: false })
      .limit(1);

    if (error) throw error;

    const match = results?.[0];
    if (!match) {
      return NextResponse.json({ course: null }, {
        headers: {
          'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600',
        },
      });
    }

    // teacher is returned as an object (or array depending on schema)
    const teacher = Array.isArray(match.teacher) ? match.teacher[0] : match.teacher;

    return NextResponse.json({
      course: {
        id: match.id,
        slug: match.slug,
        title: match.title,
        price: formatPrice(match.price),
        priceValue: match.price,
        duration: match.duration,
        courseStartDate: match.courseStartDate,
        image: match.imageUrl,
        isFeatured: match.isFeatured,
        mainInstructor: {
          id: teacher?.id || `teacher-${match.id}`,
          name: teacher?.fullName || match.instructor,
          role: teacher?.designation || 'Course Instructor',
          image: teacher?.profileImage || '/placeholder-square.svg',
        },
      },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600',
      },
    });
  } catch (error: any) {
    console.error('[/api/courses/featured] Unexpected error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error.' }, { status: 500 });
  }
}