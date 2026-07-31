import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase environment variables.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("Fetching batches...");
    const { data: batches, error: batchError } = await supabase.from('Batch').select('id, name, courseId');

    if (batchError) {
        console.error("Error fetching batches:", batchError);
        return;
    }

    const batch71 = batches.find(b => b.name.includes('71'));
    const batch72 = batches.find(b => b.name.includes('72'));

    if (!batch71 || !batch72) {
        console.error("Could not find Batch 71 or Batch 72. Available batches:", batches.map(b => b.name).join(", "));
        return;
    }

    console.log("Found Batch 71:", batch71.id);
    console.log("Found Batch 72:", batch72.id);

    console.log("Fetching enrollments...");
    const { data: orders, error: orderError } = await supabase.from('Order').select('id, enrolledAt, batchId').eq('courseId', batch71.courseId);

    if (orderError) {
        console.error("Error fetching orders:", orderError);
        return;
    }

    let updated71 = 0;
    let updated72 = 0;

    for (const order of orders) {
        if (!order.enrolledAt) continue;

        // Using string matching for the dates
        if (order.enrolledAt.startsWith('2026-06-12')) {
            await supabase.from('Order').update({ batchId: batch71.id }).eq('id', order.id);
            updated71++;
        } else if (order.enrolledAt.startsWith('2026-07-10')) {
            await supabase.from('Order').update({ batchId: batch72.id }).eq('id', order.id);
            updated72++;
        }
    }

    console.log(`✅ Successfully moved ${updated71} students to Batch 71`);
    console.log(`✅ Successfully moved ${updated72} students to Batch 72`);
}

main().catch(console.error);
