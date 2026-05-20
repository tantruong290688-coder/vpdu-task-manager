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
const adminSupabase = createClient(supabaseUrl, serviceKey);

async function run() {
  const userId = '92c84a2f-2ab1-48b0-93a1-8692b29673e7'; // Bùi Tấn Trường
  const newPassword = 'VpduPassword2026!'; // Standard dev password used for local/MinIO config
  
  console.log(`Setting password for Bùi Tấn Trường (admin@trabong.gov.vn) to standard: ${newPassword}...`);
  const { data, error } = await adminSupabase.auth.admin.updateUserById(userId, {
    password: newPassword
  });

  if (error) {
    console.error('Error setting password:', error);
  } else {
    console.log('Password successfully reset to standard: VpduPassword2026!');
  }
}

run();
