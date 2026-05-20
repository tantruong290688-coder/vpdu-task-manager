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
  console.log('Querying table schemas for messages and chat_messages...');
  
  console.log('\n--- Messages Columns ---');
  const { data: msgRows, error: msgErr } = await supabase.from('messages').select('*').limit(1);
  if (msgErr) {
    console.error('Error fetching from messages:', msgErr.message);
  } else {
    console.log('Messages columns keys:', msgRows.length > 0 ? Object.keys(msgRows[0]) : 'No rows found');
    if (msgRows.length > 0) {
      console.log('Sample message:', msgRows[0]);
    }
  }

  console.log('\n--- Chat Messages Columns ---');
  const { data: chatMsgRows, error: chatMsgErr } = await supabase.from('chat_messages').select('*').limit(1);
  if (chatMsgErr) {
    console.error('Error fetching from chat_messages:', chatMsgErr.message);
  } else {
    console.log('Chat messages columns keys:', chatMsgRows.length > 0 ? Object.keys(chatMsgRows[0]) : 'No rows found');
    if (chatMsgRows.length > 0) {
      console.log('Sample chat message:', chatMsgRows[0]);
    }
  }
}

main().catch(console.error);
