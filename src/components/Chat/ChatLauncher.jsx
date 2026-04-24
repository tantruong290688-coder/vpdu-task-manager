import { useState, useEffect, useRef } from 'react';
import { useMessage } from '../../context/MessageContext';
import { MessageCircle, X, ChevronUp } from 'lucide-react';

export default function ChatLauncher() {
  const { unreadCount, isChatOpen, isMinimized, toggleChat, maximizeChat } = useMessage();
  const [position, setPosition] = useState({ x: window.innerWidth - 80, y: 15 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const launcherRef = useRef(null);

  // Handle dragging
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      
      const newX = e.clientX - dragStartPos.current.x;
      const newY = e.clientY - dragStartPos.current.y;
      
      // Keep within bounds
      const boundedX = Math.max(10, Math.min(window.innerWidth - 60, newX));
      const boundedY = Math.max(10, Math.min(window.innerHeight - 60, newY));
      
      setPosition({ x: boundedX, y: boundedY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.userSelect = 'auto';
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const onMouseDown = (e) => {
    if (isChatOpen && !isMinimized) return;
    setIsDragging(true);
    dragStartPos.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  if (isChatOpen && !isMinimized) return null;

  return (
    <div 
      ref={launcherRef}
      style={{ 
        left: `${position.x}px`, 
        top: `${position.y}px`,
        position: 'fixed',
        zIndex: 1000,
        touchAction: 'none'
      }}
      onMouseDown={onMouseDown}
      className="flex flex-col items-end group"
    >
      <button
        onClick={() => {
          if (!isDragging) {
            isMinimized ? maximizeChat() : toggleChat();
          }
        }}
        className={`
          relative flex items-center justify-center w-10 h-10 rounded-full shadow-lg transition-all duration-300 transform hover:scale-110 active:scale-95 cursor-move
          ${isMinimized 
            ? 'bg-white dark:bg-slate-800 text-blue-600 border border-slate-100 dark:border-slate-700' 
            : 'bg-blue-600 text-white hover:bg-blue-700'}
        `}
        title={isMinimized ? "Mở lại khung chat" : "Nhắn tin (Kéo để di chuyển)"}
      >
        {isMinimized ? (
          <ChevronUp size={20} className="animate-bounce-subtle" />
        ) : (
          <MessageCircle size={20} />
        )}
        
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-900">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}
