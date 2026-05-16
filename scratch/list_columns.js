import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1];
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];

const supabase = createClient(url, key);

async function listTasks() {
  const { data, error } = await supabase.from('tasks').select('*').limit(1);
  if (error) { console.error(error); return; }
  console.log(Object.keys(data[0]));
}

listTasks();
