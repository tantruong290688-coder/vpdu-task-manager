import React, { useState, useEffect } from 'react';
import { X, Sparkles, AlertCircle, CheckCircle2, ChevronRight, Edit3, Trash2, UploadCloud } from 'lucide-react';
import toast from 'react-hot-toast';
import { checkScheduleConflicts, getISOWeek } from '../../utils/scheduleUtils';

export default function AIScheduleParserModal({ isOpen, onClose, onApply, currentWeek, currentYear, existingSchedules = [] }) {
  const [rawText, setRawText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState(1); // 1: Input, 2: Preview
  const [parsedItems, setParsedItems] = useState([]);
  
  // File Upload states
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileBase64, setFileBase64] = useState('');
  const [fileMimeType, setFileMimeType] = useState('');
  const [isDragActive, setIsDragActive] = useState(false);

  // Reset modal when opened
  useEffect(() => {
    if (isOpen) {
      setRawText('');
      setStep(1);
      setParsedItems([]);
      setSelectedFile(null);
      setFileBase64('');
      setFileMimeType('');
      setIsDragActive(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const processFile = (file) => {
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      toast.error('Chỉ hỗ trợ file ảnh (PNG, JPG, WebP) hoặc file tài liệu PDF.');
      return;
    }
    
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Dung lượng file tối đa là 8MB.');
      return;
    }

    setSelectedFile(file);
    setFileMimeType(file.type);

    const reader = new FileReader();
    reader.onload = (e) => {
      setFileBase64(e.target.result);
      toast.success(`Đã chọn file: ${file.name}`);
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleParse = async () => {
    if (!rawText.trim() && !fileBase64) {
      toast.error('Vui lòng nhập nội dung văn bản hoặc tải lên Ảnh/PDF Giấy mời.');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch('/api/ai-analyze-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          rawText, 
          fileData: fileBase64,
          mimeType: fileMimeType,
          currentWeek, 
          currentYear,
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
            <div className="space-y-6">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Nhập văn bản thô hoặc tải lên tệp đính kèm (PDF/Ảnh) của Giấy mời họp. AI sẽ tự động đọc (OCR) và bóc tách lịch công tác tuần hoàn hảo.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col space-y-2">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Cách 1: Dán văn bản chỉ đạo / Lịch họp</label>
                  <textarea
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder="Ví dụ: Từ ngày 20 đến 22/5 diễn ra Hội nghị... Sáng 24/5 lúc 8h họp giao ban..."
                    className="w-full h-56 p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 resize-none text-sm outline-none transition-all focus:border-blue-500"
                  />
                </div>
                
                <div className="flex flex-col space-y-2">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Cách 2: Tải trực tiếp file PDF / Ảnh Giấy mời</label>
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    className={`flex-1 min-h-[224px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-4 text-center transition-all relative ${
                      isDragActive 
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 shadow-inner' 
                        : selectedFile 
                          ? 'border-emerald-500 bg-emerald-50/10 dark:bg-emerald-900/10' 
                          : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-slate-500 bg-slate-50 dark:bg-slate-900/50'
                    }`}
                  >
                    <input 
                      type="file" 
                      id="schedule-file-upload" 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                      onChange={handleFileChange}
                      accept=".png,.jpg,.jpeg,.webp,.pdf"
                    />
                    
                    {selectedFile ? (
                      <div className="space-y-3 z-20">
                        <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto text-emerald-600">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-200 line-clamp-2 max-w-[250px] mx-auto">{selectedFile.name}</p>
                          <p className="text-xs text-slate-400 mt-1">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedFile(null);
                            setFileBase64('');
                            setFileMimeType('');
                          }}
                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/20 dark:text-red-400 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 mx-auto"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Xóa tệp
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3 pointer-events-none">
                        <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                          <UploadCloud className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">Kéo thả hoặc nhấp để chọn tệp</p>
                          <p className="text-xs text-slate-400 mt-1">Hỗ trợ Ảnh (PNG, JPG, WebP) và tài liệu PDF tối đa 8MB</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" /> Tự tách lịch theo từng ngày
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" /> Kiểm tra trùng lịch
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
