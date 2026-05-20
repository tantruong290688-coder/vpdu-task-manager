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
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('Fetching recent messages...');
  const { data: messages, error } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching messages:', error);
  } else {
    console.log('Recent messages in database:', messages.map(m => ({
      id: m.id,
      sender_id: m.sender_id,
      receiver_id: m.receiver_id,
      content: m.content,
      created_at: m.created_at
    })));
  }

  // Let's also check chat_messages
  console.log('\nFetching recent chat_messages...');
  const { data: chatMessages, error2 } = await supabase
    .from('chat_messages')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error2) {
    console.error('Error fetching chat messages:', error2);
  } else {
    console.log('Recent chat messages in database:', chatMessages.map(m => ({
      id: m.id,
      sender_id: m.sender_id,
      sender_name: m.sender_name,
      content: m.content,
      created_at: m.created_at
    })));
  }
}

run();
