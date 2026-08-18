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
const API_BASE = '/api/calendar-attachments';

// Suy ra mime type từ phần mở rộng khi trình duyệt không cung cấp (một số máy báo file.type rỗng)
const EXT_MIME = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp'
};

const ALLOWED_MIME_TYPES = Object.values(EXT_MIME);

const resolveMimeType = (file) => {
  if (file.type && ALLOWED_MIME_TYPES.includes(file.type)) return file.type;
  const ext = file.name.split('.').pop().toLowerCase();
  return EXT_MIME[ext] || file.type || 'application/octet-stream';
};

/**
 * Upload file đính kèm cho sự kiện — luồng presigned URL (PUT thẳng lên R2).
 * Bỏ qua trần ~4.5MB của Vercel Serverless Function, hỗ trợ tối đa 5MB.
 * Gồm 3 bước: xin link (presign) → PUT lên R2 → xác nhận (confirm) ghi DB.
 */
export const uploadCalendarAttachment = async (eventId, file) => {
  try {
    const headers = await getAuthHeaders();
    const mimeType = resolveMimeType(file);

    // 1. Xin presigned URL
    const presignRes = await fetch(`${API_BASE}?action=presign-upload&eventId=${eventId}`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: file.name, fileSize: file.size, mimeType })
    });
    const presignText = await presignRes.text();
    if (!presignRes.ok) {
      let e = {};
      try { e = JSON.parse(presignText); } catch (_) {}
      throw new Error(e.error || `Lấy link tải thất bại (${presignRes.status})`);
    }
    const { uploadUrl, objectKey } = JSON.parse(presignText);

    // 2. PUT thẳng file lên R2. Content-Type phải khớp lúc ký để chữ ký hợp lệ.
    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': mimeType },
      body: file
    });
    if (!putRes.ok) {
      throw new Error(`Tải tệp lên R2 thất bại (${putRes.status})`);
    }

    // 3. Xác nhận để server kiểm tra & ghi metadata vào DB
    const confirmRes = await fetch(`${API_BASE}?action=confirm-upload&eventId=${eventId}`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ objectKey, fileName: file.name, fileSize: file.size, mimeType })
    });
    const confirmText = await confirmRes.text();
    if (!confirmRes.ok) {
      let e = {};
      try { e = JSON.parse(confirmText); } catch (_) {}
      throw new Error(e.error || `Xác nhận tải lên thất bại (${confirmRes.status})`);
    }
    const result = JSON.parse(confirmText);
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
    const response = await fetch(`${API_BASE}?action=get-signed-url&attachmentId=${attachmentId}`, {
      method: 'GET',
      headers
    });

    const responseText = await response.text();
    if (!response.ok) {
      let errorData = {};
      try { errorData = JSON.parse(responseText); } catch (e) {}
      throw new Error(errorData.error || `Upload failed with status ${response.status}: ${responseText.substring(0, 50)}`);
    }
    
    try {
      return JSON.parse(responseText);
    } catch (e) {
      throw new Error(`Lỗi parse JSON. Server trả về: ${responseText.substring(0, 100)}`);
    } // { downloadUrl, fileName, mimeType }
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
    const response = await fetch(`${API_BASE}?action=delete&attachmentId=${attachmentId}`, {
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
