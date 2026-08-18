import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

// Disable default body parser to handle multipart/form-data with formidable
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper response functions
const ok = (res, d = {}) => res.status(200).json({ success: true, ...d });
const err = (res, s, m) => res.status(s).json({ success: false, error: m });

// Initialize S3 Client for Cloudflare R2
const s3Client = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT_SERVER || 'http://localhost:9000',
  region: process.env.MINIO_REGION || 'auto',
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY,
    secretAccessKey: process.env.MINIO_SECRET_KEY,
  },
  forcePathStyle: true,
});

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp'
];

const FORBIDDEN_EXTS = ['.exe', '.bat', '.cmd', '.js', '.html', '.php', '.zip', '.rar', '.7z', '.sh', '.msi'];

// Đọc body JSON thủ công vì bodyParser đã bị tắt (dùng cho luồng presigned URL)
const readJsonBody = (req) => new Promise((resolve, reject) => {
  let data = '';
  req.on('data', (chunk) => {
    data += chunk;
    if (data.length > 1024 * 1024) { // Chặn body JSON quá lớn (metadata thôi, không phải file)
      reject(new Error('Body quá lớn'));
      req.destroy();
    }
  });
  req.on('end', () => {
    try { resolve(data ? JSON.parse(data) : {}); }
    catch (e) { reject(e); }
  });
  req.on('error', reject);
});

