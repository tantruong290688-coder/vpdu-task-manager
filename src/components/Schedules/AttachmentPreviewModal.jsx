import React from 'react';
import { X, Download, AlertTriangle } from 'lucide-react';

export default function AttachmentPreviewModal({ isOpen, onClose, attachment, signedUrl, loading, error }) {
  if (!isOpen) return null;

  const isPDF = attachment?.file_name?.toLowerCase().endsWith('.pdf') || attachment?.mime_type === 'application/pdf';
  const isImage = attachment?.file_name?.match(/\.(jpg|jpeg|png|webp|gif)$/i) || attachment?.mime_type?.startsWith('image/');
  const isWord = attachment?.file_name?.match(/\.(doc|docx)$/i);

  const handleDownload = () => {
    if (!signedUrl) return;
    const a = document.createElement('a');
    a.href = signedUrl;
    a.download = attachment?.file_name || 'download';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Nền mờ */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      ></div>

      {/* Box modal */}
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl w-full max-w-[90vw] md:max-w-[80vw] h-[90vh] md:h-[80vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex flex-col">
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 truncate pr-4 max-w-[70vw]">
              {attachment?.file_name || 'Xem tệp đính kèm'}
            </h3>
            {attachment?.file_size && (
              <span className="text-xs text-slate-500">
                {(attachment.file_size / 1024 / 1024).toFixed(2)} MB
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!loading && !error && signedUrl && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 rounded-lg transition-colors text-sm font-medium"
              >
                <Download size={16} />
                <span className="hidden sm:inline">Tải xuống</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Nội dung */}
        <div className="flex-1 overflow-hidden relative bg-slate-100/50 dark:bg-slate-950 flex items-center justify-center p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center text-slate-500">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p>Đang tải dữ liệu tệp...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center text-center max-w-md p-6 bg-rose-50 dark:bg-rose-900/20 rounded-2xl border border-rose-100 dark:border-rose-800/30">
              <AlertTriangle className="w-12 h-12 text-rose-500 mb-3" />
              <p className="text-rose-600 dark:text-rose-400 font-medium">{error}</p>
            </div>
          ) : !signedUrl ? (
            <div className="text-slate-500">Không tìm thấy đường dẫn tệp.</div>
          ) : (
            <>
              {isPDF && (
                <iframe
                  src={`${signedUrl}#view=FitH`}
                  title={attachment?.file_name}
                  className="w-full h-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white"
                />
              )}
              
              {isImage && (
                <img
                  src={signedUrl}
                  alt={attachment?.file_name}
                  className="max-w-full max-h-[100%] object-contain rounded-lg shadow-sm"
                />
              )}

              {isWord && (
                <div className="flex flex-col items-center justify-center text-center max-w-md p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                  <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-4">
                    <Download size={32} />
                  </div>
                  <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Định dạng chưa hỗ trợ xem nhanh</h4>
                  <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">
                    Định dạng Word (.doc, .docx) hiện chưa hỗ trợ xem trực tiếp trên trình duyệt. Vui lòng tải tệp xuống máy để xem nội dung.
                  </p>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-all font-medium shadow-sm"
                  >
                    <Download size={18} />
                    Tải xuống ngay
                  </button>
                </div>
              )}

              {!isPDF && !isImage && !isWord && (
                <div className="flex flex-col items-center justify-center text-center">
                  <AlertTriangle className="w-12 h-12 text-slate-400 mb-3" />
                  <p className="text-slate-600 dark:text-slate-300 font-medium mb-4">Định dạng tệp này không hỗ trợ xem trước.</p>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-5 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    <Download size={18} />
                    Tải tệp xuống
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
