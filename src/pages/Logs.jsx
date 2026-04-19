import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { RotateCcw, Search, Clock, ChevronDown, X } from 'lucide-react';

const PAGE_SIZE = 20;

const ACTION_COLORS = {
  'Tạo nhiệm vụ':    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  'Cập nhật nhiệm vụ': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'Cập nhật tiến độ': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  'Cập nhật trạng thái': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  'Xóa nhiệm vụ':    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'Đăng nhập':       'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  'Đăng xuất':       'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  'Đặt lại mật khẩu': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  'Ghi chú':         'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
};

const getActionColor = (action) =>
  ACTION_COLORS[action] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';

const ROLE_LABELS = { admin: 'Quản trị', manager: 'Quản lý', staff: 'Nhân viên', specialist: 'Chuyên viên' };

export default function Logs() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'manager';

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const fetchLogs = useCallback(async (resetPage = true) => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);

    const currentPage = resetPage ? 0 : page;
    if (resetPage) setPage(0);

    try {
      let query = supabase
        .from('activity_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

      if (search.trim()) {
        query = query.or(
          `actor_name.ilike.%${search}%,action.ilike.%${search}%,task_code.ilike.%${search}%,note.ilike.%${search}%`
        );
      }

      const { data, error: fetchError, count } = await query;

      if (fetchError) throw fetchError;

      if (resetPage) {
        setLogs(data || []);
      } else {
        setLogs((prev) => [...prev, ...(data || [])]);
      }
      setTotalCount(count || 0);
      setHasMore((data || []).length === PAGE_SIZE);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.id, search, page]);

  useEffect(() => {
    fetchLogs(true);
  }, [user?.id, search]);

  const loadMore = async () => {
    const nextPage = page + 1;
    setPage(nextPage);
    setLoading(true);

    try {
      let query = supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(nextPage * PAGE_SIZE, (nextPage + 1) * PAGE_SIZE - 1);

      if (search.trim()) {
        query = query.or(
          `actor_name.ilike.%${search}%,action.ilike.%${search}%,task_code.ilike.%${search}%,note.ilike.%${search}%`
        );
      }

      const { data } = await query;
      setLogs((prev) => [...prev, ...(data || [])]);
      setHasMore((data || []).length === PAGE_SIZE);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const clearSearch = () => {
    setSearchInput('');
    setSearch('');
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleString('vi-VN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="bg-white dark:bg-[#111827] rounded-[24px] shadow-sm border border-slate-100 dark:border-slate-800 p-6 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <Clock size={22} strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-[20px] font-extrabold text-slate-800 dark:text-white leading-tight">
                Nhật ký thao tác
              </h2>
              <p className="text-[12px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Theo dõi lịch sử cập nhật, chỉnh sửa hệ thống.
                {totalCount > 0 && (
                  <span className="ml-2 text-blue-600 dark:text-blue-400 font-bold">
                    {totalCount.toLocaleString()} bản ghi
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <form onSubmit={handleSearch} className="relative">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Tìm người thao tác, hành động, mã nhiệm vụ..."
                className="w-full sm:w-72 pl-4 pr-10 py-2.5 bg-slate-50 dark:bg-[#1f2937] border border-slate-200 dark:border-slate-700 rounded-xl text-[13px] font-medium text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {searchInput && (
                  <button type="button" onClick={clearSearch} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                    <X size={14} />
                  </button>
                )}
                <button type="submit" className="text-slate-400 hover:text-blue-500 dark:hover:text-blue-400">
                  <Search size={15} />
                </button>
              </div>
            </form>

            {/* Refresh */}
            <button
              onClick={() => fetchLogs(true)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-60 text-white text-[13px] font-bold rounded-xl transition-colors shadow-sm"
            >
              <RotateCcw size={15} className={loading ? 'animate-spin' : ''} />
              Làm mới log
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#111827] rounded-[24px] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden transition-colors">
        {/* Filter tag */}
        {search && (
          <div className="px-6 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
            <span className="text-[12px] text-slate-500 dark:text-slate-400 font-medium">Đang lọc:</span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[12px] font-semibold rounded-full border border-blue-100 dark:border-blue-900">
              "{search}"
              <button onClick={clearSearch} className="hover:text-red-500 transition-colors"><X size={11} /></button>
            </span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-8 text-center">
            <p className="text-red-500 dark:text-red-400 font-semibold text-[14px]">
              ⚠️ Lỗi tải dữ liệu: {error}
            </p>
            <button onClick={() => fetchLogs(true)} className="mt-3 text-blue-600 dark:text-blue-400 text-[13px] font-semibold hover:underline">
              Thử lại
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && logs.length === 0 && !error && (
          <div className="divide-y divide-slate-50 dark:divide-slate-800/50">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="px-6 py-4 flex gap-4 animate-pulse">
                <div className="h-4 w-36 bg-slate-100 dark:bg-slate-800 rounded" />
                <div className="h-4 w-32 bg-slate-100 dark:bg-slate-800 rounded" />
                <div className="h-4 w-20 bg-slate-100 dark:bg-slate-800 rounded" />
                <div className="h-4 w-28 bg-slate-100 dark:bg-slate-800 rounded" />
                <div className="h-4 w-20 bg-slate-100 dark:bg-slate-800 rounded" />
                <div className="h-4 flex-1 bg-slate-100 dark:bg-slate-800 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && logs.length === 0 && (
          <div className="p-16 text-center flex flex-col items-center gap-3 text-slate-400 dark:text-slate-500">
            <Clock size={40} className="opacity-30" />
            <p className="text-[14px] font-semibold">
              {search ? 'Không tìm thấy bản ghi nào phù hợp.' : 'Chưa có thao tác nào được ghi nhận.'}
            </p>
            {search && (
              <button onClick={clearSearch} className="text-blue-600 dark:text-blue-400 text-[13px] font-semibold hover:underline">
                Xóa bộ lọc
              </button>
            )}
          </div>
        )}

        {/* Data table */}
        {logs.length > 0 && (
          <>
            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50">
                  <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap w-44">Thời gian</th>
                  <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap w-44">Người thao tác</th>
                  <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap w-28">Vai trò</th>
                  <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap w-44">Hành động</th>
                  <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap w-32">Mã nhiệm vụ</th>
                  <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/40">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group">
                    {/* Time */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="text-[12px] font-mono text-slate-500 dark:text-slate-400">
                        {formatTime(log.created_at)}
                      </span>
                    </td>

                    {/* Actor */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[11px] font-bold shrink-0 shadow-sm">
                          {(log.actor_name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
                          {log.actor_name || '—'}
                        </span>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="text-[12px] text-slate-500 dark:text-slate-400 font-medium">
                        {ROLE_LABELS[log.actor_role] || log.actor_role || '—'}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2.5 py-1 rounded-lg text-[12px] font-bold ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>

                    {/* Task code */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      {log.task_code ? (
                        <button
                          onClick={() => navigate(`/all-tasks?search=${log.task_code}${log.task_id ? `&open=${log.task_id}` : ''}`)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[12px] font-bold rounded-lg border border-blue-100 dark:border-blue-900/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                        >
                          {log.task_code}
                        </button>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600 text-[12px]">—</span>
                      )}
                    </td>

                    {/* Note */}
                    <td className="px-5 py-4">
                      <span className="text-[13px] text-slate-600 dark:text-slate-400 line-clamp-2 leading-snug">
                        {log.note || '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800/50">
            {logs.map((log) => (
              <div key={log.id} className="p-4 space-y-3 bg-white dark:bg-[#111827] hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[12px] font-bold shrink-0 shadow-sm">
                      {(log.actor_name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-200 leading-tight">
                        {log.actor_name || '—'}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {formatTime(log.created_at)}
                      </span>
                    </div>
                  </div>
                  <span className={`shrink-0 inline-flex px-2 py-1 rounded-lg text-[10px] font-bold ${getActionColor(log.action)}`}>
                    {log.action}
                  </span>
                </div>
                
                <div className="text-[12px] text-slate-600 dark:text-slate-400 flex items-center gap-2">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Nhiệm vụ: </span>
                  {log.task_code ? (
                    <button
                      onClick={() => navigate(`/all-tasks?search=${log.task_code}${log.task_id ? `&open=${log.task_id}` : ''}`)}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold rounded-md border border-blue-100 dark:border-blue-900/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                    >
                      {log.task_code}
                    </button>
                  ) : '—'}
                </div>
                {log.note && (
                  <div className="text-[12px] text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                    {log.note}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
        )}

        {/* Load more */}
        {hasMore && !loading && (
          <div className="p-5 border-t border-slate-100 dark:border-slate-800 text-center">
            <button
              onClick={loadMore}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[13px] font-bold rounded-xl border border-slate-200 dark:border-slate-700 transition-colors"
            >
              <ChevronDown size={16} />
              Tải thêm ({totalCount - logs.length} bản ghi còn lại)
            </button>
          </div>
        )}

        {/* Loading more spinner */}
        {loading && logs.length > 0 && (
          <div className="p-5 text-center">
            <div className="inline-flex items-center gap-2 text-slate-400 dark:text-slate-500 text-[13px]">
              <RotateCcw size={14} className="animate-spin" />
              Đang tải thêm...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
