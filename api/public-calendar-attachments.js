import { createClient } from '@supabase/supabase-js';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Helper response functions
const ok = (res, d = {}) => res.status(200).json({ success: true, ...d });
const err = (res, s, m) => res.status(s).json({ success: false, error: m });

// Initialize S3 Client for Cloudflare R2
const s3Client = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT_SERVER || 'http://localhost:9000',
  region: process.env.MINIO_REGION || 'auto',
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || 'admin_vpdu',
    secretAccessKey: process.env.MINIO_SECRET_KEY || 'VpduPassword2026!',
  },
  forcePathStyle: true,
});

export default async function handler(req, res) {
  // CORS Headers for public access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return err(res, 405, 'Phương thức không được hỗ trợ');
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return err(res, 500, 'Thiếu cấu hình Supabase trên máy chủ');
  }

  // Use admin client since this is a public proxy endpoint
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });

  const { action, eventId, attachmentId } = req.query;
  const targetBucket = process.env.CLOUDFLARE_R2_BUCKET_NAME || process.env.MINIO_CHAT_BUCKET || 'message-attachments';

  try {
    // ----------------------------------------------------------------------
    // GET: LIST FILES
    // ----------------------------------------------------------------------
    if (action === 'list') {
      if (!eventId) return err(res, 400, 'Thiếu eventId');

      const { data: attachments, error: fetchErr } = await supabaseAdmin
        .from('calendar_event_attachments')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });

      if (fetchErr) {
        return err(res, 500, 'Lỗi truy vấn cơ sở dữ liệu');
      }

      return ok(res, { files: attachments || [] });

    // ----------------------------------------------------------------------
    // GET: SIGNED URL
    // ----------------------------------------------------------------------
    } else if (action === 'get-signed-url') {
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
        ResponseContentDisposition: `inline; filename="${encodeURIComponent(attachment.file_name)}"`,
        ResponseContentType: attachment.mime_type || 'application/octet-stream'
      });

      // Expire in 60 mins (3600s) for public links
      const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      return ok(res, { downloadUrl, fileName: attachment.file_name, mimeType: attachment.mime_type });

    } else {
      return err(res, 404, 'Hành động không hợp lệ');
    }

  } catch (globalError) {
    console.error('[PublicCalendarAttachmentError]', globalError);
    return err(res, 500, 'Lỗi hệ thống: ' + globalError.message);
  }
}
