import React, { useState, useEffect } from 'react';
import { X, Sparkles, AlertCircle, CheckCircle2, ChevronRight, Edit3, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { checkScheduleConflicts, getISOWeek } from '../../utils/scheduleUtils';

export default function AIScheduleParserModal({ isOpen, onClose, onApply, currentWeek, currentYear, existingSchedules = [] }) {
  const [rawText, setRawText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState(1); // 1: Input, 2: Preview
  const [parsedItems, setParsedItems] = useState([]);
  
  // Reset modal when opened
  useEffect(() => {
    if (isOpen) {
      setRawText('');
      setStep(1);
      setParsedItems([]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleParse = async () => {
    if (!rawText.trim()) {
      toast.error('Vui lòng nhập nội dung văn bản.');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch('/api/ai-analyze-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          rawText, 
          currentWeek, 
          currentYear,
          // userRole could be added here if context is available
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Lỗi hệ thống AI');
      }

      // Check conflicts và recalculate week cho từng item
      const itemsWithConflicts = data.data.map(item => {
        // Tự động tính toán số tuần chuẩn từ ngày hệ thống
        const isoInfo = getISOWeek(item.work_date);
        const finalWeek = isoInfo ? isoInfo.week : item.week_number;
        const finalYear = isoInfo ? isoInfo.year : item.year;

        const warnings = checkScheduleConflicts(item, existingSchedules);
        return {
          ...item,
          week_number: finalWeek,
          year: finalYear,
          _id: Math.random().toString(36).substr(2, 9),
          _selected: true,
          _warnings: warnings
        };
      });

      setParsedItems(itemsWithConflicts);
      setStep(2);
      toast.success('Phân tích thành công!');
    } catch (error) {
      console.error('Parse Error:', error);
      toast.error(error.message || 'Hệ thống AI chưa phân tích được văn bản. Vui lòng thử lại.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApply = () => {
    const selectedItems = parsedItems.filter(i => i._selected);
    if (selectedItems.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 dòng để áp dụng.');
      return;
    }
    
    // Pass raw parsed items back to parent.
    // Parent should handle combining with existing items and auto-holidays.
    onApply(selectedItems);
    onClose();
  };

  const toggleSelection = (id) => {
    setParsedItems(prev => prev.map(item => item._id === id ? { ...item, _selected: !item._selected } : item));
  };

  const updateItem = (id, field, value) => {
    setParsedItems(prev => prev.map(item => item._id === id ? { ...item, [field]: value } : item));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-5xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-blue-600" />
            AI Phân Tích Kế Hoạch & Văn Bản
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Dán nội dung văn bản (Giấy mời, Kế hoạch, Thông báo...) vào bên dưới. AI sẽ tự động trích xuất các sự kiện, ngày giờ và phân bổ đúng tuần.
              </p>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Ví dụ: Từ ngày 20 đến 22/5 diễn ra Đại hội... Chiều ngày 24/5 lúc 14h họp BTV..."
                className="w-full h-48 md:h-64 p-4 border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <div className="flex gap-4 text-sm text-slate-500">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded border-slate-300" /> Tự tách lịch theo từng ngày
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded border-slate-300" /> Kiểm tra trùng lịch
                </label>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 dark:text-white">Kết quả phân tích (Xem trước)</h3>
                <span className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-medium">Tìm thấy {parsedItems.length} sự kiện</span>
              </div>
              
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-medium">
                    <tr>
                      <th className="p-3 w-10 text-center">Chọn</th>
                      <th className="p-3">Cảnh báo</th>
                      <th className="p-3 min-w-[120px]">Tuần/Ngày</th>
                      <th className="p-3 min-w-[100px]">Thời gian</th>
                      <th className="p-3 min-w-[200px]">Nội dung</th>
                      <th className="p-3 min-w-[120px]">Chủ trì</th>
                      <th className="p-3 min-w-[150px]">Địa điểm</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {parsedItems.map((item, idx) => (
                      <tr key={item._id} className={`${item._selected ? 'bg-white dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-900/50 opacity-60'} transition-colors`}>
                        <td className="p-3 text-center">
                          <input 
                            type="checkbox" 
                            checked={item._selected}
                            onChange={() => toggleSelection(item._id)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                        <td className="p-3">
                          {item._warnings?.length > 0 && (
                            <div className="flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded text-xs font-medium" title={item._warnings.join('\n')}>
                              <AlertCircle className="w-3 h-3" /> Trùng lịch
                            </div>
                          )}
                          {item.requires_assignment && (
                            <div className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-1 rounded text-xs font-medium mt-1">
                              Cần phân công
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-blue-600">Tuần {item.week_number}/{item.year}</div>
                          <div className="text-slate-500 text-xs">{item.weekday}, {item.work_date}</div>
                        </td>
                        <td className="p-3">
                          <input 
                            value={item.work_time} 
                            onChange={(e) => updateItem(item._id, 'work_time', e.target.value)}
                            className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none"
                          />
                        </td>
                        <td className="p-3">
                          <textarea 
                            value={item.content} 
                            onChange={(e) => updateItem(item._id, 'content', e.target.value)}
                            className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none resize-none h-10"
                          />
                        </td>
                        <td className="p-3">
                          <input 
                            value={item.chair} 
                            onChange={(e) => updateItem(item._id, 'chair', e.target.value)}
                            className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none"
                          />
                        </td>
                        <td className="p-3">
                          <input 
                            value={item.location} 
                            onChange={(e) => updateItem(item._id, 'location', e.target.value)}
                            className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3">
          {step === 1 ? (
            <>
              <button onClick={onClose} className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-200 rounded-xl transition-colors">Hủy</button>
              <button 
                onClick={handleParse} 
                disabled={isProcessing}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang phân tích...</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Phân tích lịch</>
                )}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setStep(1)} className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-200 rounded-xl transition-colors">Quay lại</button>
              <button 
                onClick={handleApply} 
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/20"
              >
                <CheckCircle2 className="w-5 h-5" /> Áp dụng vào lịch tuần
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
