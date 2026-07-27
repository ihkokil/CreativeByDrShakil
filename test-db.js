import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase
    .from('Question')
    .select('questionText, optionA, optionB, optionC, optionD, optionE, correctOption')
    .eq('quizId', 'X9t5HsQU_bM2neVQOCrKP')
    .order('createdAt', { ascending: true });
    
  if (error) console.error(error);
  console.log(JSON.stringify(data, null, 2));
}
run();
