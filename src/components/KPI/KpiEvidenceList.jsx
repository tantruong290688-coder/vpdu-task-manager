import { Star, FileText, CheckCircle2 } from 'lucide-react';
import { ROLE_LABELS, ROLE_COLORS } from '../../services/kpiDocumentService';

export default function KpiEvidenceList({ evidence = [] }) {
  if (!evidence || evidence.length === 0) {
    return (
      <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl">
        <Star size={24} className="text-slate-300 mb-3" />
        <p className="text-[13px] font-bold text-slate-400 text-center">
          Chưa có minh chứng KPI. Hãy chạy phân tích AI để AI gợi ý.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Star size={16} className="text-amber-500" />
        <p className="text-[12px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          AI đề xuất {evidence.length} minh chứng KPI tiêu biểu
        </p>
      </div>

      <div className="space-y-3">
        {evidence.map((item, idx) => {
          const roleType = item.role_type || 'direct_advisor';
          return (
            <div
              key={idx}
              className="p-5 bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 rounded-2xl hover:border-amber-200 dark:hover:border-amber-700/50 transition-colors shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 shrink-0 mt-0.5">
                  <span className="text-[12px] font-black">{idx + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    {item.document_number && (
                      <span className="text-[12px] font-black text-indigo-600 dark:text-indigo-400 font-mono">
                        {item.document_number}
                      </span>
                    )}
                    {item.document_date && (
                      <span className="text-[11px] font-bold text-slate-400">
                        {new Date(item.document_date).toLocaleDateString('vi-VN')}
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${ROLE_COLORS[roleType]}`}>
                      {ROLE_LABELS[roleType] || item.role_label || roleType}
                    </span>
                  </div>

                  {item.summary && (
                    <p className="text-[13px] font-bold text-slate-800 dark:text-white leading-snug mb-2">
                      {item.summary}
                    </p>
                  )}

                  {item.reason && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50/60 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-800/30">
                      <CheckCircle2 size={14} className="text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-[12px] text-amber-800 dark:text-amber-300 font-bold leading-relaxed">
                        {item.reason}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-start gap-2 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-700">
        <FileText size={14} className="text-slate-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed italic">
          Danh sách minh chứng do AI gợi ý. Người dùng cần kiểm tra và xác nhận trước khi đưa vào hồ sơ đánh giá chính thức.
        </p>
      </div>
    </div>
  );
}
