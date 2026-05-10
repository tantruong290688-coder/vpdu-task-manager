import { X, CheckCircle2, Users, Download, Trash2, ChevronUp } from 'lucide-react';

export default function BulkActionToolbar({ 
  selectedCount, 
  onClear, 
  onStatusChange, 
  onExport, 
  onDelete 
}) {
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
          <div className="relative group">
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-slate-700 transition-colors text-[13px] font-bold">
              <CheckCircle2 size={16} className="text-green-400" />
              Đổi trạng thái
              <ChevronUp size={14} className="opacity-50" />
            </button>
            <div className="absolute bottom-full mb-2 left-0 hidden group-hover:block bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden min-w-[160px]">
              <button onClick={() => onStatusChange('pending')} className="w-full text-left px-4 py-2 text-[12px] font-bold hover:bg-slate-700 transition-colors">Chờ xử lý</button>
              <button onClick={() => onStatusChange('in_progress')} className="w-full text-left px-4 py-2 text-[12px] font-bold hover:bg-slate-700 transition-colors">Đang thực hiện</button>
              <button onClick={() => onStatusChange('completed')} className="w-full text-left px-4 py-2 text-[12px] font-bold hover:bg-slate-700 transition-colors">Hoàn thành</button>
            </div>
          </div>

          {/* Change Collaborators (Placeholder for now) */}
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
