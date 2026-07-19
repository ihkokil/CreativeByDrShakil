import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { fetchWithTimeout } from './fetch-with-timeout';

// Helper to get active database index based on current GMT+6 time (offset by 4 hours)
// This is used for content read replica rotation.
export function getActiveDbIndex(): number {
  const now = new Date();
  
  // Convert to GMT+6 (Bangladesh Standard Time is UTC+6)
  const gmt6Time = new Date(now.getTime() + (6 * 60 * 60 * 1000));
  
  // Subtract 4 hours to shift the day rollover to 4:00 AM GMT+6
  const dbTime = new Date(gmt6Time.getTime() - (4 * 60 * 60 * 1000));
  const day = dbTime.getUTCDate(); // Day of month (1-31)

  const rem = day % 5;
  return rem === 0 ? 4 : rem - 1;
}

/**
 * Content reads ONLY. Rotates across 5 replicas by day-of-month.
 * FORBIDDEN for user-specific data. FORBIDDEN for writes.
 * Allowed tables: Course, Category, CourseInstructor, Quiz, Question, QuizCategory, VideoLibraryNode
 */
export function getSupabaseContentRead(env?: any): SupabaseClient<Database> {
  const e = env || process.env;
  
  const activeIndex = getActiveDbIndex() + 1; // 1-5
  const url = e[`SUPABASE_URL_${activeIndex}`] || e.SUPABASE_URL_1;
  const anonKey = e[`SUPABASE_ANON_KEY_${activeIndex}`] || e.SUPABASE_ANON_KEY_1;

  if (!url || !anonKey) {
    throw new Error(`Missing Supabase credentials for replica instance ${activeIndex}`);
  }

  return createClient<Database>(url, anonKey, {
    global: {
      fetch: fetchWithTimeout(8000),
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * All writes. All user-specific reads. All auth reads.
 * Always targets the backup DB.
 */
export function getSupabaseAdmin(env?: any): SupabaseClient<Database> {
  const e = env || process.env;
  
  const url = e.SUPABASE_URL;
  const serviceKey = e.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(`Missing Supabase admin credentials for BACKUP database`);
  }

  return createClient<Database>(url, serviceKey, {
    global: {
      fetch: fetchWithTimeout(8000),
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * @deprecated Custom JWT auth uses middleware + DeviceSession validation.
 * This function is kept for reference only. Emits console.warn on call.
 */
export function getSupabase(token?: string | null, env?: any): SupabaseClient<Database> {
  console.warn('WARNING: getSupabase() is deprecated. Custom JWT auth uses middleware + DeviceSession validation. Use getSupabaseAdmin() instead.');
  const e = env || process.env;
  
  const url = e.SUPABASE_URL;
  const anonKey = e.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(`Missing Supabase anon credentials for BACKUP database`);
  }

  return createClient<Database>(url, anonKey, {
    global: {
      fetch: fetchWithTimeout(8000),
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
