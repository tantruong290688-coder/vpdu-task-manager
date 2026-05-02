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
    console.error('SERVER DIAGNOSTIC: Thiếu VAPID keys!', {
      hasPublic: !!publicKey,
      hasPrivate: !!privateKey
    });
    throw new Error('Thiếu VAPID keys trong biến môi trường');
  }

  console.log('SERVER DIAGNOSTIC: VAPID keys detected.');
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
      // Cho phép admin, manager và staff gửi thông báo (để tin nhắn hoạt động)
      if (!['admin', 'manager', 'staff'].includes(callerRole)) {
        return err(res, 403, 'Bạn không có quyền tạo thông báo');
      }
    } catch (e) {
      return err(res, 401, e.message);
    }
  }

  const {
    userId,       // UUID - người nhận (recipient_id)
    userIds,      // UUID[] - nhiều người nhận (ưu tiên nếu có)
    actorId,      // UUID - người gửi
    title,
    body,
    type = 'general',
    entityType,   // 'task' | 'message' | 'system'
    entityId,     // UUID
    url,          // URL cụ thể
    // Backward compat fields
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
          recipient_id:       uid,
          user_id:            uid, // backward compat
          actor_id:           actorId || null,
          title,
          body,
          message:            body || title, // backward compat
          type,
          entity_type:        entityType || (relatedTaskId ? 'task' : relatedMessageId ? 'message' : 'system'),
          entity_id:          entityId   || relatedTaskId || relatedMessageId || null,
          url:                url        || relatedUrl || '/notifications',
          related_task_id:    relatedTaskId    || (entityType === 'task' ? entityId : null),
          related_message_id: relatedMessageId || (entityType === 'message' ? entityId : null),
          related_url:        relatedUrl       || url || '/notifications',
          is_read:            false,
          push_status:        'pending'
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

      if (!subs || subs.length === 0) {
        await db.from('notifications').update({ push_status: 'no_subscription' }).eq('id', notif.id);
        continue;
      }

      // 2.5 Tính tổng số chưa đọc (notifications + private messages)
      const [notifCount, msgCount] = await Promise.all([
        db.from('notifications').select('*', { count: 'exact', head: true }).eq('recipient_id', uid).eq('is_read', false),
        db.from('messages').select('*', { count: 'exact', head: true }).eq('receiver_id', uid).eq('is_read', false)
      ]);
      const totalUnread = (notifCount.count || 0) + (msgCount.count || 0);

      // 3. Gửi Web Push tới từng subscription
      const origin = req.headers.host ? `https://${req.headers.host}` : 'https://quantrivpdutrabong.vercel.app';
      const pushPayload = JSON.stringify({
        notification_id: notif.id,
        title,
        body:  body || '',
        icon:  `${origin}/icon-512.png`,
        badge: `${origin}/favicon.svg`,
        url:   url || relatedUrl || '/notifications',
        type,
        entity_id: entityId || relatedTaskId || relatedMessageId || null,
        timestamp: Date.now(),
        unreadCount: totalUnread,
      });

      let overallPushStatus = 'sent';
      let overallPushError = null;

      for (const sub of subs) {
        const pushSub = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        };

        try {
          await webpush.sendNotification(pushSub, pushPayload);
          results.pushed++;
        } catch (pushErr) {
          overallPushStatus = 'failed';
          overallPushError = pushErr.message;
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

        // Ghi log (optional but kept for history)
        await db.from('notification_logs').insert({
          notification_id: notif.id,
          user_id:         uid,
          endpoint:        sub.endpoint,
          status:          overallPushStatus === 'sent' ? 'sent' : 'failed',
          error_message:   overallPushError,
        });
      }

      // Cập nhật status cuối cùng vào bảng notifications
      await db.from('notifications')
        .update({ 
          push_status: overallPushStatus,
          push_error: overallPushError
        })
        .eq('id', notif.id);
    }

    return ok(res, { results });
  } catch (e) {
    console.error('[notifications/create]', e.message);
    return err(res, 500, 'Lỗi máy chủ: ' + e.message);
  }
}
