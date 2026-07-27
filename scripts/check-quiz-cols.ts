import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('Quiz').select('*').limit(1);
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Quiz columns:", data.length ? Object.keys(data[0]) : "No data, can't infer schema via select *");
  }
}
check();
