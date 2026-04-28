// ═══════════════════════════════════════════════════════════
// API: /api/notifications/index.js
// GET  /api/notifications          - Danh sách notifications
// POST /api/notifications/mark-read     - Đánh dấu 1 đã đọc
// POST /api/notifications/mark-all-read - Đánh dấu tất cả đã đọc
// ═══════════════════════════════════════════════════════════
import { createClient } from '@supabase/supabase-js';

const ok  = (res, d = {}) => res.status(200).json({ success: true, ...d });
const err = (res, s, m)   => res.status(s).json({ error: m });

async function getUserClient(token) {
  const url    = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false }
  });
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');
  return { user, client };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return err(res, 401, 'Unauthorized');
  const token = authHeader.split(' ')[1];

  try {
    const { user, client } = await getUserClient(token);

    // ── GET: lấy danh sách ──────────────────────────────────
    if (req.method === 'GET') {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const page     = parseInt(url.searchParams.get('page') || '1');
      const limit    = parseInt(url.searchParams.get('limit') || '20');
      const isRead   = url.searchParams.get('is_read');   // 'true'|'false'|null
      const type     = url.searchParams.get('type');       // 'task'|'message'|null
      const from     = (page - 1) * limit;
      const to       = from + limit - 1;

      let query = client
        .from('notifications')
        .select('*, tasks:related_task_id(id, code, title)', { count: 'exact' })
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (isRead !== null && isRead !== '') {
        query = query.eq('is_read', isRead === 'true');
      }
      if (type) {
        query = query.eq('type', type);
      }

      const { data, error: qErr, count } = await query;
      if (qErr) throw qErr;

      return ok(res, {
        notifications: data || [],
        total: count || 0,
        page,
        limit,
        hasMore: (from + limit) < (count || 0),
      });
    }

    // ── POST: mark-read / mark-all-read ─────────────────────
    if (req.method === 'POST') {
      const urlPath = req.url.split('?')[0];

      if (urlPath.endsWith('mark-all-read')) {
        const { error: upErr } = await client
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', user.id)
          .eq('is_read', false);
        if (upErr) throw upErr;
        return ok(res, { message: 'Đã đánh dấu tất cả đã đọc' });
      }

      if (urlPath.endsWith('mark-read')) {
        const { notificationId } = req.body || {};
        if (!notificationId) return err(res, 400, 'Thiếu notificationId');
        const { error: upErr } = await client
          .from('notifications')
          .update({ is_read: true })
          .eq('id', notificationId)
          .eq('user_id', user.id);
        if (upErr) throw upErr;
        return ok(res, { message: 'Đã đánh dấu đã đọc' });
      }

      return err(res, 404, 'Endpoint không tồn tại');
    }

    return err(res, 405, 'Method not allowed');
  } catch (e) {
    console.error('[notifications/index]', e.message);
    return err(res, 400, e.message);
  }
}
