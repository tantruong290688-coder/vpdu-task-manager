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
  console.log('Verifying if message_reactions table exists...');
  const { data, error } = await supabase.from('message_reactions').select('*').limit(1);
  if (error) {
    console.error('ERROR querying message_reactions:', error.message);
    console.log('This usually means the table does NOT exist or the migration needs to be run in Supabase SQL Editor.');
  } else {
    console.log('SUCCESS! The message_reactions table exists. Sample data:', data);
  }
}

main().catch(console.error);
