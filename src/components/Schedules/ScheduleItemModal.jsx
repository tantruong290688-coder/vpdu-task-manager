import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, MapPin, Users, User, Type, AlignLeft } from 'lucide-react';
import { determineSession } from '../../utils/scheduleUtils';

export default function ScheduleItemModal({ isOpen, onClose, onSave, onDelete, initialData }) {
  const [formData, setFormData] = useState({
    id: `temp_${Date.now()}`,
    date: '',
    session: 'Sáng',
    time: '',
    content: '',
    host: '',
    attendees: '',
    location: '',
    prepare_by: '',
    type: 'meeting',
    ...initialData
  });

  useEffect(() => {
    if (isOpen && initialData) {
      const initTime = initialData.time || '';
      const isRedundant = ['sáng', 'chiều', 'tối', 'cả ngày'].includes(initTime.toLowerCase().trim());
      const determined = determineSession(initialData);

      setFormData({
        ...formData, // default structure
        ...initialData,
        session: initialData.session || determined || 'Sáng',
        time: isRedundant ? '' : initTime
      });
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.date || !formData.content) {
      alert("Vui lòng nhập Ngày và Nội dung");
      return;
    }
    const dataToSave = { ...formData };

    // Nếu không có giờ cụ thể, đồng bộ lại time để Supabase lưu trữ được thông tin buổi
    if (!dataToSave.time && dataToSave.session) {
      dataToSave.time = dataToSave.session;
    }

    onSave(dataToSave);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">
            {initialData?.id ? 'Chỉnh sửa sự kiện' : 'Thêm sự kiện'}
          </h2>
          <button onClick={onClose} type="button" className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          
          <div className="grid grid-cols-2 gap-5">
            {/* Ngày */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-500" /> Ngày <span className="text-rose-500">*</span>
              </label>
              <input 
                type="date" 
                name="date"
                required
                value={formData.date || ''} 
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-all"
              />
            </div>

            {/* Buổi */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-500" /> Buổi <span className="text-rose-500">*</span>
              </label>
              <select 
                name="session"
                value={formData.session || 'Sáng'} 
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-all appearance-none cursor-pointer"
              >
                <option value="Sáng">Sáng</option>
                <option value="Chiều">Chiều</option>
                <option value="Tối">Tối</option>
                <option value="Cả ngày">Cả ngày</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            {/* Giờ bắt đầu */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-400" /> Giờ bắt đầu (vd: 08h00)
              </label>
              <input 
                type="text" 
                name="time"
                placeholder="Bỏ trống khi cả ngày..."
                value={formData.time || ''} 
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-all"
              />
            </div>
            
            {/* Loại hình */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Type className="w-4 h-4 text-slate-400" /> Loại hình
              </label>
              <select 
                name="type"
                value={formData.type || 'meeting'} 
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-all appearance-none cursor-pointer"
              >
                <option value="meeting">Hội nghị / Cuộc họp</option>
                <option value="office_work">Làm việc CQ</option>
                <option value="other">Sự kiện khác</option>
                <option value="holiday">Nghỉ</option>
              </select>
            </div>
          </div>

          {/* Nội dung */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <AlignLeft className="w-4 h-4 text-blue-500" /> Nội dung công việc <span className="text-rose-500">*</span>
            </label>
            <textarea 
              name="content"
              required
              rows={3}
              placeholder="Nhập nội dung sự kiện..."
              value={formData.content || ''} 
              onChange={handleChange}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-all resize-none font-admin text-[14.5px] sm:text-[15.5px] leading-relaxed"
            />
          </div>

          {/* Chủ trì */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <User className="w-4 h-4 text-slate-400" /> Chủ trì
            </label>
            <input 
              type="text" 
              name="host"
              placeholder="Đ/c, tên nhóm, chức danh..."
              value={formData.host || ''} 
              onChange={handleChange}
              list="host-suggestions"
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-all"
            />
            <datalist id="host-suggestions">
              <option value="Bí thư" />
              <option value="Phó Bí thư Thường trực" />
              <option value="Phó Bí thư" />
              <option value="TTĐU" />
            </datalist>
          </div>

          {/* Địa điểm */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-slate-400" /> Địa điểm
            </label>
            <input 
              type="text" 
              name="location"
              placeholder="Hội trường, phòng họp..."
              value={formData.location || ''} 
              onChange={handleChange}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-all"
            />
          </div>

          {/* Thành phần & Chuẩn bị */}
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-slate-400" /> Thành phần tham dự
              </label>
              <textarea 
                name="attendees"
                rows={2}
                placeholder="Các thành phần tham dự..."
                value={formData.attendees || ''} 
                onChange={handleChange}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-all resize-none text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-slate-400" /> Đơn vị chuẩn bị
              </label>
              <textarea 
                name="prepare_by"
                rows={2}
                placeholder="Văn phòng, Ban Tổ chức..."
                value={formData.prepare_by || ''} 
                onChange={handleChange}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-all resize-none text-sm"
              />
            </div>
          </div>

        </form>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30">
          <div>
            {initialData?.id && !initialData.id.toString().startsWith('temp_auto_') && onDelete && (
              <button 
                type="button"
                onClick={() => onDelete(initialData.id)}
                className="px-4 py-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 font-medium rounded-xl transition-colors"
              >
                Xóa sự kiện
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button 
              type="button"
              onClick={onClose} 
              className="px-5 py-2 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
            >
              Hủy
            </button>
            <button 
              type="button"
              onClick={handleSubmit} 
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 active:scale-95"
            >
              Lưu sự kiện
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
