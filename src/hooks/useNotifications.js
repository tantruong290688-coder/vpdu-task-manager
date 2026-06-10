// ═══════════════════════════════════════════════════════════
// Hook: useNotifications
// Tương thích ngược cả schema cũ (chỉ có message, task_id)
// lẫn schema mới (title, body, type, related_task_id)
// ═══════════════════════════════════════════════════════════
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useMessage } from '../context/MessageContext';
import toast from 'react-hot-toast';

export function useNotifications({ filter = 'all', page = 1, limit = 20 } = {}) {
  const { user } = useAuth();
  const { isChatOpen, activeChatUserId, activeRoomId } = useMessage();
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

  const isChatOpenRef = useRef(isChatOpen);
  const activeChatUserIdRef = useRef(activeChatUserId);
  const activeRoomIdRef = useRef(activeRoomId);

  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
    activeChatUserIdRef.current = activeChatUserId;
    activeRoomIdRef.current = activeRoomId;
  }, [isChatOpen, activeChatUserId, activeRoomId]);

  // Initial load + realtime subscription
  useEffect(() => {
    if (!user?.id) return;

    fetchNotifications();
    fetchUnreadCount();

    // Cleanup old channel
    if (channelRef.current) supabase.removeChannel(channelRef.current);

    const uniqueId = Math.random().toString(36).substring(7);
    try {
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

              // Hiển thị thông báo nổi in-app (Toast) hoặc Native Notification cho người dùng đang hoạt động
              if (payload.new.actor_id !== user.id) {
                const title = payload.new.title || 'Thông báo mới';
                const body = payload.new.body || payload.new.message || '';
                const type = payload.new.type || 'general';
                const isMsg = type.startsWith('message');

                // Chặn thông báo trùng lặp nếu đang mở phòng chat tương ứng
                let shouldSuppress = false;
                if (isMsg && isChatOpenRef.current) {
                  if (type === 'message_private' && activeChatUserIdRef.current === payload.new.actor_id) {
                    shouldSuppress = true;
                  } else if (type === 'message_group') {
                    const targetUrl = payload.new.url || payload.new.related_url || '';
                    const urlParams = new URLSearchParams(targetUrl.split('?')[1] || '');
                    const roomId = urlParams.get('room');
                    if (roomId && activeRoomIdRef.current === roomId) {
                      shouldSuppress = true;
                    }
                  }
                }

                if (!shouldSuppress) {
                  // 1. Nếu tab đang chạy ngầm (background), hiển thị Native Notification thông qua Service Worker
                  if (
                    typeof window !== 'undefined' &&
                    'Notification' in window &&
                    Notification.permission === 'granted' &&
                    document.visibilityState === 'hidden'
                  ) {
                    if ('serviceWorker' in navigator) {
                      navigator.serviceWorker.ready.then((reg) => {
                        reg.showNotification(title, {
                          body: body,
                          icon: '/icon-512.png',
                          badge: '/favicon.svg',
                          tag: payload.new.id || 'general',
                          renotify: true,
                          data: {
                            url: payload.new.url || payload.new.related_url || '/notifications',
                          }
                        });
                      });
                    }
                  } else {
                    // 2. Nếu tab ở foreground, hiện Toast
                    toast.custom((t) => 
                      React.createElement('div', {
                        key: t.id,
                        onClick: () => {
                          toast.dismiss(t.id);
                          const targetUrl = payload.new.url || payload.new.related_url;
                          if (targetUrl) {
                            if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
                              window.open(targetUrl, '_blank');
                            } else if (window.routerNavigate) {
                              window.routerNavigate(targetUrl);
                            } else {
                              window.location.href = targetUrl;
                            }
                          }
                        },
                        className: `${
                          t.visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
                        } max-w-sm w-full bg-white dark:bg-slate-800 shadow-xl rounded-2xl pointer-events-auto flex ring-1 ring-black/5 dark:ring-white/10 border border-slate-100 dark:border-slate-700 cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-2xl`
                      }, [
                        React.createElement('div', { className: 'flex-1 p-4', key: 'body' }, 
                          React.createElement('div', { className: 'flex items-start gap-3' }, [
                            React.createElement('div', { className: 'flex-shrink-0 w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-lg', key: 'icon' }, isMsg ? '💬' : '🔔'),
                            React.createElement('div', { className: 'flex-1 min-w-0', key: 'text' }, [
                              React.createElement('p', { className: 'text-[13px] font-extrabold text-slate-900 dark:text-white truncate', key: 'title' }, title),
                              body ? React.createElement('p', { className: 'mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed', key: 'desc' }, body) : null
                            ])
                          ])
                        ),
                        React.createElement('div', { className: 'flex border-l border-slate-100 dark:border-slate-700', key: 'action' }, 
                          React.createElement('button', {
                            onClick: (e) => {
                              e.stopPropagation();
                              toast.dismiss(t.id);
                            },
                            className: 'w-full px-4 border border-transparent rounded-none rounded-r-2xl text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors focus:outline-none'
                          }, 'Đóng')
                        )
                      ]), {
                        duration: 5000,
                        position: 'top-right',
                      }
                    );
                  }
                }
              }
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
    } catch (err) {
      console.warn('[Realtime] Notifications hook subscription error:', err);
    }

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
    if (!user?.id) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .or(`recipient_id.eq.${user.id},user_id.eq.${user.id}`)
      .eq('is_read', false);
  }, [user?.id]);

  // Xóa tất cả thông báo ĐÃ ĐỌC
  const deleteReadNotifications = useCallback(async () => {
    if (!user?.id) return;
    
    // Optimistic update
    setNotifications((prev) => prev.filter((n) => !n.is_read));
    
    const { error } = await supabase
      .from('notifications')
      .delete()
      .or(`recipient_id.eq.${user.id},user_id.eq.${user.id}`)
      .eq('is_read', true);
      
    if (error) {
      console.error('[deleteReadNotifications error]', error);
      fetchNotifications(); // Rollback if error
    } else {
      // Cập nhật lại tổng số lượng
      fetchNotifications();
    }
  }, [user?.id, fetchNotifications]);

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
    deleteReadNotifications,
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
