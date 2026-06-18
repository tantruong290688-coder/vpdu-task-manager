import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { analyzeCalendarData } from '../../services/aiCalendarAnalysisService';
import { exportAiAnalysisExcel } from '../../utils/exportAiAnalysisExcel';
import { normalizeDateVNToISO } from '../../utils/scheduleUtils';
import { useAuth } from '../../context/AuthContext';
import { X, BrainCircuit, Download, RefreshCw, Calendar as CalendarIcon, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AiAnalysisModal({ isOpen, onClose }) {
  const { profile } = useAuth();
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState('');
  const [filterWeek, setFilterWeek] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');

  // Prevent background scroll when modal open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAnalyze = async () => {
    setLoading(true);
    setError('');
    setResults(null);
    setSummary(null);

    try {
      // 1. Fetch schedules (only published)
      let query = supabase
        .from('schedules')
        .select('*, schedule_items(*)')
        .eq('status', 'published')
        .eq('year', filterYear);

      if (filterMonth) {
        // Approximate week to month, or just fetch all year and filter items by month
        // We'll fetch all by year, then filter below for precision
      }
      if (filterWeek && parseInt(filterWeek) > 0) {
        query = query.eq('week', filterWeek);
      }

      const { data: schedulesData, error: fetchErr } = await query;
      
      if (fetchErr) throw fetchErr;

      // 2. Flatten and filter items
      let allItems = [];
      schedulesData.forEach(schedule => {
        const items = schedule.schedule_items || [];
        items.forEach(item => {
          if (filterMonth) {
            if (!item.date) return;
            const itemDate = new Date(normalizeDateVNToISO(item.date));
            if (isNaN(itemDate.getTime()) || (itemDate.getMonth() + 1) !== parseInt(filterMonth)) return;
          }
          allItems.push({ ...item, schedule });
        });
      });

      if (allItems.length === 0) {
        setError('Không tìm thấy sự kiện nào đã ban hành trong khoảng thời gian này.');
        setLoading(false);
        return;
      }

      // 3. Analyze
      const analysisResult = await analyzeCalendarData(allItems);
      
      if (analysisResult.success) {
        setResults(analysisResult.data);
        setSummary(analysisResult.summary);
        toast.success(analysisResult.usedAI ? 'Đã phân tích bằng AI thành công!' : 'Đã phân tích tự động thành công!');
      } else {
        setError('Lỗi khi phân tích dữ liệu.');
      }
    } catch (err) {
      console.error(err);
      setError('Lỗi hệ thống: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!results || !summary) return;
    try {
      toast.loading('Đang xuất file Excel...', { id: 'export_ai' });
      const fromDateText = `T${filterMonth || 'all'}-${filterYear}`;
      const toDateText = `T${filterMonth || 'all'}-${filterYear}`;
      await exportAiAnalysisExcel(results, summary, fromDateText, toDateText, profile);
      toast.success('Xuất file thành công!', { id: 'export_ai' });
    } catch (error) {
      toast.error('Lỗi khi xuất file: ' + error.message, { id: 'export_ai' });
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-6xl max-h-[95vh] rounded-3xl shadow-2xl flex flex-col border border-slate-200 dark:border-slate-700 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <BrainCircuit className="text-white" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 dark:text-white">AI Thống Kê Lịch Công Tác</h2>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <CheckCircle2 size={12} className="text-emerald-500" /> Chỉ thống kê lịch đã ban hành
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Filters */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-black uppercase text-slate-500">Năm</label>
            <select 
              value={filterYear} onChange={e => setFilterYear(e.target.value)}
              className="bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500 min-w-[120px]"
            >
              {[...Array(5)].map((_, i) => {
                const y = new Date().getFullYear() - 2 + i;
                return <option key={y} value={y}>{y}</option>;
              })}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-black uppercase text-slate-500">Tháng</label>
            <select 
              value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
              className="bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500 min-w-[120px]"
            >
              <option value="">Tất cả</option>
              {[...Array(12)].map((_, i) => <option key={i+1} value={i+1}>Tháng {i+1}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-black uppercase text-slate-500">Tuần</label>
            <input 
              type="number" placeholder="Ví dụ: 25"
              value={filterWeek} onChange={e => setFilterWeek(e.target.value)}
              className="bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-500 min-w-[120px]"
            />
          </div>

          <div className="flex-1"></div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button 
              onClick={handleAnalyze} disabled={loading}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-[13px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/30 transition-all disabled:opacity-70"
            >
              {loading ? <RefreshCw className="animate-spin" size={16} /> : <Sparkles size={16} />}
              <span>{loading ? 'Đang phân tích...' : 'Phân tích AI'}</span>
            </button>
            
            {results && (
              <button 
                onClick={handleExport}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:hover:bg-emerald-800/50 text-emerald-700 dark:text-emerald-400 rounded-xl text-[13px] font-black uppercase tracking-widest transition-all"
              >
                <Download size={16} /> Xuất Excel
              </button>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-auto p-6 bg-slate-50 dark:bg-[#020617]">
          {error && (
            <div className="p-4 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-2xl border border-rose-100 dark:border-rose-800/30 flex items-center gap-3 font-bold">
              <AlertCircle size={20} /> {error}
            </div>
          )}

          {!loading && !results && !error && (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 min-h-[300px]">
              <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                <BrainCircuit size={32} className="text-slate-300 dark:text-slate-600" />
              </div>
              <p className="font-bold text-lg text-slate-500">Chọn điều kiện lọc và bấm Phân tích AI</p>
              <p className="text-sm mt-2 max-w-md text-center">Hệ thống sẽ tự động quét nội dung lịch đã ban hành và thống kê số cuộc họp của các đồng chí lãnh đạo.</p>
            </div>
          )}

          {loading && (
            <div className="h-full flex flex-col items-center justify-center min-h-[300px]">
              <div className="relative w-20 h-20 flex items-center justify-center">
                <div className="absolute inset-0 border-4 border-indigo-100 dark:border-indigo-900/30 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
                <BrainCircuit size={24} className="text-indigo-500 animate-pulse" />
              </div>
              <p className="mt-4 font-black uppercase tracking-widest text-slate-500 text-[11px] animate-pulse">AI Đang Đọc Dữ Liệu...</p>
            </div>
          )}

          {!loading && results && summary && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col items-center justify-center text-center">
                  <span className="text-3xl font-black text-slate-800 dark:text-white mb-1">{summary.total}</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Sự kiện đã ban hành</span>
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-800/30 flex flex-col items-center justify-center text-center">
                  <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400 mb-1">{summary.biThu}</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600/70 dark:text-indigo-400/70">Họp có Bí Thư</span>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-2xl border border-purple-100 dark:border-purple-800/30 flex flex-col items-center justify-center text-center">
                  <span className="text-3xl font-black text-purple-600 dark:text-purple-400 mb-1">{summary.pbt_tt}</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-purple-600/70 dark:text-purple-400/70">Họp có PBT Thường Trực</span>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-800/30 flex flex-col items-center justify-center text-center">
                  <span className="text-3xl font-black text-blue-600 dark:text-blue-400 mb-1">{summary.pbt_ct}</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-600/70 dark:text-blue-400/70">Họp có PBT Chủ Tịch</span>
                </div>
              </div>

              {/* Data Table */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <h3 className="font-black text-sm text-slate-800 dark:text-white uppercase tracking-wider">Chi Tiết Sự Kiện</h3>
                  {summary.needsReview > 0 && (
                    <span className="text-[11px] font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-lg">
                      {summary.needsReview} sự kiện cần rà soát
                    </span>
                  )}
                </div>
                <div className="overflow-x-auto max-h-[400px]">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-white dark:bg-slate-800 sticky top-0 z-10 shadow-sm">
                      <tr>
                        <th className="px-4 py-3 font-bold text-slate-500 text-[11px] uppercase tracking-wider">Thời gian</th>
                        <th className="px-4 py-3 font-bold text-slate-500 text-[11px] uppercase tracking-wider">Nội dung</th>
                        <th className="px-4 py-3 font-bold text-slate-500 text-[11px] uppercase tracking-wider text-center">Bí Thư</th>
                        <th className="px-4 py-3 font-bold text-slate-500 text-[11px] uppercase tracking-wider text-center">PBT TT</th>
                        <th className="px-4 py-3 font-bold text-slate-500 text-[11px] uppercase tracking-wider text-center">PBT CT</th>
                        <th className="px-4 py-3 font-bold text-slate-500 text-[11px] uppercase tracking-wider">Độ tin cậy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {results.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="px-4 py-3">
                            <div className="font-bold">{item.date ? new Date(normalizeDateVNToISO(item.date)).toLocaleDateString('vi-VN') : ''}</div>
                            <div className="text-xs text-slate-500">{item.time}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-normal min-w-[200px]">
                            <div className="font-medium line-clamp-2" title={item.content}>{item.content}</div>
                            {item.host && <div className="text-[11px] text-slate-500 mt-1">Chủ trì: <span className="font-bold text-slate-700 dark:text-slate-300">{item.host}</span></div>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {item.analysis.isBiThu ? <CheckCircle2 size={16} className="text-emerald-500 mx-auto" /> : <span className="text-slate-300">-</span>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {item.analysis.isPBT_TT ? <CheckCircle2 size={16} className="text-emerald-500 mx-auto" /> : <span className="text-slate-300">-</span>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {item.analysis.isPBT_CT ? <CheckCircle2 size={16} className="text-emerald-500 mx-auto" /> : <span className="text-slate-300">-</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg ${
                              item.analysis.needsReview 
                                ? 'bg-amber-100 text-amber-700' 
                                : item.analysis.reliability.includes('AI') 
                                  ? 'bg-purple-100 text-purple-700'
                                  : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {item.analysis.reliability}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
