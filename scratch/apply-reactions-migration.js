import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env');

const env = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const parts = trimmed.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
        env[key] = value;
      }
    }
  });
}

const supabaseUrl = env.VITE_SUPABASE_URL || 'https://bkderxrcvlzlyenuxvhi.supabase.co';
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in .env!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function main() {
  const sqlFile = path.resolve(__dirname, '../supabase/migrations/037_message_reactions.sql');
  if (!fs.existsSync(sqlFile)) {
    console.error('SQL migration file not found at:', sqlFile);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlFile, 'utf8');
  console.log('Reading migration SQL...');

  // Try applying via RPC `exec_sql`
  console.log('Applying migration via RPC exec_sql...');
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    console.error('Migration failed to apply via RPC:', error.message);
    console.log('\n--- IMPORTANT ACTION REQUIRED FOR USER ---');
    console.log('Please copy the contents of "supabase/migrations/037_message_reactions.sql" and run it in the Supabase SQL Editor on your dashboard.');
    console.log('-------------------------------------------');
  } else {
    console.log('Migration applied successfully to the database!', data);
  }
}

main().catch(console.error);
