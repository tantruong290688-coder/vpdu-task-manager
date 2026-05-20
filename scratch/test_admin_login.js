import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    env[key] = value;
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;
const userSupabase = createClient(supabaseUrl, anonKey);

async function run() {
  const email = 'admin@trabong.gov.vn';
  const password = 'VpduPassword2026!';

  console.log(`Attempting to sign in as ${email} with password: ${password}...`);
  const { data, error } = await userSupabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    console.error('SIGN IN FAILED:', error.message);
  } else {
    console.log('SIGN IN SUCCEEDED! User ID:', data.user.id);
  }
}

run();
