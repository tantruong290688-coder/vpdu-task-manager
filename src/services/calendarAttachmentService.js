import { supabase } from '../lib/supabase';

// Helper: Get Authorization header with Supabase token
const getAuthHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  }
  return {
    'Authorization': `Bearer ${session.access_token}`
  };
};

// Cấu hình URL endpoint
const API_BASE = '/api/calendar-events';

/**
 * Upload file đính kèm cho sự kiện
 * POST /api/calendar-events/:eventId/attachments
 */
export const uploadCalendarAttachment = async (eventId, file) => {
  try {
    const headers = await getAuthHeaders();
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/${eventId}/attachments`, {
      method: 'POST',
      headers,
      body: formData
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Lỗi khi tải lên tệp đính kèm');
    }

    return result.attachment;
  } catch (error) {
    console.error('[CalendarAttachmentService] upload error:', error);
    throw error;
  }
};

/**
 * Lấy danh sách tệp đính kèm của sự kiện (truy vấn trực tiếp DB)
 */
export const getCalendarAttachments = async (eventId) => {
  try {
    const { data, error } = await supabase
      .from('calendar_event_attachments')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[CalendarAttachmentService] get list error:', error);
    throw error;
  }
};

/**
 * Lấy Signed URL để xem/tải tệp
 * GET /api/calendar-events/attachments/:attachmentId/signed-url
 */
export const getCalendarAttachmentSignedUrl = async (attachmentId) => {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/attachments/${attachmentId}/signed-url`, {
      method: 'GET',
      headers
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Lỗi khi tạo liên kết truy cập');
    }

    return result; // { downloadUrl, fileName, mimeType }
  } catch (error) {
    console.error('[CalendarAttachmentService] get signed URL error:', error);
    throw error;
  }
};

/**
 * Xóa tệp đính kèm
 * DELETE /api/calendar-events/attachments/:attachmentId
 */
export const deleteCalendarAttachment = async (attachmentId) => {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/attachments/${attachmentId}`, {
      method: 'DELETE',
      headers
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Lỗi khi xóa tệp đính kèm');
    }

    return true;
  } catch (error) {
    console.error('[CalendarAttachmentService] delete error:', error);
    throw error;
  }
};

// Utilities for formatting
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const getFileIcon = (fileName = '') => {
  const ext = fileName.split('.').pop().toLowerCase();
  if (['doc', 'docx'].includes(ext)) return 'word';
  if (['pdf'].includes(ext)) return 'pdf';
  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return 'image';
  return 'file';
};
