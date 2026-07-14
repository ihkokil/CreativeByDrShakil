import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export default async function DebugPage() {
  let status: string = 'Checking...';
  let error: string | null = null;
  let timestamp: string | null = null;
  let version: string | null = null;
  let courseCount: number | null = null;
  let studentCount: number | null = null;

  try {
    const [rows]: any = await db.execute(sql`SELECT version() as version, current_timestamp() as current_timestamp`);
    if (rows && rows.length > 0) {
      status = 'Connected';
      version = String(rows[0].version);
      timestamp = String(rows[0].current_timestamp);
      
      const [coursesRows]: any = await db.execute(sql`SELECT count(*) as count FROM Course`);
      courseCount = Number(coursesRows[0]?.count || 0);

      const [studentsRows]: any = await db.execute(sql`SELECT count(*) as count FROM User WHERE role = 'student'`);
      studentCount = Number(studentsRows[0]?.count || 0);
    } else {
      status = 'Query failed to return results';
    }
  } catch (err: any) {
    status = 'Error connecting to database';
    
    // Attempt to extract as much detail as possible from the error object
    const errorDetails = {
      message: err.message,
      cause: err.cause,
      stack: err.stack,
      name: err.name,
      code: err.code, // Common in Postgres errors
      detail: err.detail,
    };
    
    error = JSON.stringify(errorDetails, null, 2);
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50 flex flex-col items-center justify-center font-sans text-gray-900">
      <div className="max-w-2xl w-full bg-white p-8 rounded-xl shadow-lg border border-gray-100">
        <h1 className="text-3xl font-bold mb-6 text-gray-800 border-b pb-4">Database Connection Status</h1>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <span className="font-semibold text-gray-600">Status:</span>
            <span className={`px-4 py-1 rounded-full text-sm font-medium ${
              status === 'Connected' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {status}
            </span>
          </div>

          {courseCount !== null && (
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <span className="font-semibold text-gray-600">Total Courses:</span>
              <span className="text-sm font-mono text-gray-700">{courseCount}</span>
            </div>
          )}

          {studentCount !== null && (
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <span className="font-semibold text-gray-600">Total Students:</span>
              <span className="text-sm font-mono text-gray-700">{studentCount}</span>
            </div>
          )}

          {version && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <span className="font-semibold text-gray-600 block mb-2">Database Version:</span>
              <p className="text-sm font-mono text-gray-700 break-words">{version}</p>
            </div>
          )}

          {timestamp && (
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <span className="font-semibold text-gray-600">DB Current Time:</span>
              <span className="text-sm font-mono text-gray-700">
                {new Date(timestamp).toLocaleString()}
              </span>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg mt-4">
              <span className="font-semibold text-red-800 block mb-2">Error Details:</span>
              <pre className="text-xs font-mono text-red-700 whitespace-pre-wrap break-words">
                {error}
              </pre>
            </div>
          )}
        </div>
        
        <div className="mt-8 text-center text-sm text-gray-400">
          This page is for debugging purposes only and bypassing edge caching.
        </div>
      </div>
    </div>
  );
}
