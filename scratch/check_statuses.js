import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1];
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];

const supabase = createClient(url, key);

async function checkStatuses() {
  const { data, error } = await supabase.from('tasks').select('evaluation_status').limit(100);
  if (error) { console.error(error); return; }
  const counts = {};
  data.forEach(t => {
    const s = t.evaluation_status || 'null';
    counts[s] = (counts[s] || 0) + 1;
  });
  console.log(counts);
}

checkStatuses();
