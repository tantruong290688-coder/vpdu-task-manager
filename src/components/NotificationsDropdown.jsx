// ═══════════════════════════════════════════════════════════
// Component: NotificationsDropdown (updated)
// Chuông thông báo + dropdown – tương thích ngược schema cũ
// ═══════════════════════════════════════════════════════════
import { useState, useEffect, useRef } from 'react';
import { Bell, Check, BellOff, X, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotifications, getNotifDisplay } from '../hooks/useNotifications';
import EnablePushButton from './Notifications/EnablePushButton';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'Vừa xong';
  if (mins < 60) return `${mins} phút`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs} giờ`;
  return `${Math.floor(hrs / 24)} ngày`;
}

export default function NotificationsDropdown() {
  const [isOpen, setIsOpen]   = useState(false);
  const dropdownRef           = useRef(null);
  const navigate              = useNavigate();

  const {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    fetchNotifications,
  } = useNotifications({ limit: 20 });

  // Đóng khi click bên ngoài
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Khoá scroll body khi dropdown mở trên mobile
  useEffect(() => {
    if (isOpen && window.innerWidth < 640) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleNotificationClick = async (notification) => {
    if (!notification.is_read) await markAsRead(notification.id);
    setIsOpen(false);

    const { taskId } = getNotifDisplay(notification);
    if (taskId) {
      navigate(`/all-tasks?open=${taskId}`);
    } else if (notification.related_url) {
      navigate(notification.related_url);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        id="notification-bell-btn"
        onPointerDown={(e) => { e.stopPropagation(); setIsOpen(v => !v); }}
        className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/50 flex items-center justify-center text-amber-600 dark:text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-all relative touch-manipulation"
        title="Thông báo"
        aria-label="Mở thông báo"
      >
        <Bell size={18} className="fill-amber-600 dark:fill-amber-500" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-red-500 border-2 border-white dark:border-[#111827] rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-md leading-none pointer-events-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Mobile Backdrop */}
          <div
            className="fixed inset-0 z-[55] sm:hidden bg-black/20 backdrop-blur-[2px]"
            onPointerDown={() => setIsOpen(false)}
          />

          {/* Dropdown Panel */}
          <div className="
            fixed top-[calc(60px+env(safe-area-inset-top))] left-0 right-0 mx-2
            sm:absolute sm:top-[calc(100%+8px)] sm:right-0 sm:left-auto sm:mx-0 sm:w-[400px]
            bg-white dark:bg-[#1e293b] rounded-2xl shadow-[0_16px_50px_rgba(0,0,0,0.18)]
            border border-slate-100 dark:border-slate-700/50 overflow-hidden z-[60]
            flex flex-col max-h-[75vh] sm:max-h-[520px]
            animate-in fade-in slide-in-from-top-2 duration-150
          ">

            {/* Header */}
            <div className="px-4 py-3.5 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white dark:from-[#111827] dark:to-[#111827] shrink-0">
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-slate-800 dark:text-white text-[15px]">Thông báo</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[11px] font-bold rounded-full">
                    {unreadCount} mới
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onPointerDown={() => markAllAsRead()}
                    className="text-[12px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 transition-colors px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 touch-manipulation"
                  >
                    <Check size={13} />
                    Đọc hết
                  </button>
                )}
                <button
                  onPointerDown={() => fetchNotifications()}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors touch-manipulation"
                  title="Tải lại"
                >
                  <RefreshCw size={13} />
                </button>
                <button
                  onPointerDown={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors sm:hidden touch-manipulation"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {/* Loading */}
              {loading && notifications.length === 0 && (
                <div className="p-10 flex flex-col items-center gap-3 text-slate-400 dark:text-slate-500">
                  <div className="w-7 h-7 border-[3px] border-blue-200 border-t-blue-500 rounded-full animate-spin" />
                  <span className="text-[13px]">Đang tải...</span>
                </div>
              )}

              {/* Error */}
              {error && !loading && (
                <div className="p-8 flex flex-col items-center gap-2 text-red-400">
                  <p className="text-[13px] font-medium">Không thể tải thông báo</p>
                  <button
                    onPointerDown={() => fetchNotifications()}
                    className="text-[12px] text-blue-600 underline"
                  >
                    Thử lại
                  </button>
                </div>
              )}

              {/* Empty */}
              {!loading && !error && notifications.length === 0 && (
                <div className="p-10 flex flex-col items-center gap-3 text-slate-400 dark:text-slate-500">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <BellOff size={24} className="opacity-50" />
                  </div>
                  <p className="text-[13px] font-medium text-center">Không có thông báo nào</p>
                </div>
              )}

              {/* Notification list */}
              {!error && notifications.length > 0 && (
                <div className="divide-y divide-slate-50 dark:divide-slate-700/30">
                  {notifications.map((n) => {
                    const { title, body, taskId } = getNotifDisplay(n);
                    return (
                      <div
                        key={n.id}
                        onPointerDown={() => handleNotificationClick(n)}
                        className={`px-4 py-3.5 cursor-pointer transition-all active:bg-slate-100 dark:active:bg-slate-800 flex gap-3 touch-manipulation select-none
                          ${!n.is_read
                            ? 'bg-blue-50/60 dark:bg-blue-950/30 border-l-[3px] border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/40'
                            : 'border-l-[3px] border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60'
                          }
                        `}
                      >
                        {/* Dot */}
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
                            {title}
                          </p>
                          {body && body !== title && (
                            <p className="text-[12px] text-slate-500 dark:text-slate-500 mt-0.5 line-clamp-2">
                              {body}
                            </p>
                          )}
                          {(taskId || n.type) && (
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              {n.type && (
                                <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded text-[10px] font-bold">
                                  {n.type === 'task_assigned'  ? '📋 Nhiệm vụ' :
                                   n.type === 'task_updated'   ? '✏️ Cập nhật' :
                                   n.type === 'task_overdue'   ? '⚠️ Quá hạn' :
                                   n.type === 'task_deadline'  ? '⏰ Sắp hạn' :
                                   n.type?.startsWith('message') ? '💬 Tin nhắn' : '🔔 Chung'}
                                </span>
                              )}
                            </div>
                          )}
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 font-medium">
                            {timeAgo(n.created_at)} trước
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-3 py-2.5 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-[#111827]/50 shrink-0 space-y-2">
              {/* Enable Push Button compact */}
              <EnablePushButton variant="compact" />

              <button
                onPointerDown={() => { setIsOpen(false); navigate('/notifications'); }}
                className="w-full text-center text-[12px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors py-1 touch-manipulation"
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
