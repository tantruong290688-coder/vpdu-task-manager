// ═══════════════════════════════════════════════════════════
// Page: NotificationsPage – /notifications
// Trang thông báo đầy đủ với filter, phân trang, mark-read
// ═══════════════════════════════════════════════════════════
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellOff, CheckCheck, Filter, AlertTriangle, MessageSquare, ClipboardList, RefreshCw } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import EnablePushButton from '../components/Notifications/EnablePushButton';

const FILTERS = [
  { key: 'all',     label: 'Tất cả',   icon: Bell },
  { key: 'unread',  label: 'Chưa đọc', icon: BellOff },
  { key: 'task',    label: 'Nhiệm vụ', icon: ClipboardList },
  { key: 'message', label: 'Tin nhắn', icon: MessageSquare },
  { key: 'overdue', label: 'Quá hạn',  icon: AlertTriangle },
];

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'Vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs} giờ trước`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days} ngày trước`;
  return new Date(dateStr).toLocaleDateString('vi-VN');
}

function getTypeIcon(type) {
  if (!type) return '🔔';
  if (type.startsWith('task'))    return '📋';
  if (type.startsWith('message')) return '💬';
  if (type === 'task_overdue')    return '⚠️';
  if (type === 'task_deadline')   return '⏰';
  return '🔔';
}

function getTypeBadgeColor(type) {
  if (!type) return 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400';
  if (type === 'task_assigned')  return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
  if (type === 'task_updated')   return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400';
  if (type === 'task_comment')   return 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400';
  if (type === 'task_overdue')   return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
  if (type === 'task_deadline')  return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';
  if (type.startsWith('message')) return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
  return 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400';
}

function getTypeLabel(type) {
  const labels = {
    task_assigned:  'Nhiệm vụ mới',
    task_updated:   'Cập nhật NV',
    task_comment:   'Bình luận',
    task_overdue:   'Quá hạn',
    task_deadline:  'Sắp hết hạn',
    message_private:'Tin nhắn',
    message_group:  'Nhóm',
    general:        'Chung',
  };
  return labels[type] || 'Thông báo';
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('all');

  const {
    notifications, unreadCount, total,
    loading, error, hasMore,
    fetchNotifications, markAsRead, markAllAsRead,
  } = useNotifications({ filter: activeFilter });

  const handleNotificationClick = async (n) => {
    if (!n.is_read) await markAsRead(n.id);

    // Navigate đến đúng trang
    if (n.related_task_id || n.task_id) {
      const taskId = n.related_task_id || n.task_id;
      const code = n.tasks?.code;
      if (code) {
        navigate(`/all-tasks?search=${code}&open=${taskId}`);
      } else {
        navigate(`/all-tasks?open=${taskId}`);
      }
    } else if (n.related_url) {
      navigate(n.related_url);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-0 sm:px-0 py-4 sm:py-6">

      {/* Page Header */}
      <div className="flex items-center justify-between mb-5 px-4 sm:px-0">
        <div>
          <h1 className="text-[20px] sm:text-[24px] font-extrabold text-slate-800 dark:text-white flex items-center gap-2.5">
            <Bell size={22} className="text-amber-500" />
            Thông báo
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 bg-red-500 text-white text-[11px] font-bold rounded-full">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5">
            Tổng {total} thông báo
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchNotifications}
            className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            title="Tải lại"
          >
            <RefreshCw size={16} />
          </button>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-bold rounded-xl transition-colors shadow-sm"
            >
              <CheckCheck size={14} />
              <span className="hidden sm:inline">Đánh dấu tất cả đã đọc</span>
              <span className="sm:hidden">Đọc hết</span>
            </button>
          )}
        </div>
      </div>

      {/* Push Notification Banner */}
      <div className="px-4 sm:px-0 mb-4">
        <EnablePushButton />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto px-4 sm:px-0 pb-1 no-scrollbar">
        {FILTERS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveFilter(key)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-bold whitespace-nowrap transition-all shrink-0
              ${activeFilter === key
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }
            `}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white dark:bg-[#1e293b] rounded-2xl border border-slate-100 dark:border-slate-700/50 overflow-hidden shadow-sm">

        {/* Loading */}
        {loading && notifications.length === 0 && (
          <div className="p-16 flex flex-col items-center gap-3 text-slate-400 dark:text-slate-500">
            <div className="w-8 h-8 border-[3px] border-blue-200 border-t-blue-500 rounded-full animate-spin" />
            <span className="text-[13px] font-medium">Đang tải thông báo...</span>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="p-10 flex flex-col items-center gap-3 text-red-500">
            <AlertTriangle size={32} className="opacity-60" />
            <p className="text-[13px] font-medium">Lỗi tải thông báo</p>
            <button
              onClick={fetchNotifications}
              className="text-[12px] underline text-blue-600"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && notifications.length === 0 && (
          <div className="p-16 flex flex-col items-center gap-3 text-slate-400 dark:text-slate-500">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <BellOff size={28} className="opacity-50" />
            </div>
            <p className="text-[14px] font-semibold">Không có thông báo</p>
            <p className="text-[12px]">
              {activeFilter === 'unread' ? 'Bạn đã đọc hết thông báo rồi!' : 'Chưa có thông báo nào.'}
            </p>
          </div>
        )}

        {/* List */}
        {!error && notifications.length > 0 && (
          <div className="divide-y divide-slate-50 dark:divide-slate-700/30">
            {notifications.map((n) => {
              const displayTitle = n.title || n.message || 'Thông báo';
              const displayBody  = n.body || (n.title ? n.message : '');
              return (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-4 sm:p-5 cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-800/60 flex gap-3 sm:gap-4 group
                    ${!n.is_read ? 'border-l-[3px] border-blue-500 bg-blue-50/40 dark:bg-blue-950/20' : 'border-l-[3px] border-transparent'}
                  `}
                >
                  {/* Emoji icon */}
                  <div className="text-2xl leading-none mt-0.5 shrink-0">
                    {getTypeIcon(n.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className={`text-[13px] sm:text-[14px] leading-snug break-words font-${n.is_read ? 'medium' : 'semibold'} text-slate-${n.is_read ? '600 dark:text-slate-400' : '800 dark:text-slate-100'}`}>
                          {displayTitle}
                        </p>
                        {displayBody && displayBody !== displayTitle && (
                          <p className="text-[12px] text-slate-500 dark:text-slate-500 mt-1 leading-relaxed line-clamp-2">
                            {displayBody}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {n.type && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${getTypeBadgeColor(n.type)}`}>
                              {getTypeLabel(n.type)}
                            </span>
                          )}
                          {(n.tasks?.code || n.related_task_id) && (
                            <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-md text-[10px] font-bold">
                              {n.tasks?.code || 'Nhiệm vụ'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {!n.is_read && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_5px_rgba(59,130,246,0.5)]" />
                        )}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 font-medium">
                      {timeAgo(n.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Load more */}
        {hasMore && !loading && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-700/50 flex justify-center">
            <button
              onClick={fetchNotifications}
              className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[13px] font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Xem thêm
            </button>
          </div>
        )}

        {/* Loading more */}
        {loading && notifications.length > 0 && (
          <div className="p-4 flex justify-center">
            <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
