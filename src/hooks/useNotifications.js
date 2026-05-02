// ═══════════════════════════════════════════════════════════
// Hook: useNotifications
// Tương thích ngược cả schema cũ (chỉ có message, task_id)
// lẫn schema mới (title, body, type, related_task_id)
// ═══════════════════════════════════════════════════════════
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function useNotifications({ filter = 'all', page = 1, limit = 20 } = {}) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [total,         setTotal]         = useState(0);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState(null);
  const channelRef = useRef(null);

  // Fetch notifications – dùng select * không JOIN để tương thích ngược
  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('notifications')
        .select('*', { count: 'exact' })
        .or(`recipient_id.eq.${user.id},user_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      // Áp dụng filter
      if (filter === 'unread') {
        query = query.eq('is_read', false);
      } else if (filter === 'task') {
        // Tương thích ngược: dùng message LIKE hoặc type nếu có
        query = query.or("type.in.(task_assigned,task_updated,task_comment,task_overdue,task_deadline),task_id.not.is.null");
      } else if (filter === 'message') {
        query = query.or("type.in.(message_private,message_group)");
      } else if (filter === 'overdue') {
        query = query.eq('type', 'task_overdue');
      }

      const { data, error: qErr, count } = await query;
      if (qErr) throw qErr;

      setNotifications(data || []);
      setTotal(count || 0);
    } catch (e) {
      console.error('[useNotifications fetch]', e.message);
      // Fallback: thử query đơn giản nhất
      try {
        const { data, count } = await supabase
          .from('notifications')
          .select('*', { count: 'exact' })
          .or(`recipient_id.eq.${user.id},user_id.eq.${user.id}`)
          .order('created_at', { ascending: false })
          .limit(limit);
        setNotifications(data || []);
        setTotal(count || 0);
        setError(null);
      } catch (e2) {
        setError(e2.message);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id, filter, page, limit]);

  // Fetch unread count riêng (query đơn giản, luôn hoạt động)
  const fetchUnreadCount = useCallback(async () => {
    if (!user?.id) return;
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .or(`recipient_id.eq.${user.id},user_id.eq.${user.id}`)
      .eq('is_read', false);
    setUnreadCount(count || 0);
  }, [user?.id]);

  // Initial load + realtime subscription
  useEffect(() => {
    if (!user?.id) return;

    fetchNotifications();
    fetchUnreadCount();

    // Cleanup old channel
    if (channelRef.current) supabase.removeChannel(channelRef.current);

    const channel = supabase
      .channel(`notifications_hook_${user.id}_${uniqueId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' }, // Realtime doesn't support complex filters like OR, so we filter in callback
        (payload) => {
          if (payload.new.recipient_id === user.id || payload.new.user_id === user.id) {
            setNotifications((prev) => [payload.new, ...prev]);
            setUnreadCount((prev) => prev + 1);
            setTotal((prev) => prev + 1);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications' },
        (payload) => {
          if (payload.new.recipient_id === user.id || payload.new.user_id === user.id) {
            setNotifications((prev) =>
              prev.map((n) => n.id === payload.new.id ? { ...n, ...payload.new } : n)
            );
            fetchUnreadCount();
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user?.id, filter, page]);

  // Mark 1 notification đã đọc
  const markAsRead = useCallback(async (notificationId) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => n.id === notificationId ? { ...n, is_read: true } : n)
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('user_id', user.id);
  }, [user?.id]);

  // Mark tất cả đã đọc
  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .or(`recipient_id.eq.${user.id},user_id.eq.${user.id}`)
      .eq('is_read', false);
  }, [user?.id]);

  return {
    notifications,
    unreadCount,
    total,
    loading,
    error,
    hasMore: total > page * limit,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
  };
}

// ─────────────────────────────────────────────────────────
// Helper: trích xuất text hiển thị từ notification
// Tương thích cả schema cũ (message) và mới (title + body)
// ─────────────────────────────────────────────────────────
export function getNotifDisplay(n) {
  const title = n.title || n.message || 'Thông báo';
  const body  = n.body  || (n.title && n.message && n.message !== n.title ? n.message : '');
  const taskId = n.related_task_id || n.task_id || null;
  return { title, body, taskId };
}

// ─────────────────────────────────────────────────────────
// Helper: gọi API tạo notification (dùng trong TaskModal, ChatPopup, ...)
// ─────────────────────────────────────────────────────────
export async function createNotification({ userIds, actorId, title, body, type, entityType, entityId, url, relatedTaskId, relatedMessageId, relatedUrl }) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    const recipients = Array.isArray(userIds) ? userIds : [userIds];
    const filtered   = recipients.filter(Boolean);
    if (filtered.length === 0) return;

    // Gọi API
    const response = await fetch('/api/notifications/create', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        userIds:          filtered,
        actorId:          actorId || session.user.id,
        title,
        body,
        type,
        entityType,
        entityId,
        url,
        relatedTaskId,
        relatedMessageId,
        relatedUrl,
      }),
    });

    if (!response.ok) {
      // Fallback: nếu API chưa sẵn sàng (migration chưa chạy), insert trực tiếp vào DB
      const isApiError = response.status === 500 || response.status === 404;
      if (isApiError) {
        for (const uid of filtered) {
          await supabase.from('notifications').insert({
            recipient_id: uid,
            user_id: uid, // backward compat
            title,
            body,
            message: body || title,
            type: type || 'general',
            entity_type: entityType,
            entity_id: entityId,
            url,
            is_read: false,
          });
        }
      }
    }
  } catch (e) {
    // Fallback im lặng
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const recipients = Array.isArray(userIds) ? userIds : [userIds];
      for (const uid of recipients.filter(Boolean)) {
        await supabase.from('notifications').insert({
          recipient_id: uid,
          user_id: uid,
          message: body || title,
          is_read: false,
        });
      }
    } catch (_) { /* ignore */ }
    console.error('[createNotification]', e.message);
  }
}
