// API: POST /api/push?action=subscribe  –  Lưu push subscription
//      POST /api/push?action=unsubscribe –  Tắt push subscription

import { createClient } from '@supabase/supabase-js';

/* global process */

const ok  = (res, d = {}) => res.status(200).json({ success: true, ...d });
const err = (res, s, m)   => res.status(s).json({ error: m });

function getServiceClient() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Thiếu SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function verifyUser(token) {
  const url  = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Thiếu cấu hình Supabase');
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) throw new Error('Phiên đăng nhập không hợp lệ');
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

  const { action } = req.query;

  try {
    const user = await verifyUser(token);
    const db   = getServiceClient();

    // ── subscribe ──────────────────────────────────────────
    if (action === 'subscribe') {
      const { endpoint, p256dh, auth, userAgent, deviceType, deviceName, platform } = req.body || {};
      if (!endpoint || !p256dh || !auth) return err(res, 400, 'Thiếu endpoint, p256dh hoặc auth');

      const { error: upsertErr } = await db.from('push_subscriptions').upsert(
        {
          user_id:      user.id,
          endpoint,
          p256dh,
          auth,
          user_agent:   userAgent || req.headers['user-agent'] || null,
          device_type:  deviceType  || null,
          device_name:  deviceName  || deviceType || null,
          platform:     platform    || null,
          is_active:    true,
          last_seen_at: new Date().toISOString(),
          updated_at:   new Date().toISOString(),
        },
        { onConflict: 'endpoint', ignoreDuplicates: false }
      );
      if (upsertErr) throw upsertErr;
      return ok(res, { message: 'Đăng ký nhận thông báo thành công' });
    }

    // ── unsubscribe ────────────────────────────────────────
    if (action === 'unsubscribe') {
      const { endpoint } = req.body || {};
      if (endpoint) {
        await db.from('push_subscriptions').update({ is_active: false }).eq('user_id', user.id).eq('endpoint', endpoint);
      } else {
        await db.from('push_subscriptions').update({ is_active: false }).eq('user_id', user.id);
      }
      return ok(res, { message: 'Đã tắt thông báo' });
    }

    return err(res, 400, 'Action không hợp lệ. Dùng ?action=subscribe hoặc ?action=unsubscribe');
  } catch (e) {
    console.error('[push]', e.message);
    return err(res, 400, e.message);
  }
}
