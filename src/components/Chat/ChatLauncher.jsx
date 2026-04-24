import { useMessage } from '../../context/MessageContext';
import { MessageCircle, X, ChevronUp } from 'lucide-react';

export default function ChatLauncher() {
  const { unreadCount, isChatOpen, isMinimized, toggleChat, maximizeChat } = useMessage();

  if (isChatOpen && !isMinimized) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-3">
      {/* Tooltip or Label could go here */}
      
      <button
        onClick={isMinimized ? maximizeChat : toggleChat}
        className={`
          group relative flex items-center justify-center w-14 h-14 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-110 active:scale-95
          ${isMinimized 
            ? 'bg-white dark:bg-slate-800 text-blue-600 border border-slate-100 dark:border-slate-700' 
            : 'bg-blue-600 text-white hover:bg-blue-700'}
        `}
        title={isMinimized ? "Mở lại khung chat" : "Nhắn tin"}
      >
        {isMinimized ? (
          <ChevronUp size={28} className="animate-bounce-subtle" />
        ) : (
          <MessageCircle size={28} />
        )}
        
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-[11px] font-bold text-white ring-2 ring-white dark:ring-slate-900 animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
        
        {/* Glow effect */}
        {!isMinimized && (
          <span className="absolute inset-0 rounded-full bg-blue-400 opacity-0 group-hover:opacity-20 group-hover:animate-ping pointer-events-none"></span>
        )}
      </button>
    </div>
  );
}
