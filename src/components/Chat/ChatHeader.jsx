import { useMessage } from '../../context/MessageContext';
import { useAuth } from '../../context/AuthContext';
import { X, Minus, Search, ArrowLeft, Users } from 'lucide-react';

export default function ChatHeader({ activeUser, activeRoom, onBack }) {
  const { closeChat, minimizeChat } = useMessage();
  const { onlineUsers } = useAuth();

  const isOnline = activeUser && !!onlineUsers[activeUser.id];

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/50 shrink-0 select-none pt-[calc(0.75rem+env(safe-area-inset-top))] sm:pt-3">
      <div className="flex items-center gap-3 overflow-hidden">
        {/* Nút quay lại – hiện trên mọi thiết bị mobile khi đang trong cuộc hội thoại */}
        {(activeUser || activeRoom) && (
          <button
            onPointerDown={(e) => { e.stopPropagation(); onBack(); }}
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 active:bg-slate-200 dark:active:bg-slate-700 transition-colors touch-manipulation sm:hidden"
            aria-label="Quay lại"
          >
            <ArrowLeft size={20} />
          </button>
        )}

        <div className="relative shrink-0">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm bg-gradient-to-br ${
            activeRoom ? 'from-amber-400 to-orange-600' : 'from-blue-500 to-indigo-600'
          }`}>
            {activeRoom ? (
              <Users size={20} />
            ) : (
              (activeUser?.full_name || activeUser?.email || '?').charAt(0).toUpperCase()
            )}
          </div>
          {activeUser && isOnline && (
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-slate-900 rounded-full"></span>
          )}
        </div>

        <div className="overflow-hidden">
          <h3 className="font-bold text-[15px] text-slate-800 dark:text-white leading-tight truncate">
            {activeRoom ? activeRoom.name : (activeUser?.full_name || 'Người dùng')}
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
            {activeRoom ? 'Nhóm hội ý' : (isOnline ? 'Đang hoạt động' : 'Ngoại tuyến')}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-0.5">
        <button
          onPointerDown={(e) => { e.stopPropagation(); }}
          className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors touch-manipulation"
          aria-label="Tìm kiếm"
        >
          <Search size={18} />
        </button>
        <button
          onPointerDown={(e) => { e.stopPropagation(); minimizeChat(); }}
          className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors hidden sm:flex touch-manipulation"
          aria-label="Thu nhỏ"
        >
          <Minus size={18} />
        </button>
        <button
          onPointerDown={(e) => { e.stopPropagation(); closeChat(); }}
          className="p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors touch-manipulation"
          aria-label="Đóng chat"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
