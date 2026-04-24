import { useAuth } from '../../context/AuthContext';
import { Check, CheckCheck, FileIcon, Reply, Trash2 } from 'lucide-react';

export default function MessageItem({ message, isMe, showAvatar, showName, repliedMessage, onReply, onDelete }) {
  const formatTime = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`flex flex-col mb-4 ${isMe ? 'items-end' : 'items-start'}`}>
      {showName && !isMe && !message.is_deleted && (
        <span className="text-[11px] font-bold mb-1 ml-10 text-blue-600 dark:text-blue-400 uppercase tracking-wider">
          {message.sender_name || 'Người dùng'}
        </span>
      )}
      
      <div className={`flex gap-2 max-w-[85%] group ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
        {!isMe && (
          <div className="w-8 shrink-0 flex items-end mb-1">
            {showAvatar ? (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold shadow-sm ring-2 ring-white dark:ring-slate-900">
                {(message.sender_name || '?').charAt(0).toUpperCase()}
              </div>
            ) : (
              <div className="w-8" />
            )}
          </div>
        )}

        <div className="flex flex-col relative">
          <div 
            className={`
              px-4 py-2.5 rounded-2xl text-[14px] leading-relaxed shadow-sm transition-all relative
              ${message.is_deleted 
                ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 italic' 
                : isMe 
                  ? 'bg-blue-600 text-white rounded-tr-sm' 
                  : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-tl-sm'}
            `}
          >
            {repliedMessage && !message.is_deleted && (
              <div className={`
                text-[12px] p-2 mb-2 rounded-lg border-l-4 truncate
                ${isMe ? 'bg-blue-700/50 border-blue-400 text-blue-100' : 'bg-slate-100 dark:bg-slate-700 border-slate-400 text-slate-500'}
              `}>
                <span className="font-bold mr-1 block text-[10px] opacity-70">
                  {repliedMessage.sender_id === message.sender_id ? 'Trả lời chính mình' : `Trả lời ${repliedMessage.sender_name || 'ai đó'}`}
                </span>
                {repliedMessage.content}
              </div>
            )}

            {/* Content or File Attachment Placeholder */}
            {message.file_url ? (
              <div className="flex items-center gap-3 p-2 bg-black/5 dark:bg-white/5 rounded-xl border border-black/10 dark:border-white/10">
                <div className="p-2 bg-white dark:bg-slate-700 rounded-lg shadow-sm">
                  <FileIcon size={24} className="text-blue-500" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-medium truncate">{message.file_name || 'Tài liệu đính kèm'}</p>
                  <p className="text-[10px] opacity-60 uppercase">{message.file_size || '0 KB'}</p>
                </div>
              </div>
            ) : (
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            )}
            
            {/* Quick Actions (Hover) */}
            {!message.is_deleted && (
              <div className={`
                absolute top-0 flex gap-1 transition-all opacity-0 group-hover:opacity-100
                ${isMe ? 'right-full mr-2' : 'left-full ml-2'}
              `}>
                <button 
                  onClick={() => onReply(message)}
                  className="p-1.5 rounded-full bg-white dark:bg-slate-800 shadow-md border border-slate-100 dark:border-slate-700 text-slate-500 hover:text-blue-500 hover:scale-110 transition-all"
                >
                  <Reply size={14} />
                </button>
                {(isMe || onDelete) && (
                  <button 
                    onClick={() => onDelete(message.id)}
                    className="p-1.5 rounded-full bg-white dark:bg-slate-800 shadow-md border border-slate-100 dark:border-slate-700 text-slate-500 hover:text-red-500 hover:scale-110 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            )}
          </div>

          <div className={`flex items-center gap-1.5 mt-1 px-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
            <span className="text-[10px] text-slate-400 font-medium">{formatTime(message.created_at)}</span>
            {isMe && !message.is_deleted && (
              message.is_read 
                ? <CheckCheck size={12} className="text-blue-500" /> 
                : <Check size={12} className="text-slate-400" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
