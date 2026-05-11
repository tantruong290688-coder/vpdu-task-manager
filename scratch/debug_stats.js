import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function debug() {
  console.log('--- Checking tasks distribution ---');
  const { data: tasks, error: tError } = await supabase
    .from('tasks')
    .select('status, evaluation_status, evaluation_score');
  
  if (tError) {
    console.error('Error fetching tasks:', tError);
    return;
  }

  const dist = tasks.reduce((acc, t) => {
    const key = `${t.status} | ${t.evaluation_status} | ${t.evaluation_score === null ? 'null' : 'score'}`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  console.table(dist);

  console.log('\n--- Checking RPC stats ---');
  const { data: stats, error: sError } = await supabase.rpc('get_dashboard_stats');
  
  if (sError) {
    console.error('Error calling RPC:', sError);
  } else {
    console.log('RPC Response:', JSON.stringify(stats, null, 2));
  }
}

debug();
