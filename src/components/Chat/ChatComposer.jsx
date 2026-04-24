import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Smile, Loader2 } from 'lucide-react';

export default function ChatComposer({ onSend, sending, replyTo, onCancelReply }) {
  const [text, setText] = useState('');
  const textareaRef = useRef(null);

  // Auto-expand textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    onSend(text.trim());
    setText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0">
      {replyTo && (
        <div className="mb-3 p-2 bg-slate-50 dark:bg-slate-800/80 rounded-lg border-l-4 border-blue-500 flex justify-between items-start animate-in slide-in-from-bottom-2">
          <div className="overflow-hidden">
            <span className="text-[10px] font-bold text-blue-600 uppercase block mb-0.5">Đang trả lời {replyTo.sender_name}</span>
            <p className="text-[12px] text-slate-600 dark:text-slate-400 truncate">{replyTo.content}</p>
          </div>
          <button onClick={onCancelReply} className="p-1 text-slate-400 hover:text-slate-600 transition-colors">
            <Send size={14} className="rotate-45" /> {/* Just a placeholder for X if needed */}
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <div className="flex items-center mb-1">
          <button type="button" className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-blue-500 transition-colors">
            <Paperclip size={20} />
          </button>
        </div>

        <div className="flex-1 relative bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all">
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={replyTo ? "Viết câu trả lời..." : "Nhập tin nhắn..."}
            className="w-full bg-transparent border-none focus:ring-0 py-2.5 px-4 text-[14px] text-slate-800 dark:text-slate-200 resize-none max-h-[120px] scrollbar-hide"
          />
          <button type="button" className="absolute right-2 bottom-1.5 p-1.5 text-slate-400 hover:text-amber-500 transition-colors">
            <Smile size={20} />
          </button>
        </div>

        <button
          type="submit"
          disabled={!text.trim() || sending}
          className={`
            mb-0.5 w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm
            ${!text.trim() || sending 
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-400' 
              : 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105 active:scale-95'}
          `}
        >
          {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="ml-0.5" />}
        </button>
      </form>
    </div>
  );
}
