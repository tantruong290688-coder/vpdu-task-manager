// ═══════════════════════════════════════════════════════════
// Component: NotificationsDropdown (updated)
// Chuông thông báo + dropdown – tương thích ngược schema cũ
// ═══════════════════════════════════════════════════════════
import { useState, useEffect, useRef } from 'react';
import { Bell, Check, BellOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../hooks/useNotifications';
import EnablePushButton from './Notifications/EnablePushButton';

export default function NotificationsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
  } = useNotifications({ limit: 20 });

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

  const handleNotificationClick = async (notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    setIsOpen(false);

    const taskId = notification.related_task_id || notification.task_id;
    if (taskId) {
      const code = notification.tasks?.code;
      if (code) {
        navigate(`/all-tasks?search=${code}&open=${taskId}`);
      } else {
        navigate(`/all-tasks?open=${taskId}`);
      }
    } else if (notification.related_url) {
      navigate(notification.related_url);
    }
  };

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)  return 'Vừa xong';
    if (mins < 60) return `${mins} phút trước`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs} giờ trước`;
    return `${Math.floor(hrs / 24)} ngày trước`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        id="notification-bell-btn"
        onClick={() => setIsOpen(!isOpen)}
        className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/50 flex items-center justify-center text-amber-600 dark:text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-all relative"
        title="Thông báo"
        aria-label="Mở thông báo"
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
        <>
          {/* Mobile Overlay */}
          <div className="fixed inset-0 z-40 sm:hidden" onClick={() => setIsOpen(false)} />

          <div className="fixed top-[65px] left-2 right-2 sm:absolute sm:top-[calc(100%+8px)] sm:right-0 sm:left-auto sm:w-[400px] bg-white dark:bg-[#1e293b] rounded-2xl shadow-[0_16px_50px_rgba(0,0,0,0.15)] border border-slate-100 dark:border-slate-700/50 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150 flex flex-col max-h-[85vh] sm:max-h-[520px]">

            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white dark:from-[#111827] dark:to-[#111827] shrink-0">
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
                  Đánh dấu đã xem
                </button>
              )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {loading && notifications.length === 0 ? (
                <div className="p-10 flex flex-col items-center gap-3 text-slate-400 dark:text-slate-500">
                  <div className="w-8 h-8 border-[3px] border-blue-200 border-t-blue-500 rounded-full animate-spin" />
                  <span className="text-[13px]">Đang tải...</span>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-10 flex flex-col items-center gap-3 text-slate-400 dark:text-slate-500">
                  <BellOff size={32} className="opacity-40" />
                  <p className="text-[13px] font-medium">Không có thông báo nào.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50 dark:divide-slate-700/30">
                  {notifications.map((n) => {
                    const displayMsg = n.title || n.message || 'Thông báo';
                    return (
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
                        <div className="flex-shrink-0 mt-1.5">
                          {!n.is_read ? (
                            <div className="w-2.5 h-2.5 bg-blue-500 rounded-full shadow-[0_0_6px_rgba(59,130,246,0.5)]" />
                          ) : (
                            <div className="w-2.5 h-2.5 bg-slate-200 dark:bg-slate-600 rounded-full" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] leading-snug break-words ${
                            !n.is_read
                              ? 'text-slate-800 dark:text-slate-100 font-semibold'
                              : 'text-slate-600 dark:text-slate-400 font-medium'
                          }`}>
                            {displayMsg}
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
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-[#111827]/50 shrink-0 space-y-2">
              {/* Enable Push Button compact */}
              <EnablePushButton variant="compact" />

              <button
                onClick={() => { setIsOpen(false); navigate('/notifications'); }}
                className="w-full text-center text-[12px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors py-1"
              >
                Xem tất cả thông báo →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
