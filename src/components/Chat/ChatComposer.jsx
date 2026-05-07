import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Smile, Loader2, X, Camera, Image as ImageIcon, FolderOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import AttachmentFileIcon from './AttachmentFileIcon';
import { getFileTypeInfo } from '../../utils/fileType';
import { validateAndCompressFile } from '../../utils/imageCompressor';

export default function ChatComposer({ onSend, sending, replyTo, onCancelReply }) {
  const [text, setText] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const attachMenuRef = useRef(null);

  // Auto-expand textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [text]);

  // Close attach menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target)) {
        setShowAttachMenu(false);
      }
    };
    if (showAttachMenu) {
      document.addEventListener('pointerdown', handleClickOutside);
    }
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [showAttachMenu]);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setShowAttachMenu(false);

    const toastId = toast.loading('Đang kiểm tra và xử lý file...');

    const { isValid, file: processedFile, error } = await validateAndCompressFile(file);

    if (!isValid) {
      toast.error(error, { id: toastId });
      e.target.value = '';
      return;
    }

    toast.dismiss(toastId);

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

    setSelectedFile(processedFile);
    
    if (processedFile.type.startsWith('image/')) {
      const url = URL.createObjectURL(processedFile);
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
    [fileInputRef, cameraInputRef, imageInputRef].forEach(ref => {
      if (ref.current) ref.current.value = '';
    });
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

  const previewFileInfo = selectedFile ? getFileTypeInfo(selectedFile.name, selectedFile.type) : null;

  const attachOptions = [
    {
      icon: Camera,
      label: 'Chụp ảnh',
      color: 'text-green-500 bg-green-50 dark:bg-green-900/30',
      action: () => cameraInputRef.current?.click(),
    },
    {
      icon: ImageIcon,
      label: 'Hình ảnh',
      color: 'text-purple-500 bg-purple-50 dark:bg-purple-900/30',
      action: () => imageInputRef.current?.click(),
    },
    {
      icon: FolderOpen,
      label: 'Tài liệu',
      color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/30',
      action: () => fileInputRef.current?.click(),
    },
  ];

  return (
    <div className="px-3 pt-4 sm:pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0 relative">
      {replyTo && (
        <div className="mb-3 p-2 bg-slate-50 dark:bg-slate-800/80 rounded-lg border-l-4 border-blue-500 flex justify-between items-start animate-in slide-in-from-bottom-2">
          <div className="overflow-hidden">
            <span className="text-[12px] sm:text-[10px] font-bold text-blue-600 uppercase block mb-0.5">Đang trả lời {replyTo.sender_name}</span>
            <p className="text-[14px] sm:text-[12px] text-slate-600 dark:text-slate-400 truncate">{replyTo.content}</p>
          </div>
          <button
            onPointerDown={onCancelReply}
            className="p-1 text-slate-400 hover:text-slate-600 transition-colors touch-manipulation"
          >
            <Send size={14} className="rotate-45" />
          </button>
        </div>
      )}

      {selectedFile && previewFileInfo && (
        <div className="mb-3 p-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 inline-flex items-center gap-3 relative animate-in fade-in slide-in-from-bottom-2">
          {previewUrl ? (
            <img src={previewUrl} alt="Preview" className="h-11 w-11 object-cover rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" />
          ) : (
            <AttachmentFileIcon fileInfo={previewFileInfo} className="w-11 h-11" textClassName="text-base" />
          )}
          <div className="flex-1 pr-6 max-w-[200px]">
            <p className="text-base sm:text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{selectedFile.name}</p>
            <p className="text-sm sm:text-xs text-slate-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
          <button 
            type="button" 
            onClick={removeFile}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-2 sm:p-1 hover:bg-red-600 transition-colors shadow-sm"
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

        <div className="flex items-center mb-1 relative" ref={attachMenuRef}>
          {/* Hidden file inputs */}
          <input 
            type="file" 
            ref={cameraInputRef} 
            onChange={handleFileChange}
            className="hidden" 
            accept="image/*"
            capture="environment"
          />
          <input 
            type="file" 
            ref={imageInputRef} 
            onChange={handleFileChange}
            className="hidden" 
            accept="image/jpeg,image/png,image/webp"
          />
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange}
            className="hidden" 
            accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          />

          {/* Attach menu popup */}
          {showAttachMenu && (
            <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 duration-200 min-w-[150px]">
              {attachOptions.map((opt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => { opt.action(); setShowAttachMenu(false); }}
                  className="flex items-center gap-4 w-full px-5 py-4 sm:py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors touch-manipulation active:bg-slate-100 dark:active:bg-slate-700"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${opt.color}`}>
                    <opt.icon size={16} />
                  </div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{opt.label}</span>
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowAttachMenu(prev => !prev)}
            disabled={sending}
            className={`p-3 sm:p-2.5 rounded-full transition-colors touch-manipulation disabled:opacity-50 ${
              showAttachMenu
                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-500'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-blue-500'
            }`}
          >
            <Paperclip size={24} />
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
            className="w-full bg-transparent border-none focus:ring-0 py-3.5 px-4 sm:py-2.5 text-[16px] sm:text-[14px] text-slate-800 dark:text-slate-200 resize-none max-h-[120px] scrollbar-hide disabled:opacity-50"
          />
          <button
            type="button"
            disabled={sending}
            className="absolute right-2 bottom-2 sm:bottom-1.5 p-2.5 sm:p-1.5 text-slate-400 hover:text-amber-500 transition-colors touch-manipulation disabled:opacity-50"
          >
            <Smile size={20} />
          </button>
        </div>

        <button
          type="submit"
          disabled={(!text.trim() && !selectedFile) || sending}
          className={`
            mb-0.5 w-12 h-12 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all shadow-sm touch-manipulation
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
