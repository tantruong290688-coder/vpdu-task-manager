// ═══════════════════════════════════════════════════════════
// API: POST /api/push/subscribe
// Lưu push subscription của user vào Supabase
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
    const { endpoint, p256dh, auth, userAgent, deviceType, platform } = req.body || {};

    if (!endpoint || !p256dh || !auth) {
      return err(res, 400, 'Thiếu thông tin subscription (endpoint, p256dh, auth)');
    }

    const db = getServiceClient();

    // Upsert: nếu endpoint đã tồn tại thì cập nhật, không thì tạo mới
    const { error: upsertErr } = await db
      .from('push_subscriptions')
      .upsert(
        {
          user_id:     user.id,
          endpoint,
          p256dh,
          auth,
          user_agent:  userAgent || req.headers['user-agent'] || null,
          device_type: deviceType || null,
          platform:    platform || null,
          is_active:   true,
          updated_at:  new Date().toISOString(),
        },
        { onConflict: 'user_id,endpoint', ignoreDuplicates: false }
      );

    if (upsertErr) throw upsertErr;

    return ok(res, { message: 'Đăng ký nhận thông báo thành công' });
  } catch (e) {
    console.error('[push/subscribe]', e.message);
    return err(res, 400, e.message);
  }
}
