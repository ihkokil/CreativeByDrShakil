import { NextResponse } from 'next/server';
import postgres from 'postgres';

export async function GET() {
  try {
    const url = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
    if (!url) {
      return NextResponse.json({ error: 'No DATABASE_URL' });
    }
    const sql = postgres(url, { ssl: 'require' });
    
    // Get the course releaseMode and curriculumJson
    const courses = await sql`SELECT id, title, "releaseMode" FROM "Course" LIMIT 10;`;
    
    return NextResponse.json({ success: true, courses });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}
