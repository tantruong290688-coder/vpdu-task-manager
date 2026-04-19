import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Bell, Check, BellOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function NotificationsDropdown() {
  const { user, profile } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const channelRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('notifications')
      .select('*, tasks(id, code, title)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) {
      console.error('Lỗi tải thông báo:', error.message);
    }
    if (data) setNotifications(data);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    fetchNotifications();

    // Cleanup old channel if exists
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`notifications_user_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          // Add new notification to top of list immediately (optimistic)
          setNotifications((prev) => [payload.new, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('Realtime channel error, falling back to polling');
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user?.id, fetchNotifications]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAllAsRead = async () => {
    if (!user?.id) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const handleNotificationClick = async (notification) => {
    // Mark as read immediately (optimistic)
    if (!notification.is_read) {
      setNotifications((prev) =>
        prev.map((n) => n.id === notification.id ? { ...n, is_read: true } : n)
      );
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notification.id);
    }
    setIsOpen(false);
    if (notification.task_id) {
      const code = notification.tasks?.code;
      if (code) {
        navigate(`/all-tasks?search=${code}&open=${notification.task_id}`);
      } else {
        navigate(`/all-tasks`);
      }
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Vừa xong';
    if (mins < 60) return `${mins} phút trước`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} giờ trước`;
    const days = Math.floor(hrs / 24);
    return `${days} ngày trước`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/50 flex items-center justify-center text-amber-600 dark:text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-all relative"
        title="Thông báo"
      >
        <Bell size={18} className="fill-amber-600 dark:fill-amber-500" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-red-500 border-2 border-white dark:border-[#111827] rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-md leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-[calc(100%+8px)] right-0 w-[360px] sm:w-[420px] bg-white dark:bg-[#1e293b] rounded-2xl shadow-[0_16px_50px_rgba(0,0,0,0.15)] border border-slate-100 dark:border-slate-700/50 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white dark:from-[#111827] dark:to-[#111827]">
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-slate-800 dark:text-white text-[15px]">Thông báo</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[11px] font-bold rounded-full">
                  {unreadCount} mới
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-[12px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 transition-colors"
              >
                <Check size={13} />
                Đánh dấu tất cả đã xem
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="p-10 flex flex-col items-center gap-3 text-slate-400 dark:text-slate-500">
                <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
                <span className="text-[13px]">Đang tải...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-10 flex flex-col items-center gap-3 text-slate-400 dark:text-slate-500">
                <BellOff size={32} className="opacity-40" />
                <p className="text-[13px] font-medium">Không có thông báo nào.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50 dark:divide-slate-700/30">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`p-4 cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-800/60 flex gap-3 group ${
                      !n.is_read
                        ? 'bg-blue-50/60 dark:bg-blue-950/30 border-l-2 border-blue-500'
                        : 'border-l-2 border-transparent'
                    }`}
                  >
                    {/* Indicator */}
                    <div className="flex-shrink-0 mt-1">
                      {!n.is_read ? (
                        <div className="w-2.5 h-2.5 bg-blue-500 rounded-full shadow-[0_0_6px_rgba(59,130,246,0.5)]" />
                      ) : (
                        <div className="w-2.5 h-2.5 bg-slate-200 dark:bg-slate-600 rounded-full" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-[13px] leading-snug break-words ${
                          !n.is_read
                            ? 'text-slate-800 dark:text-slate-100 font-semibold'
                            : 'text-slate-600 dark:text-slate-400 font-medium'
                        }`}
                      >
                        {n.message}
                      </p>
                      {n.tasks?.code && (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[11px] font-bold rounded-md">
                          {n.tasks.code}
                        </span>
                      )}
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 font-medium">
                        {timeAgo(n.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-[#111827]/50">
            <button
              onClick={() => { setIsOpen(false); navigate('/all-tasks'); }}
              className="w-full text-center text-[12px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              Xem tất cả nhiệm vụ →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
