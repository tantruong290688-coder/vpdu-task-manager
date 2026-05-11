import { useState, useRef, useEffect } from 'react';
import { X, CheckCircle2, Users, Download, Trash2, ChevronUp } from 'lucide-react';

export default function BulkActionToolbar({ 
  selectedCount, 
  onClear, 
  onStatusChange, 
  onExport, 
  onDelete 
}) {
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsStatusOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="bg-slate-900 dark:bg-slate-800 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-6 border border-slate-700/50">
        <div className="flex items-center gap-3 border-r border-slate-700 pr-6">
          <button 
            onClick={onClear}
            className="w-6 h-6 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center transition-colors"
          >
            <X size={14} />
          </button>
          <span className="text-[14px] font-black tracking-tight">
            Đã chọn <span className="text-blue-400">{selectedCount}</span> nhiệm vụ
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Change Status */}
          <div className="relative" ref={dropdownRef}>
            <button 
              onClick={() => setIsStatusOpen(!isStatusOpen)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-colors text-[13px] font-bold ${isStatusOpen ? 'bg-slate-700 ring-2 ring-indigo-500/50' : 'hover:bg-slate-700'}`}
            >
              <CheckCircle2 size={16} className="text-green-400" />
              Đổi trạng thái
              <ChevronUp size={14} className={`opacity-50 transition-transform duration-200 ${isStatusOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isStatusOpen && (
              <div className="absolute bottom-full mb-3 left-0 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden min-w-[180px] animate-in zoom-in-95 slide-in-from-bottom-2 duration-200">
                <div className="p-1.5 space-y-1">
                  {[
                    { id: 'pending', label: 'Chờ xử lý', color: 'text-slate-400' },
                    { id: 'in_progress', label: 'Đang thực hiện', color: 'text-blue-400' },
                    { id: 'completed', label: 'Hoàn thành', color: 'text-emerald-400' }
                  ].map((status) => (
                    <button 
                      key={status.id}
                      onClick={() => {
                        onStatusChange(status.id);
                        setIsStatusOpen(false);
                      }} 
                      className="w-full text-left px-4 py-2.5 text-[12.5px] font-black hover:bg-slate-700 rounded-lg transition-colors flex items-center justify-between group"
                    >
                      <span>{status.label}</span>
                      <div className={`w-1.5 h-1.5 rounded-full ${status.color.replace('text', 'bg')} opacity-0 group-hover:opacity-100 transition-opacity`} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Change Collaborators (Placeholder) */}
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-slate-700 transition-colors text-[13px] font-bold">
            <Users size={16} className="text-blue-400" />
            Phối hợp
          </button>

          {/* Export */}
          <button 
            onClick={onExport}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-slate-700 transition-colors text-[13px] font-bold"
          >
            <Download size={16} className="text-amber-400" />
            Xuất Excel
          </button>

          {/* Delete */}
          <button 
            onClick={onDelete}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-red-500/20 text-red-400 transition-colors text-[13px] font-bold"
          >
            <Trash2 size={16} />
            Xóa
          </button>
        </div>
      </div>
    </div>
  );
}
