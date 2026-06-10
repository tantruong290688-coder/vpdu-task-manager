import { useMessage } from '../../context/MessageContext';
import { useAuth } from '../../context/AuthContext';
import { X, Minus, Search, ArrowLeft, Users, Maximize2, Minimize2 } from 'lucide-react';
import { getUserAvatar } from '../../utils/avatarHelper';

export default function ChatHeader({ activeUser, activeRoom, onBack, onClose, isWideMode, onToggleWide }) {
  const { closeChat, minimizeChat } = useMessage();
  const { onlineUsers } = useAuth();

  const isOnline = activeUser && !!onlineUsers[activeUser.id];

  return (
    <div className="flex items-center justify-between px-4 py-4 sm:py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/50 shrink-0 select-none pt-[calc(1rem+env(safe-area-inset-top))] sm:pt-3">
      <div className="flex items-center gap-3 overflow-hidden">
        {/* Nút quay lại – hiện trên mobile khi đang trong cuộc hội thoại, HOẶC trên desktop khi KHÔNG ở chế độ Wide Mode */}
        {(activeUser || activeRoom) && (
          <button
            onPointerDown={(e) => { e.stopPropagation(); onBack(); }}
            className={`flex-shrink-0 w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 active:bg-slate-200 dark:active:bg-slate-700 transition-colors touch-manipulation ${isWideMode ? 'sm:hidden' : 'sm:flex'}`}
            aria-label="Quay lại"
          >
            <ArrowLeft size={20} />
          </button>
        )}

        <div className="relative shrink-0">
          {activeRoom ? (
            <div className="w-12 h-12 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm bg-gradient-to-br from-amber-400 to-orange-600">
              <Users size={20} />
            </div>
          ) : (
            <img 
              src={getUserAvatar(activeUser)} 
              alt={activeUser?.full_name || 'Avatar'}
              className="w-12 h-12 sm:w-10 sm:h-10 rounded-full object-cover shadow-sm border border-slate-100 dark:border-slate-800"
              onError={(e) => {
                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(activeUser?.full_name || 'User')}&background=4f46e5&color=fff`;
              }}
            />
          )}
          {activeUser && isOnline && (
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-slate-900 rounded-full"></span>
          )}
        </div>

        <div className="overflow-hidden">
          <h3 className="font-bold text-[17px] sm:text-[15px] text-slate-800 dark:text-white leading-tight truncate">
            {activeRoom ? activeRoom.name : (activeUser?.full_name || 'Người dùng')}
          </h3>
          <p className="text-[13px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
            {activeRoom ? 'Nhóm hội ý' : (isOnline ? 'Đang hoạt động' : 'Ngoại tuyến')}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-0.5">
        <button
          onPointerDown={(e) => { e.stopPropagation(); }}
          className="p-3 sm:p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors touch-manipulation"
          aria-label="Tìm kiếm"
        >
          <Search size={18} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleWide && onToggleWide(); }}
          className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors hidden sm:flex touch-manipulation active:scale-95"
          aria-label={isWideMode ? "Thu hẹp" : "Mở rộng"}
        >
          {isWideMode ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); minimizeChat(); }}
          className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors hidden sm:flex touch-manipulation"
          aria-label="Thu nhỏ"
        >
          <Minus size={18} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onClose ? onClose() : closeChat(); }}
          className="p-3 sm:p-2 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm active:scale-90"
          aria-label="Đóng chat"
        >
          <X size={20} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}
