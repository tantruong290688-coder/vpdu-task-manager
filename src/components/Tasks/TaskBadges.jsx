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

export function ScoreBadge({ score, rank }) {
  const RANK_COLOR = {
    'Xuất sắc': 'text-purple-700 bg-purple-50 dark:bg-purple-900/20 dark:text-purple-400',
    'Tốt': 'text-blue-700 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400',
    'Hoàn thành': 'text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400',
    'Không hoàn thành': 'text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400',
  };
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[13px] font-black text-blue-600 dark:text-blue-400">{score}</span>
      {rank && (
        <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md ${RANK_COLOR[rank] || ''}`}>{rank}</span>
      )}
    </div>
  );
}
