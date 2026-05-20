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
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = env.VITE_SUPABASE_ANON_KEY;

const adminSupabase = createClient(supabaseUrl, serviceKey);
const userSupabase = createClient(supabaseUrl, anonKey);

async function run() {
  const userId = '92c84a2f-2ab1-48b0-93a1-8692b29673e7'; // Bùi Tấn Trường
  const receiverId = '78d639c3-79c8-4321-aa8f-2a301f1cf7e2'; // Phan Thị Linh
  const email = 'admin@trabong.gov.vn';
  const tempPassword = 'VpduPassword2026!';

  console.log(`Signing in as ${email}...`);
  const { data: signInData, error: signInError } = await userSupabase.auth.signInWithPassword({
    email,
    password: tempPassword
  });

  if (signInError) {
    console.error('Error signing in:', signInError);
    return;
  }

  const session = signInData.session;
  console.log('Signed in successfully! Session user id:', session.user.id);

  // Let's create a client authenticated with the user's JWT to test insert
  const authUserSupabase = createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: {
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    }
  });

  console.log('Testing exact browser insert payload on messages table...');
  const { data: insertData, error: insertError } = await authUserSupabase
    .from('messages')
    .insert({
      sender_id: userId,
      receiver_id: receiverId,
      content: 'Tin nhắn thử nghiệm đầy đủ trường',
      is_read: false,
      reply_to_id: null,
      attachment_url: null,
      attachment_name: null,
      attachment_type: null,
      attachment_size: null
    })
    .select();

  if (insertError) {
    console.error('INSERT FAILED!', insertError);
  } else {
    console.log('INSERT SUCCEEDED!', insertData);
    
    // Clean up our test message
    console.log('Deleting test message...');
    await adminSupabase.from('messages').delete().eq('id', insertData[0].id);
  }
}

run();
