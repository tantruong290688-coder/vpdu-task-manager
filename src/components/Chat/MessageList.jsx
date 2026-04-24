import { useEffect, useRef, useState } from 'react';
import MessageItem from './MessageItem';
import { ChevronDown } from 'lucide-react';

export default function MessageList({ messages, currentUser, onReply, onDelete }) {
  const scrollRef = useRef(null);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const scrollToBottom = (behavior = 'smooth') => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior
      });
    }
  };

  useEffect(() => {
    scrollToBottom('auto');
  }, [messages.length]);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollDown(!isAtBottom);
  };

  return (
    <div className="flex-1 overflow-hidden relative">
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto px-4 py-6 scroll-smooth scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800"
      >
        {messages.map((m, i) => {
          const isMe = m.sender_id === currentUser.id;
          const prevMsg = i > 0 ? messages[i - 1] : null;
          
          // Show avatar if it's the first message from this sender in a sequence
          const showAvatar = !isMe && (!prevMsg || prevMsg.sender_id !== m.sender_id);
          
          // Show name if it's a group chat and first message from sender in a sequence
          const showName = !isMe && (!prevMsg || prevMsg.sender_id !== m.sender_id);

          const repliedMessage = m.reply_to_id ? messages.find(rm => rm.id === m.reply_to_id) : null;

          return (
            <MessageItem
              key={m.id}
              message={m}
              isMe={isMe}
              showAvatar={showAvatar}
              showName={showName}
              repliedMessage={repliedMessage}
              onReply={onReply}
              onDelete={onDelete}
            />
          );
        })}
      </div>

      {showScrollDown && (
        <button 
          onClick={() => scrollToBottom()}
          className="absolute bottom-4 right-4 p-2 bg-white dark:bg-slate-800 rounded-full shadow-lg border border-slate-100 dark:border-slate-700 text-blue-600 animate-bounce"
        >
          <ChevronDown size={20} />
        </button>
      )}
    </div>
  );
}
