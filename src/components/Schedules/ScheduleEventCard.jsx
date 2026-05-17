import React from 'react';
import { User, MapPin, CheckSquare, Plus } from 'lucide-react';

export default function ScheduleEventCard({ item, onClick, onAddTask }) {
  const isHoliday = item.type === 'holiday' || (item.content || '').toLowerCase().includes('nghỉ');
  
  if (isHoliday) {
    return (
      <div 
        onClick={() => onClick(item)}
        className="group relative bg-slate-100/50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700/50 p-2.5 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-all overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-1 h-full bg-slate-300 dark:bg-slate-600 rounded-l-xl"></div>
        <div className="text-slate-500 dark:text-slate-400 font-medium text-[13px] text-center italic">
          {item.content || 'Nghỉ'}
        </div>
      </div>
    );
  }

  return (
    <div 
      onClick={() => onClick(item)}
      className="group relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl shadow-sm hover:shadow-md cursor-pointer hover:border-blue-300 dark:hover:border-blue-600/50 transition-all flex flex-col gap-1.5"
    >
      <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 dark:bg-blue-600 rounded-l-xl"></div>
      
      {/* Time & Content */}
      <div className="flex flex-col gap-0.5 pl-1.5">
        {item.time && (
          <span className="text-rose-600 dark:text-rose-400 font-bold text-[12px] tracking-tight">
            {item.time}
          </span>
        )}
        <span className="text-slate-800 dark:text-slate-200 font-semibold text-[13px] leading-snug line-clamp-3">
          {item.content || '(Chưa nhập nội dung)'}
        </span>
      </div>

      {/* Meta info */}
      <div className="flex flex-col gap-1 mt-1 pl-1.5">
        {item.host && (
          <div className="flex items-start gap-1 text-slate-600 dark:text-slate-400 text-[11px]">
            <User className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span className="line-clamp-2">{item.host}</span>
          </div>
        )}
        {item.location && (
          <div className="flex items-start gap-1 text-slate-500 dark:text-slate-500 text-[11px]">
            <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span className="line-clamp-1">{item.location}</span>
          </div>
        )}
      </div>

      {/* Task Badge or Add Task Button */}
      {item.type === 'meeting' && (
        <div className="absolute top-2 right-2 flex items-center justify-center">
          {item.is_task_created ? (
            <span className="text-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 p-1 rounded-md" title="Đã có nhiệm vụ phục vụ">
              <CheckSquare size={14} strokeWidth={3} />
            </span>
          ) : (
            onAddTask && (
              <button 
                onClick={(e) => { e.stopPropagation(); onAddTask(item); }}
                className="opacity-0 group-hover:opacity-100 p-1 text-white bg-blue-500 hover:bg-blue-600 rounded-md transition-all shadow-sm"
                title="Tạo nhiệm vụ phục vụ"
              >
                <Plus size={14} strokeWidth={3} />
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
