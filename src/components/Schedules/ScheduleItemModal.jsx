import React, { useState, useEffect, useRef } from 'react';
import { X, Calendar, Clock, MapPin, Users, User, Type, AlignLeft, Paperclip, Download, Eye, Loader2, Trash2, File as FileIcon } from 'lucide-react';
import { determineSession } from '../../utils/scheduleUtils';
import { useAuth } from '../../context/AuthContext';
import { canManageSchedules } from '../../lib/permissions';
import { 
  uploadCalendarAttachment, 
  getCalendarAttachments, 
  getCalendarAttachmentSignedUrl, 
  deleteCalendarAttachment,
  formatFileSize,
  getFileIcon
} from '../../services/calendarAttachmentService';
import toast from 'react-hot-toast';
import AttachmentPreviewModal from './AttachmentPreviewModal';

export default function ScheduleItemModal({ isOpen, onClose, onSave, onDelete, initialData }) {
  const { profile } = useAuth();
  const canEdit = canManageSchedules(profile);
  
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
    pendingAttachments: [], // Lưu file chưa upload
    ...initialData
  });

  const [attachments, setAttachments] = useState([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const [previewState, setPreviewState] = useState({
    isOpen: false,
    attachment: null,
    signedUrl: null,
    loading: false,
    error: null
  });

  useEffect(() => {
    if (isOpen && initialData) {
      const initTime = initialData.time || '';
      const isRedundant = ['sáng', 'chiều', 'tối', 'cả ngày'].includes(initTime.toLowerCase().trim());
      const determined = determineSession(initialData);

      setFormData({
        ...formData,
        ...initialData,
        session: initialData.session || determined || 'Sáng',
        time: isRedundant ? '' : initTime,
        pendingAttachments: initialData.pendingAttachments || []
      });

      // Load attachments if it's an existing event
      if (initialData.id && !initialData.id.toString().startsWith('temp_')) {
        loadAttachments(initialData.id);
      }
    }
  }, [isOpen, initialData]);

  const loadAttachments = async (eventId) => {
    setLoadingAttachments(true);
    try {
      const data = await getCalendarAttachments(eventId);
      setAttachments(data);
    } catch (error) {
      toast.error('Không thể tải danh sách tệp đính kèm');
    } finally {
      setLoadingAttachments(false);
    }
  };

  if (!isOpen) return null;

  const handleChange = (e) => {
    if (!canEdit) return;
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;

    // Validate
    const validFiles = [];
    for (const file of files) {
      if (file.size > 3 * 1024 * 1024) {
        toast.error(`Tệp "${file.name}" vượt quá 3MB`);
        continue;
      }
      const ext = file.name.split('.').pop().toLowerCase();
      const forbiddenExts = ['exe', 'bat', 'cmd', 'js', 'html', 'php', 'zip', 'rar', '7z', 'sh', 'msi'];
      if (forbiddenExts.includes(ext)) {
        toast.error(`Tệp "${file.name}" không đúng định dạng`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    // Nếu sự kiện đã lưu DB, upload trực tiếp
    if (formData.id && !formData.id.toString().startsWith('temp_')) {
      setUploading(true);
      try {
        for (const file of validFiles) {
          await uploadCalendarAttachment(formData.id, file);
        }
        toast.success('Đã tải lên tệp đính kèm');
        await loadAttachments(formData.id);
      } catch (error) {
        toast.error(error.message || 'Lỗi khi tải lên tệp');
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } else {
      // Nếu sự kiện mới, lưu vào pending
      setFormData(prev => ({
        ...prev,
        pendingAttachments: [...(prev.pendingAttachments || []), ...validFiles]
      }));
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePendingFile = (index) => {
    setFormData(prev => ({
      ...prev,
      pendingAttachments: prev.pendingAttachments.filter((_, i) => i !== index)
    }));
  };

  const handleDeleteAttachment = async (attachmentId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa tệp đính kèm này không? File sẽ bị xóa khỏi Cloudflare R2 và không thể khôi phục.')) {
      return;
    }
    try {
      await deleteCalendarAttachment(attachmentId);
      toast.success('Đã xóa tệp đính kèm');
      setAttachments(prev => prev.filter(a => a.id !== attachmentId));
    } catch (error) {
      toast.error('Lỗi khi xóa tệp: ' + error.message);
    }
  };

  const handleViewAttachment = async (attachment) => {
    setPreviewState({
      isOpen: true,
      attachment,
      signedUrl: null,
      loading: true,
      error: null
    });

    try {
      const { downloadUrl } = await getCalendarAttachmentSignedUrl(attachment.id);
      
      setPreviewState(prev => ({
        ...prev,
        signedUrl: downloadUrl,
        loading: false
      }));
    } catch (error) {
      setPreviewState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Không thể xem tệp này. Bạn không có quyền hoặc tệp đã bị lỗi.'
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canEdit) return;
    
    if (!formData.date || !formData.content) {
      alert("Vui lòng nhập Ngày và Nội dung");
      return;
    }
    const dataToSave = { ...formData };

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
            {initialData?.id ? (canEdit ? 'Chỉnh sửa sự kiện' : 'Chi tiết sự kiện') : 'Thêm sự kiện'}
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
                disabled={!canEdit}
                value={formData.date || ''} 
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              />
            </div>

            {/* Buổi */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-500" /> Buổi <span className="text-rose-500">*</span>
              </label>
              <select 
                name="session"
                disabled={!canEdit}
                value={formData.session || 'Sáng'} 
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-all appearance-none disabled:opacity-70 disabled:cursor-not-allowed"
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
                disabled={!canEdit}
                placeholder="Bỏ trống khi cả ngày..."
                value={formData.time || ''} 
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              />
            </div>
            
            {/* Loại hình */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Type className="w-4 h-4 text-slate-400" /> Loại hình
              </label>
              <select 
                name="type"
                disabled={!canEdit}
                value={formData.type || 'meeting'} 
                onChange={handleChange}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-all appearance-none disabled:opacity-70 disabled:cursor-not-allowed"
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
              disabled={!canEdit}
              rows={3}
              placeholder="Nhập nội dung sự kiện..."
              value={formData.content || ''} 
              onChange={handleChange}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-all resize-none font-admin text-[14.5px] sm:text-[15.5px] leading-relaxed disabled:opacity-70 disabled:cursor-not-allowed"
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
              disabled={!canEdit}
              placeholder="Đ/c, tên nhóm, chức danh..."
              value={formData.host || ''} 
              onChange={handleChange}
              list="host-suggestions"
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-all disabled:opacity-70 disabled:cursor-not-allowed"
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
              disabled={!canEdit}
              placeholder="Hội trường, phòng họp..."
              value={formData.location || ''} 
              onChange={handleChange}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-all disabled:opacity-70 disabled:cursor-not-allowed"
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
                disabled={!canEdit}
                rows={2}
                placeholder="Các thành phần tham dự..."
                value={formData.attendees || ''} 
                onChange={handleChange}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-all resize-none text-sm disabled:opacity-70 disabled:cursor-not-allowed"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-slate-400" /> Đơn vị chuẩn bị
              </label>
              <textarea 
                name="prepare_by"
                disabled={!canEdit}
                rows={2}
                placeholder="Văn phòng, Ban Tổ chức..."
                value={formData.prepare_by || ''} 
                onChange={handleChange}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white transition-all resize-none text-sm disabled:opacity-70 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Tệp đính kèm Area */}
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-700/50">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Paperclip className="w-4 h-4 text-blue-500" /> Tệp đính kèm
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">Hỗ trợ Word, PDF, hình ảnh. Tối đa 3MB/tệp.</p>
              </div>
              
              {canEdit && (
                <div>
                  <input 
                    type="file" 
                    multiple 
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
                    className="hidden" 
                  />
                  <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 font-semibold text-xs rounded-lg transition-colors border border-blue-100 dark:border-blue-800/50"
                  >
                    {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
                    Chọn tệp
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              {loadingAttachments && (
                <div className="flex items-center gap-2 text-sm text-slate-500 p-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Đang tải tệp đính kèm...
                </div>
              )}

              {/* Danh sách file đã upload (từ database) */}
              {attachments.map((file) => (
                <div key={file.id} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl group hover:border-blue-300 transition-all">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-700 shadow-sm">
                      {getFileIcon(file.file_name) === 'pdf' && <span className="text-rose-500 font-bold text-[10px]">PDF</span>}
                      {getFileIcon(file.file_name) === 'word' && <span className="text-blue-600 font-bold text-[10px]">DOC</span>}
                      {getFileIcon(file.file_name) === 'image' && <span className="text-emerald-500 font-bold text-[10px]">IMG</span>}
                      {getFileIcon(file.file_name) === 'file' && <FileIcon className="w-4 h-4 text-slate-400" />}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">{file.file_name}</span>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span>{formatFileSize(file.file_size)}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                        <span className="text-emerald-600 dark:text-emerald-400">Đã lưu</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <button 
                      type="button" 
                      onClick={() => handleViewAttachment(file)}
                      className="p-1.5 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-md transition-colors"
                      title="Xem / Tải xuống"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {canEdit && (
                      <button 
                        type="button" 
                        onClick={() => handleDeleteAttachment(file.id)}
                        className="p-1.5 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-md transition-colors"
                        title="Xóa tệp"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* Danh sách file đang pending chờ upload (khi tạo sự kiện mới) */}
              {formData.pendingAttachments?.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-2.5 bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-900/30 rounded-xl">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-700 shadow-sm">
                      <FileIcon className="w-4 h-4 text-orange-400" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">{file.name}</span>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span>{formatFileSize(file.size)}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                        <span className="text-orange-600 dark:text-orange-400 italic">Chờ lưu...</span>
                      </div>
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <button 
                        type="button" 
                        onClick={() => handleRemovePendingFile(index)}
                        className="p-1.5 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-md transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {!loadingAttachments && attachments.length === 0 && (!formData.pendingAttachments || formData.pendingAttachments.length === 0) && (
                <div className="text-center py-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-900/20">
                  <p className="text-xs text-slate-500 font-medium">Chưa có tệp đính kèm nào</p>
                </div>
              )}
            </div>
          </div>

        </form>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30">
          <div>
            {canEdit && initialData?.id && !initialData.id.toString().startsWith('temp_auto_') && onDelete && (
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
              {canEdit ? 'Hủy' : 'Đóng'}
            </button>
            {canEdit && (
              <button 
                type="button"
                onClick={handleSubmit} 
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md shadow-blue-500/20 active:scale-95"
              >
                Lưu sự kiện
              </button>
            )}
          </div>
        </div>

      </div>
      
      <AttachmentPreviewModal 
        isOpen={previewState.isOpen}
        onClose={() => setPreviewState(prev => ({ ...prev, isOpen: false }))}
        attachment={previewState.attachment}
        signedUrl={previewState.signedUrl}
        loading={previewState.loading}
        error={previewState.error}
      />
    </div>
  );
}
