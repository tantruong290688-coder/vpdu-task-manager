// ═══════════════════════════════════════════════════════════
// API: GET /api/cron/deadline-reminder
// Vercel Cron Job – chạy hằng ngày 7:00 SA (UTC+7 = 00:00 UTC)
// Kiểm tra nhiệm vụ sắp đến hạn (1 ngày) và quá hạn
// ═══════════════════════════════════════════════════════════
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

function getServiceClient() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Thiếu SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function setupWebPush() {
  const publicKey  = process.env.VITE_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject    = process.env.VAPID_SUBJECT || 'mailto:admin@vpdu-trabong.gov.vn';
  if (!publicKey || !privateKey) throw new Error('Thiếu VAPID keys');
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

async function sendPushToUser(db, userId, payload) {
  const { data: subs } = await db
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (!subs?.length) return;

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      );
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        await db.from('push_subscriptions').update({ is_active: false }).eq('id', sub.id);
      }
    }
  }
}

export default async function handler(req, res) {
  // Xác thực cron secret
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    setupWebPush();
    const db = getServiceClient();

    const today    = new Date();
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const todayStr    = today.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // 1. Lấy nhiệm vụ SẮP đến hạn (due_date = ngày mai)
    const { data: upcomingTasks } = await db
      .from('tasks')
      .select('id, code, title, assignee_id, assigned_by, task_collaborators(user_id)')
      .eq('due_date', tomorrowStr)
      .not('status', 'eq', 'done');

    // 2. Lấy nhiệm vụ QUÁ HẠN (due_date < hôm nay, chưa hoàn thành)
    const { data: overdueTasks } = await db
      .from('tasks')
      .select('id, code, title, assignee_id, assigned_by, task_collaborators(user_id)')
      .lt('due_date', todayStr)
      .not('status', 'eq', 'done');

    let notifCount = 0;

    // Xử lý nhiệm vụ sắp hạn
    for (const task of upcomingTasks || []) {
      const recipients = new Set();
      if (task.assignee_id) recipients.add(task.assignee_id);
      (task.task_collaborators || []).forEach(c => recipients.add(c.user_id));

      for (const uid of recipients) {
        await db.from('notifications').insert({
          user_id:         uid,
          title:           'Nhiệm vụ sắp đến hạn',
          body:            `[${task.code}] ${task.title} - Hạn hoàn thành: ngày mai`,
          message:         `[${task.code}] ${task.title} - Hạn hoàn thành: ngày mai`,
          type:            'task_deadline',
          related_task_id: task.id,
          related_url:     `/all-tasks?open=${task.id}`,
          task_id:         task.id,
        });

        await sendPushToUser(db, uid, {
          title: 'Nhiệm vụ sắp đến hạn',
          body:  `[${task.code}] ${task.title} - Hạn hoàn thành: ngày mai`,
          icon:  '/favicon.svg',
          url:   `/all-tasks?open=${task.id}`,
          type:  'task_deadline',
        });
        notifCount++;
      }
    }

    // Xử lý nhiệm vụ quá hạn
    for (const task of overdueTasks || []) {
      const recipients = new Set();
      if (task.assignee_id) recipients.add(task.assignee_id);
      if (task.assigned_by) recipients.add(task.assigned_by);
      (task.task_collaborators || []).forEach(c => recipients.add(c.user_id));

      for (const uid of recipients) {
        // Kiểm tra đã gửi thông báo quá hạn hôm nay chưa
        const { count } = await db
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', uid)
          .eq('related_task_id', task.id)
          .eq('type', 'task_overdue')
          .gte('created_at', `${todayStr}T00:00:00`);

        if (count > 0) continue; // Đã gửi rồi

        await db.from('notifications').insert({
          user_id:         uid,
          title:           'Nhiệm vụ quá hạn!',
          body:            `[${task.code}] ${task.title} đã quá hạn hoàn thành`,
          message:         `[${task.code}] ${task.title} đã quá hạn hoàn thành`,
          type:            'task_overdue',
          related_task_id: task.id,
          related_url:     `/all-tasks?open=${task.id}`,
          task_id:         task.id,
        });

        await sendPushToUser(db, uid, {
          title: '⚠️ Nhiệm vụ quá hạn!',
          body:  `[${task.code}] ${task.title} đã quá hạn hoàn thành`,
          icon:  '/favicon.svg',
          url:   `/all-tasks?open=${task.id}`,
          type:  'task_overdue',
        });
        notifCount++;
      }
    }

    return res.status(200).json({
      success: true,
      upcoming: (upcomingTasks || []).length,
      overdue:  (overdueTasks  || []).length,
      notifications: notifCount,
    });
  } catch (e) {
    console.error('[cron/deadline-reminder]', e.message);
    return res.status(500).json({ error: e.message });
  }
}
