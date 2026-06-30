import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  X, BarChart3, FileText, CheckCircle2, Star, MessageSquare,
  Loader2, Sparkles, RefreshCw, Trash2, AlertTriangle, Clock,
  TrendingUp, Users, Target, ChevronRight, Info
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import KpiDocumentTable from './KpiDocumentTable';
import KpiEvidenceList from './KpiEvidenceList';
import { supabase } from '../../lib/supabase';
import { detectStaffRoleInDocument } from '../../services/kpiDocumentService';

const getToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
};

const TABS = [
  { id: 'overview', label: 'Tổng quan', icon: BarChart3 },
  { id: 'direct', label: 'Trực tiếp tham mưu', icon: FileText },
  { id: 'reviewer', label: 'Thẩm định', icon: CheckCircle2 },
  { id: 'tasks', label: 'Nhiệm vụ', icon: Target },
  { id: 'evidence', label: 'Minh chứng KPI', icon: Star },
  { id: 'ai_comment', label: 'Nhận xét AI', icon: MessageSquare },
];

function StatCard({ label, value, icon: Icon, color, sub }) {
  return (
    <div className={`p-4 rounded-2xl border border-transparent bg-opacity-80 ${color}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon size={14} className="opacity-70" />
        <span className="text-[10px] font-black uppercase tracking-wider opacity-70">{label}</span>
      </div>
      <div className="text-2xl font-black leading-none">{value ?? '—'}</div>
      {sub && <div className="text-[11px] font-bold opacity-60 mt-1">{sub}</div>}
    </div>
  );
}

export default function KpiAnalysisResult({
  batch,
  staffName,
  staffId,
  staffConfig,
  onClose,
  onRunAnalysis,
  onDeleteBatch,
  isAnalyzing,
  tasks = [],
}) {
  const [activeTab, setActiveTab] = useState('overview');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const analysis = batch?.kpi_ai_analysis_results?.[0] || null;

  // Lấy documents của batch
  const { data: docsData, isLoading: isLoadingDocs } = useQuery({
    queryKey: ['kpi-documents', batch?.id],
    queryFn: async () => {
      if (!batch?.id) return { documents: [] };
      const token = await getToken();
      const resp = await fetch(`/api/kpi?module=import&action=get-documents&batchId=${batch.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      if (!data.success) throw new Error(data.error);
      return data;
    },
    enabled: !!batch?.id,
    staleTime: 60_000,
  });

  // Flatten roles từ DB, sau đó runtime-reclassify các doc đã lưu với role cũ.
  // Logic mới: mọi văn bản không do cán bộ này trình → reviewer (không cần flag đặc biệt).
  // Cần reclassify các doc `unrelated` và `signer` đã lưu với logic cũ.
  const docsWithRoles = useMemo(() => {
    const raw = docsData?.documents || [];

    return raw.map(d => {
      const fromDB = {
        ...d,
        role_type: d.kpi_document_staff_roles?.[0]?.role_type || 'unrelated',
        reason: d.kpi_document_staff_roles?.[0]?.reason || '',
        confidence_score: d.kpi_document_staff_roles?.[0]?.confidence_score || 0,
      };

      // Reclassify role cũ (unrelated/signer) bằng logic mới nếu có staffConfig
      if (['unrelated', 'signer'].includes(fromDB.role_type) && staffConfig?.full_name) {
        const reclassified = detectStaffRoleInDocument(d, staffConfig);
        return { ...fromDB, ...reclassified };
      }

      return fromDB;
    });
  }, [docsData, staffConfig]);

  // Debug: log phân loại văn bản mỗi lần docsWithRoles thay đổi
  useEffect(() => {
    if (docsWithRoles.length > 0) {
      const counts = docsWithRoles.reduce((acc, d) => {
        acc[d.role_type] = (acc[d.role_type] || 0) + 1;
        return acc;
      }, {});
      console.log('[KPI] Phân loại văn bản:', counts, '| staffConfig:', staffConfig?.full_name);
    }
  }, [docsWithRoles, staffConfig]);

  const directDocs = docsWithRoles.filter(d => d.role_type === 'direct_advisor');
  const reviewerDocs = docsWithRoles.filter(d => d.role_type === 'reviewer');
  const needsReviewDocs = docsWithRoles.filter(d => d.role_type === 'needs_review');

  // Luôn dùng counts từ docsWithRoles (đã runtime-reclassify) để tránh stale data từ analysis.document_statistics
  const docStats = {
    total: docsWithRoles.filter(d => d.role_type !== 'unrelated').length,
    direct_advisor: directDocs.length,
    reviewer: reviewerDocs.length,
    collaborator: docsWithRoles.filter(d => d.role_type === 'collaborator').length,
    needs_review: needsReviewDocs.length,
  };

  const taskStats = analysis?.task_statistics || {};

  const staffTasks = tasks.filter(t =>
    t.assignee_id === staffId ||
    (t.task_collaborators || []).some(c => c.user_id === staffId)
  ).map(t => ({
    ...t,
    role: t.assignee_id === staffId ? 'Chủ trì' : 'Phối hợp',
  }));

  const handleDeleteConfirm = useCallback(async () => {
    setShowDeleteConfirm(false);
    await onDeleteBatch(batch?.id);
    onClose();
  }, [batch, onDeleteBatch, onClose]);

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-white dark:bg-[#0f172a] rounded-[32px] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="px-8 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white">
              <TrendingUp size={20} />
            </div>
            <div>
              <h2 className="text-[16px] font-black text-slate-800 dark:text-white leading-none">Phân tích KPI từ Văn bản</h2>
              <p className="text-[12px] text-slate-400 font-bold mt-0.5">
                {staffName} • {batch?.period_label || 'Chưa chọn kỳ'} •{' '}
                {batch?.total_documents || 0} văn bản
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Nút phân tích lại */}
            <button
              onClick={() => onRunAnalysis(batch?.id, tasks)}
              disabled={isAnalyzing || isLoadingDocs}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[12px] font-black transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
            >
              {isAnalyzing ? (
                <><Loader2 size={14} className="animate-spin" /> Đang phân tích...</>
              ) : (
                <><Sparkles size={14} /> {analysis ? 'Phân tích lại' : 'Phân tích AI'}</>
              )}
            </button>

            {/* Xóa batch */}
            {batch?.id && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-colors"
                title="Xóa đợt nhập này"
              >
                <Trash2 size={16} />
              </button>
            )}

            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-8 pt-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex gap-1 overflow-x-auto pb-3 scrollbar-none">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-black whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <tab.icon size={14} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">

          {/* ── TAB: Tổng quan ── */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <StatCard
                  label="Tổng văn bản liên quan"
                  value={docStats.total}
                  icon={FileText}
                  color="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300"
                />
                <StatCard
                  label="Trực tiếp tham mưu"
                  value={docStats.direct_advisor}
                  icon={CheckCircle2}
                  color="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                />
                <StatCard
                  label="Thẩm định"
                  value={docStats.reviewer}
                  icon={Users}
                  color="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300"
                />
                <StatCard
                  label="Cần kiểm tra lại"
                  value={docStats.needs_review}
                  icon={AlertTriangle}
                  color="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300"
                />
                <StatCard
                  label="Tổng nhiệm vụ"
                  value={taskStats.total ?? staffTasks.length}
                  icon={Target}
                  color="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                />
                <StatCard
                  label="Đã hoàn thành"
                  value={taskStats.completed ?? staffTasks.filter(t => t.status === 'completed').length}
                  icon={CheckCircle2}
                  color="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300"
                />
                <StatCard
                  label="Tỷ lệ hoàn thành"
                  value={taskStats.completion_rate !== undefined ? `${taskStats.completion_rate}%` : null}
                  icon={TrendingUp}
                  color="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300"
                />
                <StatCard
                  label="Quá hạn"
                  value={taskStats.overdue ?? '—'}
                  icon={Clock}
                  color="bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300"
                />
              </div>

              {/* AI summary */}
              {analysis?.analysis_summary ? (
                <div className="p-6 bg-indigo-50/60 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/50 rounded-[24px]">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles size={16} className="text-indigo-600" />
                    <h4 className="text-[13px] font-black text-indigo-800 dark:text-indigo-200 uppercase tracking-tight">Tóm tắt AI</h4>
                  </div>
                  <p className="text-[14px] text-indigo-800/80 dark:text-indigo-300/80 font-bold leading-relaxed">
                    {analysis.analysis_summary}
                  </p>
                </div>
              ) : (
                <div className="py-10 flex flex-col items-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl">
                  <Sparkles size={24} className="text-slate-300 mb-3" />
                  <p className="text-[13px] font-bold text-slate-400 text-center max-w-xs">
                    Chưa có kết quả AI. Nhấn "Phân tích AI" để bắt đầu.
                  </p>
                </div>
              )}

              {/* Files list */}
              {batch?.kpi_import_files?.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-[12px] font-black text-slate-500 uppercase tracking-widest">File đã nhập</h4>
                  {batch.kpi_import_files.map(f => (
                    <div key={f.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-700">
                      <FileText size={16} className={f.file_type === 'pdf' ? 'text-rose-500' : 'text-emerald-600'} />
                      <div className="flex-1">
                        <p className="text-[13px] font-bold text-slate-700 dark:text-slate-200">{f.file_name}</p>
                        <p className="text-[11px] text-slate-400">{f.rows_parsed} văn bản • {(f.file_size / 1024 / 1024).toFixed(1)} MB</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${
                        f.parse_status === 'success' ? 'bg-emerald-100 text-emerald-700' :
                        f.parse_status === 'scan_warning' ? 'bg-amber-100 text-amber-700' :
                        f.parse_status === 'failed' ? 'bg-rose-100 text-rose-700' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {f.parse_status === 'success' ? 'Đọc thành công' :
                         f.parse_status === 'scan_warning' ? '⚠ PDF scan' :
                         f.parse_status === 'failed' ? 'Lỗi' : f.parse_status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── TAB: Trực tiếp tham mưu ── */}
          {activeTab === 'direct' && (
            isLoadingDocs
              ? <LoadingState />
              : <KpiDocumentTable
                  documents={directDocs}
                  title={`Văn bản trực tiếp tham mưu (${directDocs.length})`}
                  emptyText="Không tìm thấy văn bản nào mà cán bộ trực tiếp trình ký/soạn thảo."
                />
          )}

          {/* ── TAB: Thẩm định ── */}
          {activeTab === 'reviewer' && (
            isLoadingDocs
              ? <LoadingState />
              : (
                <div className="space-y-6">
                  <KpiDocumentTable
                    documents={reviewerDocs}
                    title={`Văn bản thẩm định (${reviewerDocs.length})`}
                    emptyText="Không có văn bản nào được phân loại thẩm định. Thử nhập lại file hoặc kiểm tra cột Người trình trong PDF/Excel."
                  />
                  {needsReviewDocs.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-800/30">
                        <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                        <p className="text-[12px] text-amber-800 dark:text-amber-300 font-bold">
                          {needsReviewDocs.length} văn bản có tên khớp gần đúng, cần kiểm tra lại thủ công.
                        </p>
                      </div>
                      <KpiDocumentTable
                        documents={needsReviewDocs}
                        title="Cần kiểm tra lại"
                        emptyText=""
                      />
                    </div>
                  )}
                </div>
              )
          )}

          {/* ── TAB: Nhiệm vụ ── */}
          {activeTab === 'tasks' && (
            <div className="space-y-4">
              {staffTasks.length === 0 ? (
                <div className="py-12 flex flex-col items-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl">
                  <Target size={24} className="text-slate-300 mb-3" />
                  <p className="text-[13px] font-bold text-slate-400">Không có nhiệm vụ nào trong kỳ này.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {staffTasks.map(t => (
                    <div key={t.id} className="flex items-start gap-4 p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl hover:border-indigo-200 dark:hover:border-indigo-700 transition-colors">
                      <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${
                        t.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-black text-slate-400 font-mono">{t.code}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                            t.role === 'Chủ trì'
                              ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                          }`}>{t.role}</span>
                        </div>
                        <p className="text-[13px] font-black text-slate-800 dark:text-white leading-snug">{t.title}</p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Hạn: {t.due_date ? new Date(t.due_date).toLocaleDateString('vi-VN') : '—'} •{' '}
                          {t.status === 'completed' ? '✅ Hoàn thành' : '🕐 Chưa xong'}
                        </p>
                      </div>
                      {t.score != null && (
                        <div className="text-right">
                          <div className="text-xl font-black text-indigo-600">{t.score}</div>
                          <div className="text-[9px] font-black text-slate-400 uppercase">Điểm</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── TAB: Minh chứng KPI ── */}
          {activeTab === 'evidence' && (
            <KpiEvidenceList evidence={analysis?.kpi_evidence || []} />
          )}

          {/* ── TAB: Nhận xét AI ── */}
          {activeTab === 'ai_comment' && (
            <div className="space-y-6">
              {analysis ? (
                <>
                  {analysis.strengths && (
                    <Section title="Ưu điểm nổi bật" color="emerald">
                      <ReactMarkdown className="prose prose-slate dark:prose-invert prose-sm max-w-none">
                        {analysis.strengths}
                      </ReactMarkdown>
                    </Section>
                  )}

                  {analysis.limitations && (
                    <Section title="Hạn chế cần cải thiện" color="amber">
                      <ReactMarkdown className="prose prose-slate dark:prose-invert prose-sm max-w-none">
                        {analysis.limitations}
                      </ReactMarkdown>
                    </Section>
                  )}

                  {analysis.suggested_comment && (
                    <div className="p-6 bg-indigo-50/60 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/50 rounded-[24px]">
                      <div className="flex items-center gap-2 mb-4">
                        <MessageSquare size={16} className="text-indigo-600" />
                        <h4 className="text-[13px] font-black text-indigo-800 dark:text-indigo-200 uppercase tracking-tight">Nhận xét tham khảo</h4>
                      </div>
                      <div className="text-[14px] text-indigo-800/90 dark:text-indigo-300/90 font-bold leading-relaxed whitespace-pre-wrap italic">
                        {analysis.suggested_comment}
                      </div>
                    </div>
                  )}

                  <Disclaimer />
                </>
              ) : (
                <div className="py-12 flex flex-col items-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl">
                  <Sparkles size={24} className="text-slate-300 mb-3" />
                  <p className="text-[13px] font-bold text-slate-400 text-center max-w-xs">
                    Chưa có nhận xét AI. Nhấn "Phân tích AI" để tổng hợp.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between">
          <p className="text-[11px] font-bold text-slate-400">
            {batch?.created_at && `Nhập ngày: ${new Date(batch.created_at).toLocaleDateString('vi-VN')}`}
            {analysis?.ai_model_used && ` • AI: ${analysis.ai_model_used}`}
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-[13px] font-bold transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>

      {/* Confirm delete */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center z-10">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-rose-100 rounded-2xl flex items-center justify-center text-rose-600">
                <Trash2 size={20} />
              </div>
              <h3 className="text-[15px] font-black text-slate-800 dark:text-white">Xóa đợt nhập?</h3>
            </div>
            <p className="text-[13px] text-slate-500 dark:text-slate-400 font-bold leading-relaxed mb-6">
              Toàn bộ dữ liệu văn bản, kết quả phân tích vai trò và nhận xét AI của đợt này sẽ bị xóa vĩnh viễn. Không thể khôi phục.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-700 rounded-xl text-[13px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 rounded-xl text-[13px] font-black text-white transition-colors"
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children, color = 'slate' }) {
  const colors = {
    emerald: 'bg-emerald-50/60 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/30',
    amber: 'bg-amber-50/60 dark:bg-amber-900/10 border-amber-100 dark:border-amber-800/30',
    slate: 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-700',
  };
  const titleColors = {
    emerald: 'text-emerald-800 dark:text-emerald-200',
    amber: 'text-amber-800 dark:text-amber-200',
    slate: 'text-slate-700 dark:text-slate-200',
  };
  return (
    <div className={`p-6 border rounded-[24px] ${colors[color]}`}>
      <h4 className={`text-[13px] font-black uppercase tracking-tight mb-4 ${titleColors[color]}`}>{title}</h4>
      <div className={`text-[13px] font-bold leading-relaxed ${titleColors[color]} opacity-90`}>
        {children}
      </div>
    </div>
  );
}

function Disclaimer() {
  return (
    <div className="flex items-start gap-2 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-700">
      <Info size={14} className="text-slate-400 shrink-0 mt-0.5" />
      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed italic">
        Kết quả AI chỉ có giá trị tham khảo, phục vụ tổng hợp, theo dõi, đánh giá.
        Việc xếp loại chính thức do cấp có thẩm quyền quyết định theo quy định hiện hành.
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="py-16 flex flex-col items-center gap-3">
      <Loader2 size={28} className="text-indigo-600 animate-spin" />
      <p className="text-[13px] font-bold text-slate-400">Đang tải dữ liệu văn bản...</p>
    </div>
  );
}
