import React, { memo, useCallback } from 'react';
import { AlertCircle, ChevronRight, Flag, Clock } from 'lucide-react';
import { getTaskRisk } from '../../utils/taskAnalytics';
import { useNavigate } from 'react-router-dom';

const RiskTasksWidget = memo(function RiskTasksWidget({ tasks, profile }) {
  const navigate = useNavigate();
const handleNavigate = useCallback((taskId) => navigate(`/all-tasks?open=${taskId}`), [navigate]);
  
  // Lọc các task có rủi ro cao
  const riskTasks = tasks
    .map(t => ({ ...t, risk: getTaskRisk(t) }))
    .filter(t => t.risk.isRisk)
    .sort((a, b) => b.risk.percentTime - a.risk.percentTime);

  if (riskTasks.length === 0) return null;

  return (
    <div className="bg-white dark:bg-[#111827] rounded-[28px] border border-red-100 dark:border-red-900/30 shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="bg-red-50 dark:bg-red-900/20 px-4 md:px-6 py-3 md:py-4 border-b border-red-100 dark:border-red-900/30 flex items-center justify-between">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl md:rounded-2xl bg-white dark:bg-red-900/40 flex items-center justify-center text-red-600 shadow-sm">
            <AlertCircle size={18} md:size={20} strokeWidth={2.5} className="animate-pulse" />
          </div>
          <div>
            <h3 className="text-[13px] md:text-[15px] font-black text-red-800 dark:text-red-400 uppercase tracking-tight leading-none mb-1">Cảnh báo rủi ro cao</h3>
            <p className="text-[10px] md:text-[11px] text-red-600 dark:text-red-500 font-bold opacity-80 uppercase tracking-widest leading-none">Cần đôn đốc xử lý gấp</p>
          </div>
        </div>
        <span className="bg-red-600 text-white text-[10px] md:text-[11px] font-black px-2 py-0.5 md:py-1 rounded-full shadow-sm shrink-0">
          {riskTasks.length} VIỆC
        </span>
      </div>

      <div className="p-2 md:p-4 space-y-1 md:space-y-2">
        {riskTasks.slice(0, 3).map(task => (
          <button
            key={task.id}
            onClick={() => handleNavigate(task.id)}
            className="w-full flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-2xl hover:bg-red-50/50 dark:hover:bg-red-900/10 transition-all border border-transparent hover:border-red-100 dark:hover:border-red-900/30 group"
          >
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-slate-50 dark:bg-slate-800 flex flex-col items-center justify-center shrink-0 border border-slate-100 dark:border-slate-700">
               <span className="text-[8px] md:text-[10px] font-black text-slate-400 leading-none mb-0.5">TIẾN ĐỘ</span>
               <span className="text-[13px] md:text-[15px] font-black text-red-600 leading-none">{task.progress}%</span>
            </div>

            <div className="flex-1 text-left min-w-0">
              <p className="text-[13px] md:text-[14px] font-black text-slate-800 dark:text-white truncate group-hover:text-red-700 transition-colors">
                {task.title}
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5 text-[10px] md:text-[11px] font-bold text-slate-500">
                <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 font-mono leading-none">{task.code}</span>
                <span className="flex items-center gap-1 text-red-600 leading-none">
                  <Clock size={10} />
                  Trôi qua {task.risk.percentTime}%
                </span>
              </div>
            </div>

            <ChevronRight size={16} className="text-slate-300 group-hover:text-red-400 transition-all group-hover:translate-x-1 shrink-0" />
          </button>
        ))}
        
        {riskTasks.length > 3 && (
          <button 
            onClick={() => navigate('/all-tasks')}
            className="w-full py-2 text-[11px] font-black text-red-600 hover:text-red-700 transition-colors uppercase tracking-widest"
          >
            Xem tất cả rủi ro ({riskTasks.length})
          </button>
        )}
      </div>
    </div>
  );
});
export default RiskTasksWidget;
