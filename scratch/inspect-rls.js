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
  console.log('Fetching policies for chat tables...');
  try {
    const { data, error } = await supabase
      .from('pg_policies')
      .select('*')
      .in('tablename', ['messages', 'chat_messages', 'chat_rooms']);
    
    if (error) {
      console.log('Direct query on pg_policies returned error:', error.message);
    } else {
      console.log('Policies details:', data);
    }
  } catch (err) {
    console.log('Direct query on pg_policies failed:', err.message);
  }

  try {
    const { data: tables, error: tablesErr } = await supabase
      .from('pg_tables')
      .select('*')
      .eq('schemaname', 'public');

    if (tablesErr) {
      console.log('Direct query on pg_tables returned error:', tablesErr.message);
    } else {
      console.log('Tables:', tables);
    }
  } catch (err) {
    console.log('Direct query on pg_tables failed:', err.message);
  }
}

main().catch(console.error);
