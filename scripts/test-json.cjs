const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

async function test() {
  const origSupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const { data: courses } = await origSupabase.from('Course').select('id, title, curriculumJson');

  for (const c of courses) {
    console.log(`\n--- Course: ${c.title} ---`);
    if (c.title === 'Basics') {
       console.log('Curriculum JSON length:', c.curriculumJson ? c.curriculumJson.length : 0);
       console.log('Snippet:', c.curriculumJson ? c.curriculumJson.substring(0, 500) : 'null');
    }
  }
}
test();