// Kiểm tra metadata tệp (tên, kích thước, mime) — trả về chuỗi lỗi hoặc null nếu hợp lệ
const validateFileMeta = ({ fileName, fileSize, mimeType }) => {
  if (!fileName) return 'Thiếu tên tệp';
  if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType)) {
    return 'Định dạng tệp không được hỗ trợ (Chỉ hỗ trợ Word, PDF, Ảnh)';
  }
  const ext = path.extname(fileName).toLowerCase();
  if (FORBIDDEN_EXTS.includes(ext)) return 'Định dạng tệp không được phép tải lên';
  if (typeof fileSize === 'number' && fileSize > MAX_FILE_SIZE) return 'Kích thước tệp vượt quá 5MB';
  return null;
};

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,GET,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action, eventId, attachmentId } = req.query;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return err(res, 500, 'Thiếu cấu hình Supabase trên máy chủ');
  }

  const targetBucket = process.env.CLOUDFLARE_R2_BUCKET_NAME || process.env.MINIO_CHAT_BUCKET || 'message-attachments';

  // Handle Public Endpoints (No Auth Required)
  if (req.method === 'GET' && action === 'public-get-signed-url') {
    if (!attachmentId) return err(res, 400, 'Thiếu attachmentId');
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });
    
    try {
      const { data: attachment, error: fetchErr } = await supabaseAdmin
        .from('calendar_event_attachments')
        .select('*')
        .eq('id', attachmentId)
        .single();

      if (fetchErr || !attachment) return err(res, 404, 'Không tìm thấy tệp đính kèm');

      const command = new GetObjectCommand({
        Bucket: targetBucket,
        Key: attachment.file_path,
        ResponseContentDisposition: `inline; filename="${encodeURIComponent(attachment.file_name)}"`,
        ResponseContentType: attachment.mime_type || 'application/octet-stream'
      });

      const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      return ok(res, { downloadUrl, fileName: attachment.file_name, mimeType: attachment.mime_type });
    } catch (e) {
      return err(res, 500, 'Lỗi public get signed url: ' + e.message);
    }
  }

  // Authenticate User for other endpoints
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return err(res, 401, 'Không có quyền truy cập. Vui lòng đăng nhập.');
  }

  const token = authHeader.split(' ')[1];

  let user;
  let authClient;
  let supabaseAdmin;
  try {
    authClient = createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY, {
      auth: { persistSession: false }
    });
    
    // Admin client to bypass RLS for inserts if needed, but better to use user token
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } } // Pass user token to respect RLS
    });

    const { data: { user: authUser }, error: authErr } = await authClient.auth.getUser(token);
    if (authErr || !authUser) {
      return err(res, 401, 'Token không hợp lệ hoặc đã hết hạn: ' + (authErr?.message || ''));
    }
    user = authUser;
  } catch (e) {
    return err(res, 500, 'Lỗi xác thực người dùng: ' + e.message);
  }

  // Permission Check
  const { data: profile } = await supabaseAdmin.from('profiles').select('role, can_manage_schedules').eq('id', user.id).single();
  const role = profile?.role;
  // Đồng bộ với canManageSchedules() ở frontend: admin/manager HOẶC được cấp quyền quản lý lịch qua cột can_manage_schedules
  const canEdit = role === 'admin' || role === 'manager' || !!profile?.can_manage_schedules;
  const canView = true; // Any authenticated user can view

  try {
    // ----------------------------------------------------------------------
    // GET: SIGNED URL
    // ----------------------------------------------------------------------
    if (req.method === 'GET' && action === 'get-signed-url') {
      if (!canView) return err(res, 403, 'Bạn không có quyền xem tệp đính kèm.');
      if (!attachmentId) return err(res, 400, 'Thiếu attachmentId');

      // 1. Get metadata from DB
      const { data: attachment, error: fetchErr } = await supabaseAdmin
        .from('calendar_event_attachments')
        .select('*')
        .eq('id', attachmentId)
        .single();

      if (fetchErr || !attachment) {
        return err(res, 404, 'Không tìm thấy tệp đính kèm trong cơ sở dữ liệu');
      }

      // 2. Generate signed URL
      const command = new GetObjectCommand({
        Bucket: targetBucket,
        Key: attachment.file_path,
      });

      // Expire in 15 mins (900s)
      const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
      return ok(res, { downloadUrl, fileName: attachment.file_name, mimeType: attachment.mime_type });

    // ----------------------------------------------------------------------
    // POST: PRESIGN UPLOAD (cấp URL để client PUT thẳng lên R2, vượt trần 4.5MB của Vercel)
    // ----------------------------------------------------------------------
    } else if (req.method === 'POST' && action === 'presign-upload') {
      if (!canEdit) return err(res, 403, 'Bạn không có quyền tải lên tệp đính kèm.');
      if (!eventId) return err(res, 400, 'Thiếu eventId');

      let body;
      try { body = await readJsonBody(req); }
      catch (e) { return err(res, 400, 'Dữ liệu yêu cầu không hợp lệ'); }

      const { fileName, fileSize, mimeType } = body;
      const metaErr = validateFileMeta({ fileName, fileSize, mimeType });
      if (metaErr) return err(res, 400, metaErr);

      // Xác minh sự kiện tồn tại
      const { data: event, error: eventErr } = await supabaseAdmin
        .from('schedule_items')
        .select('id')
        .eq('id', eventId)
        .single();
      if (eventErr || !event) return err(res, 404, 'Không tìm thấy sự kiện tương ứng');

      const safeFileName = String(fileName).replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase();
      const objectKey = `events/${eventId}/${Date.now()}_${safeFileName}`;

      try {
        const putCommand = new PutObjectCommand({
          Bucket: targetBucket,
          Key: objectKey,
          ContentType: mimeType,
        });
        // URL có hiệu lực 5 phút, đủ để client tải lên
        const uploadUrl = await getSignedUrl(s3Client, putCommand, { expiresIn: 300 });
        return ok(res, { uploadUrl, objectKey });
      } catch (e) {
        return err(res, 500, 'Không tạo được link tải lên: ' + e.message);
      }

    // ----------------------------------------------------------------------
    // POST: CONFIRM UPLOAD (sau khi PUT thành công, xác minh & ghi metadata vào DB)
    // ----------------------------------------------------------------------
    } else if (req.method === 'POST' && action === 'confirm-upload') {
      if (!canEdit) return err(res, 403, 'Bạn không có quyền tải lên tệp đính kèm.');
      if (!eventId) return err(res, 400, 'Thiếu eventId');

      let body;
      try { body = await readJsonBody(req); }
      catch (e) { return err(res, 400, 'Dữ liệu yêu cầu không hợp lệ'); }

      const { objectKey, fileName, mimeType } = body;
      // objectKey bắt buộc phải thuộc đúng sự kiện này (chống ghi đè key tùy ý)
      if (!objectKey || !String(objectKey).startsWith(`events/${eventId}/`)) {
        return err(res, 400, 'Thông tin tệp không hợp lệ');
      }
      const metaErr = validateFileMeta({ fileName, mimeType });
      if (metaErr) return err(res, 400, metaErr);

      // Xác minh tệp đã thực sự tồn tại trên R2 và kiểm tra kích thước thật
      let head;
      try {
        head = await s3Client.send(new HeadObjectCommand({ Bucket: targetBucket, Key: objectKey }));
      } catch (e) {
        return err(res, 400, 'Không tìm thấy tệp đã tải lên trên R2');
      }

      const actualSize = head.ContentLength || 0;
      if (actualSize > MAX_FILE_SIZE) {
        // Client PUT vượt trần → xóa object và từ chối
        try { await s3Client.send(new DeleteObjectCommand({ Bucket: targetBucket, Key: objectKey })); } catch (_) {}
        return err(res, 400, 'Kích thước tệp vượt quá 5MB');
      }

      const ext = path.extname(fileName).toLowerCase();
      const { data: newAttachment, error: insertErr } = await supabaseAdmin
        .from('calendar_event_attachments')
        .insert([{
          event_id: eventId,
          file_name: fileName,
          file_path: objectKey,
          file_type: ext.substring(1) || 'unknown',
          mime_type: mimeType,
          file_size: actualSize,
          r2_bucket: targetBucket,
          uploaded_by: user.id
        }])
        .select()
        .single();

      if (insertErr) {
        // Rollback: xóa object khỏi R2
        try { await s3Client.send(new DeleteObjectCommand({ Bucket: targetBucket, Key: objectKey })); } catch (_) {}
        return err(res, 500, 'Lưu dữ liệu tệp thất bại, đã hủy tải lên');
      }

      return ok(res, { attachment: newAttachment });

    // ----------------------------------------------------------------------
    // POST: UPLOAD (luồng cũ qua formidable — giữ làm dự phòng, giới hạn ~4.5MB)
    // ----------------------------------------------------------------------
    } else if (req.method === 'POST' && action === 'upload') {
      if (!canEdit) return err(res, 403, 'Bạn không có quyền tải lên tệp đính kèm.');
      if (!eventId) return err(res, 400, 'Thiếu eventId');

      // Verify event exists
      const { data: event, error: eventErr } = await supabaseAdmin
        .from('schedule_items')
        .select('id')
        .eq('id', eventId)
        .single();
        
      if (eventErr || !event) {
        return err(res, 404, 'Không tìm thấy sự kiện tương ứng');
      }

      const form = formidable({
        maxFileSize: MAX_FILE_SIZE,
        keepExtensions: true,
      });

      return new Promise((resolve) => {
        form.parse(req, async (errForm, fields, files) => {
          if (errForm) {
            if (errForm.code === '1009') { // Formidable limits
              return resolve(err(res, 400, 'Kích thước tệp vượt quá 5MB'));
            }
            return resolve(err(res, 500, 'Lỗi xử lý file upload'));
          }

          const fileArray = Array.isArray(files.file) ? files.file : [files.file];
          const uploadedFile = fileArray[0];

          if (!uploadedFile) {
            return resolve(err(res, 400, 'Không tìm thấy tệp tải lên'));
          }

          // Validate Mime Type
          if (!ALLOWED_MIME_TYPES.includes(uploadedFile.mimetype)) {
            return resolve(err(res, 400, 'Định dạng tệp không được hỗ trợ (Chỉ hỗ trợ Word, PDF, Ảnh)'));
          }

          // Validate Extension explicitly
          const ext = path.extname(uploadedFile.originalFilename).toLowerCase();
          const forbiddenExts = ['.exe', '.bat', '.cmd', '.js', '.html', '.php', '.zip', '.rar', '.7z', '.sh', '.msi'];
          if (forbiddenExts.includes(ext)) {
            return resolve(err(res, 400, 'Định dạng tệp không được phép tải lên'));
          }

          // Read file buffer
          let fileBuffer;
          try {
            fileBuffer = fs.readFileSync(uploadedFile.filepath);
          } catch (e) {
            return resolve(err(res, 500, 'Không thể đọc tệp đã tải lên'));
          }

          // Create path: calendar-events/{event_id}/{timestamp_slug_filename}
          const safeFileName = uploadedFile.originalFilename
            .replace(/[^a-zA-Z0-9.-]/g, '_')
            .toLowerCase();
          const objectKey = `events/${eventId}/${Date.now()}_${safeFileName}`;

          try {
            // Upload to Cloudflare R2 / MinIO
            const putCommand = new PutObjectCommand({
              Bucket: targetBucket,
              Key: objectKey,
              Body: fileBuffer,
              ContentType: uploadedFile.mimetype,
            });

            await s3Client.send(putCommand);

            // Insert Metadata to DB
            const { data: newAttachment, error: insertErr } = await supabaseAdmin
              .from('calendar_event_attachments')
              .insert([{
                event_id: eventId,
                file_name: uploadedFile.originalFilename,
                file_path: objectKey,
                file_type: ext.substring(1) || 'unknown',
                mime_type: uploadedFile.mimetype,
                file_size: uploadedFile.size,
                r2_bucket: targetBucket,
                uploaded_by: user.id
              }])
              .select()
              .single();

            if (insertErr) {
              // Rollback: delete from R2
              try {
                await s3Client.send(new DeleteObjectCommand({ Bucket: targetBucket, Key: objectKey }));
              } catch (delErr) {
                console.error('Failed to rollback file from R2', delErr);
              }
              return resolve(err(res, 500, 'Lưu dữ liệu tệp thất bại, đã hủy tải lên'));
            }

            // Cleanup temp file
            fs.unlink(uploadedFile.filepath, () => {});

            return resolve(ok(res, { attachment: newAttachment }));

          } catch (uploadError) {
            return resolve(err(res, 500, 'Lỗi tải tệp lên Cloudflare R2: ' + uploadError.message));
          }
        });
      });

    // ----------------------------------------------------------------------
    // DELETE: DELETE FILE
    // ----------------------------------------------------------------------
    } else if (req.method === 'DELETE' && action === 'delete') {
      if (!canEdit) return err(res, 403, 'Bạn không có quyền xóa tệp đính kèm.');
      if (!attachmentId) return err(res, 400, 'Thiếu attachmentId');

      // 1. Get metadata
      const { data: attachment, error: fetchErr } = await supabaseAdmin
        .from('calendar_event_attachments')
        .select('*')
        .eq('id', attachmentId)
        .single();

      if (fetchErr || !attachment) {
        return err(res, 404, 'Không tìm thấy tệp đính kèm');
      }

      try {
        // 2. Delete from R2
        const deleteCommand = new DeleteObjectCommand({
          Bucket: targetBucket,
          Key: attachment.file_path,
        });
        await s3Client.send(deleteCommand);

        // 3. Delete from DB
        const { error: dbDelErr } = await supabaseAdmin
          .from('calendar_event_attachments')
          .delete()
          .eq('id', attachmentId);

        if (dbDelErr) throw dbDelErr;

        return ok(res, { message: 'Đã xóa tệp đính kèm' });

      } catch (deleteError) {
        return err(res, 500, 'Lỗi khi xóa tệp đính kèm: ' + deleteError.message);
      }

    } else {
      return err(res, 404, 'Endpoint không tồn tại hoặc sai phương thức');
    }

  } catch (globalError) {
    console.error('[CalendarAttachmentError]', globalError);
    return err(res, 500, 'Lỗi hệ thống: ' + globalError.message);
  }
}
