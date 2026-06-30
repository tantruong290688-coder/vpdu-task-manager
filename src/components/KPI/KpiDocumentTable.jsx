import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { ROLE_LABELS, ROLE_COLORS } from '../../services/kpiDocumentService';

const PAGE_SIZE = 20;

export default function KpiDocumentTable({ documents = [], title, emptyText }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState('document_date');
  const [sortDir, setSortDir] = useState('desc');

  const filtered = documents.filter(doc => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (doc.document_number || '').toLowerCase().includes(q) ||
      (doc.summary || '').toLowerCase().includes(q) ||
      (doc.document_type || '').toLowerCase().includes(q) ||
      (doc.presenter_name || '').toLowerCase().includes(q) ||
      (doc.signer_name || '').toLowerCase().includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    const va = a[sortField] || '';
    const vb = b[sortField] || '';
    const cmp = va < vb ? -1 : va > vb ? 1 : 0;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setPage(1);
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  if (documents.length === 0) {
    return (
      <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl">
        <p className="text-[13px] font-bold text-slate-400 text-center">{emptyText || 'Không có văn bản nào'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {title && (
        <div className="flex items-center justify-between">
          <h4 className="text-[13px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight">{title}</h4>
          <span className="text-[12px] font-bold text-slate-400">{filtered.length} văn bản</span>
        </div>
      )}

      {documents.length >= 5 && (
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo số ký hiệu, trích yếu, người trình..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 pl-9 pr-4 py-2 rounded-xl text-[12px] font-bold outline-none focus:border-indigo-400 transition-colors"
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
        <table className="w-full text-left min-w-[800px]">
          <thead className="bg-slate-50/80 dark:bg-slate-800/80">
            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <th className="px-4 py-3 cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => toggleSort('document_number')}>
                <div className="flex items-center gap-1">Số ký hiệu <SortIcon field="document_number" /></div>
              </th>
              <th className="px-4 py-3 cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => toggleSort('document_date')}>
                <div className="flex items-center gap-1">Ngày <SortIcon field="document_date" /></div>
              </th>
              <th className="px-4 py-3 cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => toggleSort('document_type')}>
                <div className="flex items-center gap-1">Loại VB <SortIcon field="document_type" /></div>
              </th>
              <th className="px-4 py-3">Trích yếu</th>
              <th className="px-4 py-3 cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => toggleSort('presenter_name')}>
                <div className="flex items-center gap-1">Người trình <SortIcon field="presenter_name" /></div>
              </th>
              <th className="px-4 py-3">Người ký</th>
              <th className="px-4 py-3">Vai trò</th>
              <th className="px-4 py-3">Ghi chú AI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {paged.map((doc, idx) => {
              const roleType = doc.role_type || doc.kpi_document_staff_roles?.[0]?.role_type || 'unrelated';
              const reason = doc.reason || doc.kpi_document_staff_roles?.[0]?.reason || '';
              const confidence = doc.confidence_score ?? doc.kpi_document_staff_roles?.[0]?.confidence_score ?? 0;
              const needsReview = roleType === 'needs_review';

              return (
                <tr key={doc.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-[12px] font-black text-indigo-700 dark:text-indigo-400 font-mono whitespace-nowrap">
                      {doc.document_number || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[12px] font-bold text-slate-500 whitespace-nowrap">
                    {doc.document_date
                      ? new Date(doc.document_date).toLocaleDateString('vi-VN')
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {doc.document_type || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-[280px]">
                    <p className="text-[12px] font-bold text-slate-700 dark:text-slate-200 line-clamp-2 leading-snug">
                      {doc.summary || '—'}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[12px] font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {doc.presenter_name || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[12px] font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {doc.signer_name || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black whitespace-nowrap ${ROLE_COLORS[roleType]}`}>
                      {needsReview && <AlertTriangle size={10} />}
                      {ROLE_LABELS[roleType] || roleType}
                      {confidence > 0 && (
                        <span className="opacity-60 ml-0.5">{Math.round(confidence * 100)}%</span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-[200px]">
                    <p className="text-[11px] text-slate-400 leading-snug line-clamp-2 italic">
                      {reason || '—'}
                    </p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold text-slate-400">
            Trang {page}/{totalPages} • {filtered.length} văn bản
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-[12px] font-bold text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              ← Trước
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl text-[12px] font-bold text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Sau →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
