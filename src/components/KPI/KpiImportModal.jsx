import { useState, useRef, useCallback } from 'react';
import {
  Upload, FileText, X, AlertTriangle, CheckCircle2,
  Loader2, FolderOpen, FileSpreadsheet, FileScan, Trash2
} from 'lucide-react';

const ALLOWED_EXTS = ['.pdf', '.xls', '.xlsx'];
const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

function FileIcon({ name }) {
  const ext = name?.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return <FileScan size={18} className="text-rose-500" />;
  return <FileSpreadsheet size={18} className="text-emerald-600" />;
}

function FileRow({ file, onRemove }) {
  const sizeMB = (file.size / 1024 / 1024).toFixed(2);
  const isOversized = file.size > MAX_SIZE_BYTES;
  const ext = '.' + (file.name?.split('.').pop()?.toLowerCase() || '');
  const isInvalidType = !ALLOWED_EXTS.includes(ext);

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
      isOversized || isInvalidType
        ? 'bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-700/50'
        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700'
    }`}>
      <FileIcon name={file.name} />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-slate-800 dark:text-white truncate">{file.name}</p>
        <p className="text-[11px] text-slate-400">{sizeMB} MB</p>
        {isOversized && <p className="text-[11px] text-rose-500 font-bold">Vượt quá {MAX_SIZE_MB}MB</p>}
        {isInvalidType && <p className="text-[11px] text-rose-500 font-bold">Định dạng không hỗ trợ (chỉ PDF, XLS, XLSX)</p>}
      </div>
      <button
        onClick={() => onRemove(file.name)}
        className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default function KpiImportModal({
  staffName,
  onClose,
  onUpload,
  isUploading,
  isParsing,
  parseProgress,
}) {
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [periodLabel, setPeriodLabel] = useState('');
  const inputRef = useRef(null);

  const addFiles = useCallback((incoming) => {
    const arr = Array.from(incoming);
    setFiles(prev => {
      const existingNames = new Set(prev.map(f => f.name));
      const newFiles = arr.filter(f => !existingNames.has(f.name));
      return [...prev, ...newFiles];
    });
  }, []);

  const removeFile = useCallback((name) => {
    setFiles(prev => prev.filter(f => f.name !== name));
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const validFiles = files.filter(f => {
    const ext = '.' + (f.name?.split('.').pop()?.toLowerCase() || '');
    return ALLOWED_EXTS.includes(ext) && f.size <= MAX_SIZE_BYTES;
  });

  const invalidFiles = files.filter(f => {
    const ext = '.' + (f.name?.split('.').pop()?.toLowerCase() || '');
    return !ALLOWED_EXTS.includes(ext) || f.size > MAX_SIZE_BYTES;
  });

  const handleSubmit = () => {
    if (validFiles.length === 0) return;
    onUpload(validFiles, { periodLabel });
  };

  const isWorking = isUploading || isParsing;

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white dark:bg-[#0f172a] rounded-[32px] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
              <Upload size={20} />
            </div>
            <div>
              <h2 className="text-[16px] font-black text-slate-800 dark:text-white leading-none">Nhập PDF/Excel</h2>
              <p className="text-[12px] text-slate-400 font-bold mt-0.5">Dữ liệu văn bản của: {staffName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isWorking}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 transition-colors disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-8 space-y-6">
          {/* Period label */}
          <div>
            <label className="block text-[12px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">
              Kỳ đánh giá (tùy chọn)
            </label>
            <input
              type="text"
              value={periodLabel}
              onChange={e => setPeriodLabel(e.target.value)}
              placeholder="Ví dụ: 2026-06 hoặc 2026-Q2 hoặc Năm 2026"
              disabled={isWorking}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-2.5 text-[13px] font-bold text-slate-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all disabled:opacity-60"
            />
          </div>

          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => !isWorking && inputRef.current?.click()}
            className={`
              relative border-2 border-dashed rounded-[24px] p-8 text-center cursor-pointer transition-all
              ${isDragging
                ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 scale-[1.01]'
                : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
              }
              ${isWorking ? 'pointer-events-none opacity-60' : ''}
            `}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.xls,.xlsx"
              multiple
              className="hidden"
              onChange={e => addFiles(e.target.files)}
            />
            <div className="flex flex-col items-center gap-3">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDragging ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                <FolderOpen size={28} />
              </div>
              <div>
                <p className="text-[14px] font-black text-slate-700 dark:text-slate-200">
                  {isDragging ? 'Thả file vào đây' : 'Kéo thả hoặc nhấn để chọn file'}
                </p>
                <p className="text-[12px] text-slate-400 font-bold mt-1">
                  PDF, XLS, XLSX • Tối đa {MAX_SIZE_MB}MB/file
                </p>
              </div>
            </div>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {files.map(f => (
                <FileRow key={f.name} file={f} onRemove={removeFile} />
              ))}
            </div>
          )}

          {invalidFiles.length > 0 && (
            <div className="flex items-start gap-2 p-3 bg-rose-50 dark:bg-rose-900/10 rounded-xl border border-rose-100 dark:border-rose-800/50">
              <AlertTriangle size={16} className="text-rose-500 shrink-0 mt-0.5" />
              <p className="text-[12px] text-rose-700 dark:text-rose-400 font-bold">
                {invalidFiles.length} file không hợp lệ sẽ bị bỏ qua (định dạng sai hoặc quá {MAX_SIZE_MB}MB).
              </p>
            </div>
          )}

          {/* Progress */}
          {isParsing && (
            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-700/50">
              <div className="flex items-center gap-3 mb-3">
                <Loader2 size={16} className="text-indigo-600 animate-spin" />
                <p className="text-[13px] font-black text-indigo-800 dark:text-indigo-300">
                  Đang đọc dữ liệu...
                </p>
              </div>
              {parseProgress.total > 0 && (
                <>
                  <p className="text-[12px] text-indigo-600 dark:text-indigo-400 font-bold truncate mb-2">
                    File {parseProgress.current}/{parseProgress.total}: {parseProgress.fileName}
                  </p>
                  <div className="w-full bg-indigo-100 dark:bg-indigo-900/40 rounded-full h-1.5">
                    <div
                      className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${(parseProgress.current / parseProgress.total) * 100}%` }}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {isUploading && !isParsing && (
            <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-700/50">
              <Loader2 size={16} className="text-blue-600 animate-spin" />
              <p className="text-[13px] font-black text-blue-800 dark:text-blue-300">Đang tải file lên máy chủ...</p>
            </div>
          )}

          {/* Format info */}
          <div className="flex items-start gap-2 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-700">
            <FileText size={14} className="text-slate-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Hệ thống tự nhận diện các cột: <strong>Số ký hiệu, Ngày, Loại văn bản, Trích yếu, Người trình, Người ký</strong>.
              File Excel nên có dòng tiêu đề ở hàng đầu tiên.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <button
            onClick={() => setFiles([])}
            disabled={files.length === 0 || isWorking}
            className="flex items-center gap-2 px-4 py-2 text-[12px] font-bold text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-colors disabled:opacity-40"
          >
            <Trash2 size={14} />
            Xóa tất cả
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isWorking}
              className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-[13px] font-bold transition-colors disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              onClick={handleSubmit}
              disabled={validFiles.length === 0 || isWorking}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[13px] font-black shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isWorking ? (
                <><Loader2 size={14} className="animate-spin" /> Đang xử lý...</>
              ) : (
                <><Upload size={14} /> Upload {validFiles.length > 0 ? `(${validFiles.length} file)` : ''}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
