// ═══════════════════════════════════════════════════════════
// API: POST /api/notifications/create
// Tạo notification + gửi Web Push đến thiết bị user
// Chỉ admin, manager, hoặc service_role được gọi
// ═══════════════════════════════════════════════════════════
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

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

function setupWebPush() {
  const publicKey  = process.env.VITE_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject    = process.env.VAPID_SUBJECT || 'mailto:admin@vpdu-trabong.gov.vn';

  if (!publicKey || !privateKey) {
    throw new Error('Thiếu VAPID keys trong biến môi trường');
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return err(res, 405, 'Method not allowed');

  // Auth: bắt buộc phải có token (hoặc internal service call có x-service-key)
  const serviceKey = req.headers['x-service-key'];
  const isInternalCall = serviceKey && serviceKey === process.env.SUPABASE_SERVICE_ROLE_KEY;

  let callerRole = null;
  if (!isInternalCall) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return err(res, 401, 'Unauthorized');
    const token = authHeader.split(' ')[1];
    try {
      const user = await verifyUser(token);
      callerRole = user.user_metadata?.role || 'staff';
      if (!['admin', 'manager'].includes(callerRole)) {
        return err(res, 403, 'Chỉ admin/manager được tạo thông báo');
      }
    } catch (e) {
      return err(res, 401, e.message);
    }
  }

  const {
    userId,       // UUID - người nhận
    userIds,      // UUID[] - nhiều người nhận (ưu tiên nếu có)
    title,
    body,
    type = 'general',
    relatedTaskId,
    relatedMessageId,
    relatedUrl,
  } = req.body || {};

  if (!title) return err(res, 400, 'Thiếu title');

  // Xây danh sách recipients
  let recipients = [];
  if (Array.isArray(userIds) && userIds.length > 0) {
    recipients = userIds.filter(Boolean);
  } else if (userId) {
    recipients = [userId];
  }
  if (recipients.length === 0) return err(res, 400, 'Thiếu userId hoặc userIds');

  try {
    setupWebPush();
    const db = getServiceClient();

    const results = { inserted: 0, pushed: 0, failed: 0 };

    for (const uid of recipients) {
      // 1. Insert notification vào DB
      const { data: notif, error: insertErr } = await db
        .from('notifications')
        .insert({
          user_id:            uid,
          title,
          body,
          message:            body || title, // backward compat với cột cũ
          type,
          related_task_id:    relatedTaskId    || null,
          related_message_id: relatedMessageId || null,
          related_url:        relatedUrl       || null,
          task_id:            relatedTaskId    || null, // backward compat
          is_read:            false,
        })
        .select()
        .single();

      if (insertErr) {
        console.error('[create notif insert]', insertErr.message);
        results.failed++;
        continue;
      }
      results.inserted++;

      // 2. Lấy tất cả active subscriptions của user
      const { data: subs } = await db
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth')
        .eq('user_id', uid)
        .eq('is_active', true);

      if (!subs || subs.length === 0) continue;

      // 3. Gửi Web Push tới từng subscription
      const pushPayload = JSON.stringify({
        title,
        body:  body || '',
        icon:  '/favicon.svg',
        badge: '/favicon.svg',
        url:   relatedUrl || '/notifications',
        type,
        taskId: relatedTaskId || null,
      });

      for (const sub of subs) {
        const pushSub = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        };

        let logStatus = 'sent';
        let logError  = null;

        try {
          await webpush.sendNotification(pushSub, pushPayload);
          results.pushed++;
        } catch (pushErr) {
          logStatus = 'failed';
          logError  = pushErr.message;
          results.failed++;

          // 404/410 → subscription không còn hợp lệ → deactivate
          if (pushErr.statusCode === 404 || pushErr.statusCode === 410) {
            await db
              .from('push_subscriptions')
              .update({ is_active: false })
              .eq('id', sub.id);
          }

          console.error('[web-push send]', pushErr.statusCode, pushErr.message);
        }

        // Ghi log
        await db.from('notification_logs').insert({
          notification_id: notif.id,
          user_id:         uid,
          endpoint:        sub.endpoint,
          status:          logStatus,
          error_message:   logError,
        });
      }
    }

    return ok(res, { results });
  } catch (e) {
    console.error('[notifications/create]', e.message);
    return err(res, 500, 'Lỗi máy chủ: ' + e.message);
  }
}
