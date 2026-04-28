// ═══════════════════════════════════════════════════════════
// API: POST /api/push/unsubscribe
// Tắt push subscription (is_active = false)
// ═══════════════════════════════════════════════════════════
import { createClient } from '@supabase/supabase-js';

const ok  = (res, d = {}) => res.status(200).json({ success: true, ...d });
const err = (res, s, m)   => res.status(s).json({ error: m });

function getServiceClient() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Thiếu SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function verifyUser(token) {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false }
  });
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');
  return user;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return err(res, 405, 'Method not allowed');

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return err(res, 401, 'Unauthorized');
  const token = authHeader.split(' ')[1];

  try {
    const user = await verifyUser(token);
    const { endpoint } = req.body || {};

    const db = getServiceClient();

    if (endpoint) {
      // Tắt subscription cụ thể theo endpoint
      await db
        .from('push_subscriptions')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('endpoint', endpoint);
    } else {
      // Tắt tất cả subscriptions của user này
      await db
        .from('push_subscriptions')
        .update({ is_active: false })
        .eq('user_id', user.id);
    }

    return ok(res, { message: 'Đã tắt thông báo' });
  } catch (e) {
    console.error('[push/unsubscribe]', e.message);
    return err(res, 400, e.message);
  }
}
