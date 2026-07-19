const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });
const supabase = createClient(process.env.SUPABASE_URL_3, process.env.SUPABASE_SERVICE_ROLE_KEY_3);
async function test() {
  const { data: courses } = await supabase.from('Course').select('id, title');
  console.log('Courses:', courses.length);
  
  const { data: orders } = await supabase.from('Order').select('id, courseId, status').eq('status', 'approved');
  console.log('Approved Orders:', orders.length);
  
  const { data: progress } = await supabase.from('LessonProgress').select('courseId, userId');
  console.log('Progress Rows:', progress.length);
  
  // check original database
  const origSupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: origProgress } = await origSupabase.from('LessonProgress').select('courseId, userId');
  console.log('Original Progress Rows:', origProgress.length);
}
test();
