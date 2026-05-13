import { Check, AlertCircle } from 'lucide-react';

export function StatusBadge({ status, dueDate, evaluationScore }) {
  const today = new Date();
  const todayDateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const isOverdue = dueDate && dueDate < todayDateStr && status !== 'completed' && evaluationScore === null;
  const map = {
    pending:     { label: 'Chờ xử lý',     cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/40' },
    in_progress: { label: 'Đang TH',        cls: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/40' },
    completed:   { label: 'Hoàn thành',    cls: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/40' },
    overdue:     { label: 'Quá hạn',       cls: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/40' },
  };
  const effective = isOverdue && status !== 'completed' ? 'overdue' : (status || 'pending');
  const info = map[effective] || map.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md border ${info.cls} whitespace-nowrap`}>
      {effective === 'completed' && <Check size={9} />}
      {effective === 'overdue' && <AlertCircle size={9} />}
      {info.label}
    </span>
  );
}

export function PriorityBadge({ priority }) {
  const map = {
    high:   { label: 'Cao',  cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    normal: { label: 'TB',   cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' },
    low:    { label: 'Thấp', cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' },
  };
  const info = map[priority] || map.normal;
  return (
    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md whitespace-nowrap ${info.cls}`}>
      {info.label}
    </span>
  );
}

export function ScoreBadge({ score, rank, showScore = true }) {
  const RANK_COLOR = {
    'Hoàn thành xuất sắc': 'text-purple-700 bg-purple-50 dark:bg-purple-900/20 dark:text-purple-400',
    'Hoàn thành tốt': 'text-blue-700 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400',
    'Hoàn thành': 'text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400',
    'Chưa hoàn thành': 'text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400',
  };
  return (
    <div className="flex flex-col items-center gap-1">
      {showScore && <span className="text-[13px] font-black text-blue-600 dark:text-blue-400">{score}</span>}
      {rank && (
        <span className={`px-1.5 py-0.5 text-[9px] font-black rounded-md whitespace-nowrap ${RANK_COLOR[rank] || ''}`}>{rank}</span>
      )}
    </div>
  );
}

export function EvaluationStatusBadge({ task, showScore = true }) {
  if (task.status !== 'completed') return <span className="text-slate-300 dark:text-slate-700">—</span>;

  // Nếu đã chốt điểm chính thức (Admin đã chốt)
  const isFinalized = task.evaluation_score !== null;
  const hasCollabs = task.task_collaborators?.length > 0;
  
  if (isFinalized) {
    return <ScoreBadge score={task.evaluation_score} rank={task.evaluation_rank} showScore={showScore} />;
  }

  // Logic thô để xác định bước hiện tại (có thể tinh chỉnh thêm khi join data)
  // Giả sử có một trường status_đánh_giá được tính toán từ DB hoặc hook
  const evalStatus = task.evaluation_status || 'waiting_self'; 

  const statusMap = {
    waiting_self: { label: 'Chờ tự đề xuất', cls: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700' },
    waiting_main: { label: 'Chờ chính ĐG', cls: 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/40' },
    waiting_admin: { label: 'Chờ Admin chốt', cls: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/40' },
    need_revision: { label: 'Yêu cầu bổ sung', cls: 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/40' },
  };

  const info = statusMap[evalStatus] || statusMap.waiting_self;

  return (
    <div className="flex flex-col items-center gap-1">
       <span className={`text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded border ${info.cls}`}>
         {info.label}
       </span>
       {hasCollabs && (
         <span className="text-[8px] font-bold text-slate-400 italic">
           {task.eval_progress_text || (hasCollabs ? 'Đang thực hiện' : '')}
         </span>
       )}
    </div>
  );
}
