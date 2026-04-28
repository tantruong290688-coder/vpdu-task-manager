import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Smile, Loader2, X, FileText, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ChatComposer({ onSend, sending, replyTo, onCancelReply }) {
  const [text, setText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto-expand textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Dung lượng tệp không được vượt quá 2 MB.');
      e.target.value = '';
      return;
    }

    // Check allowed types
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/webp', 'image/jpg',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      toast.error('Định dạng tệp không được hỗ trợ.');
      e.target.value = '';
      return;
    }

    setSelectedFile(file);
    
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if ((!text.trim() && !selectedFile) || sending) return;
    onSend(text.trim(), selectedFile);
    setText('');
    removeFile();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0 relative">
      {replyTo && (
        <div className="mb-3 p-2 bg-slate-50 dark:bg-slate-800/80 rounded-lg border-l-4 border-blue-500 flex justify-between items-start animate-in slide-in-from-bottom-2">
          <div className="overflow-hidden">
            <span className="text-[10px] font-bold text-blue-600 uppercase block mb-0.5">Đang trả lời {replyTo.sender_name}</span>
            <p className="text-[12px] text-slate-600 dark:text-slate-400 truncate">{replyTo.content}</p>
          </div>
          <button
            onPointerDown={onCancelReply}
            className="p-1 text-slate-400 hover:text-slate-600 transition-colors touch-manipulation"
          >
            <Send size={14} className="rotate-45" />
          </button>
        </div>
      )}

      {selectedFile && (
        <div className="mb-3 p-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 inline-flex items-center gap-3 relative animate-in fade-in slide-in-from-bottom-2">
          {previewUrl ? (
            <img src={previewUrl} alt="Preview" className="h-14 w-14 object-cover rounded-lg border border-slate-200 dark:border-slate-700" />
          ) : (
            <div className="h-14 w-14 flex items-center justify-center bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-lg border border-blue-100 dark:border-blue-800">
              <FileText size={24} />
            </div>
          )}
          <div className="flex-1 pr-6 max-w-[200px]">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{selectedFile.name}</p>
            <p className="text-xs text-slate-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
          <button 
            type="button" 
            onClick={removeFile}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors shadow-sm"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-2 relative">
        {sending && (
          <div className="absolute -top-8 left-0 right-0 flex justify-center">
            <div className="bg-blue-500 text-white text-xs py-1 px-3 rounded-full flex items-center gap-2 shadow-sm animate-pulse">
              <Loader2 size={12} className="animate-spin" />
              Đang tải tệp lên...
            </div>
          </div>
        )}

        <div className="flex items-center mb-1 relative">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange}
            className="hidden" 
            accept="image/jpeg,image/png,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            capture="environment"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-blue-500 transition-colors touch-manipulation disabled:opacity-50"
          >
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
            disabled={sending}
            placeholder={replyTo ? "Viết câu trả lời..." : "Nhập tin nhắn..."}
            className="w-full bg-transparent border-none focus:ring-0 py-2.5 px-4 text-[14px] text-slate-800 dark:text-slate-200 resize-none max-h-[120px] scrollbar-hide disabled:opacity-50"
          />
          <button
            type="button"
            disabled={sending}
            className="absolute right-2 bottom-1.5 p-1.5 text-slate-400 hover:text-amber-500 transition-colors touch-manipulation disabled:opacity-50"
          >
            <Smile size={20} />
          </button>
        </div>

        <button
          type="submit"
          disabled={(!text.trim() && !selectedFile) || sending}
          className={`
            mb-0.5 w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm touch-manipulation
            ${(!text.trim() && !selectedFile) || sending
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-400'
              : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'}
          `}
        >
          {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="ml-0.5" />}
        </button>
      </form>
    </div>
  );
}

