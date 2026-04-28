// ═══════════════════════════════════════════════════════════
// Hook: useNotifications
// Lấy, lọc và quản lý danh sách thông báo trong app
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

  // Fetch notifications từ Supabase
  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('notifications')
        .select('*, tasks:related_task_id(id, code, title)', { count: 'exact' })
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      // Áp dụng filter
      if (filter === 'unread') {
        query = query.eq('is_read', false);
      } else if (filter === 'task') {
        query = query.in('type', ['task_assigned', 'task_updated', 'task_comment', 'task_overdue', 'task_deadline']);
      } else if (filter === 'message') {
        query = query.in('type', ['message_private', 'message_group']);
      } else if (filter === 'overdue') {
        query = query.eq('type', 'task_overdue');
      }

      const { data, error: qErr, count } = await query;
      if (qErr) throw qErr;

      setNotifications(data || []);
      setTotal(count || 0);
    } catch (e) {
      console.error('[useNotifications fetch]', e.message);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id, filter, page, limit]);

  // Fetch unread count riêng
  const fetchUnreadCount = useCallback(async () => {
    if (!user?.id) return;
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
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
      .channel(`notifications_hook_${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setNotifications((prev) => [payload.new, ...prev]);
          setUnreadCount((prev) => prev + 1);
          setTotal((prev) => prev + 1);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => {
          fetchNotifications();
          fetchUnreadCount();
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
      .eq('user_id', user.id)
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

// Helper: gọi API tạo notification (dùng trong TaskModal, ChatPopup, ...)
export async function createNotification({ userIds, title, body, type, relatedTaskId, relatedMessageId, relatedUrl }) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    const recipients = Array.isArray(userIds) ? userIds : [userIds];
    const filtered   = recipients.filter(Boolean);
    if (filtered.length === 0) return;

    await fetch('/api/notifications/create', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        userIds:          filtered,
        title,
        body,
        type,
        relatedTaskId,
        relatedMessageId,
        relatedUrl,
      }),
    });
  } catch (e) {
    // Không throw để không gián đoạn luồng chính
    console.error('[createNotification]', e.message);
  }
}
