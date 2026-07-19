const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

function countLessons(nodes) {
  let count = 0;
  function visit(list) {
    list.forEach(node => {
      if (node.type !== 'folder') count++;
      if (node.children) visit(node.children);
    });
  }
  visit(nodes);
  return count;
}

async function test() {
  const origSupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const { data: courses } = await origSupabase.from('Course').select('id, title, curriculumJson');
  const { data: orders } = await origSupabase.from('Order').select('id, courseId').eq('status', 'approved');
  const { data: progress } = await origSupabase.from('LessonProgress').select('courseId');

  for (const c of courses) {
    let curriculum = [];
    try { curriculum = JSON.parse(c.curriculumJson || '[]'); } catch(e){}
    const totalLessons = countLessons(curriculum);
    const enrollments = orders.filter(o => o.courseId === c.id).length;
    const actualCompleted = progress.filter(p => p.courseId === c.id).length;
    const maxPossible = enrollments * totalLessons;
    const avgProgress = maxPossible > 0 ? Math.round((actualCompleted / maxPossible) * 100) : 0;
    
    console.log(`\nCourse: ${c.title}`);
    console.log(`Enrollments: ${enrollments}`);
    console.log(`Total Lessons: ${totalLessons}`);
    console.log(`Actual Completed Rows: ${actualCompleted}`);
    console.log(`Max Possible Completed: ${maxPossible}`);
    console.log(`Calculated Avg Progress: ${avgProgress}%`);
  }
}
test();
