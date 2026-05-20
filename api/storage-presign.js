import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Helper response functions
const ok = (res, d = {}) => res.status(200).json({ success: true, ...d });
const err = (res, s, m) => res.status(s).json({ error: m });

// Initialize S3 Client for MinIO
const s3Client = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT_SERVER || 'http://localhost:9000',
  region: 'us-east-1', // Default value required by AWS SDK
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || 'admin_vpdu',
    secretAccessKey: process.env.MINIO_SECRET_KEY || 'VpduPassword2026!',
  },
  forcePathStyle: true, // Necessary for MinIO compatibility
});

export default async function handler(req, res) {
  // ── CORS Headers ────────────────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return err(res, 405, 'Phương thức không được hỗ trợ');
  }

  // ── Authenticate User with Supabase Token ──────────────────────────────────
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return err(res, 401, 'Không có quyền truy cập. Vui lòng đăng nhập.');
  }

  const token = authHeader.split(' ')[1];
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return err(res, 500, 'Thiếu cấu hình Supabase trên máy chủ');
  }

  let user;
  try {
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false }
    });

    const { data: { user: authUser }, error: authErr } = await authClient.auth.getUser(token);
    if (authErr || !authUser) {
      return err(res, 401, 'Token không hợp lệ hoặc đã hết hạn: ' + (authErr?.message || ''));
    }
    user = authUser;
  } catch (e) {
    return err(res, 500, 'Lỗi xác thực người dùng: ' + e.message);
  }

  // ── Process Request ────────────────────────────────────────────────────────
  const { action, bucket, filePath, fileType } = req.body || {};

  if (!action || !bucket || !filePath) {
    return err(res, 400, 'Thiếu tham số bắt buộc (action, bucket, filePath)');
  }

  const minioAvatarBucket = process.env.MINIO_AVATAR_BUCKET || 'avatars';
  const minioChatBucket = process.env.MINIO_CHAT_BUCKET || 'message-attachments';

  // Map bucket name from client to actual MinIO bucket name
  let targetBucket = bucket;
  if (bucket === 'avatars') targetBucket = minioAvatarBucket;
  if (bucket === 'message-attachments') targetBucket = minioChatBucket;

  try {
    if (action === 'getUploadUrl') {
      // ── Enforce Folder Security Rules for Upload ───────────────────────────
      if (bucket === 'avatars') {
        // Avatars must be saved in a folder named after the user's ID
        if (!filePath.startsWith(`${user.id}/`)) {
          return err(res, 403, 'Từ chối truy cập: Bạn chỉ có thể tải lên ảnh đại diện của chính mình');
        }
      } else if (bucket === 'message-attachments') {
        // Chat attachments path structure:
        // - private_{receiverId}/{senderId}/{fileName}
        // - room_{roomId}/{senderId}/{fileName}
        // The senderId (second folder level) MUST match the authenticated user.id
        const parts = filePath.split('/');
        if (parts.length < 2 || parts[1] !== user.id) {
          return err(res, 403, 'Từ chối truy cập: Đường dẫn tệp đính kèm không hợp lệ hoặc không có quyền gửi');
        }
      }

      // Generate Presigned PUT URL
      const command = new PutObjectCommand({
        Bucket: targetBucket,
        Key: filePath,
        ContentType: fileType || 'application/octet-stream',
      });

      // Presigned PUT expires in 15 minutes (900 seconds)
      const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

      // Generate Read URL (Public dynamic endpoint for read or static URL fallback)
      const publicEndpoint = process.env.VITE_MINIO_ENDPOINT || 'http://localhost:9000';
      let readUrl = `${publicEndpoint}/${targetBucket}/${filePath}`;

      return ok(res, { uploadUrl, readUrl });

    } else if (action === 'getDownloadUrl') {
      // ── Enforce Folder Security Rules for Download ─────────────────────────
      if (bucket === 'message-attachments') {
        const parts = filePath.split('/');
        
        // Private chat path: private_{receiverId}/{senderId}/{fileName}
        // Ensure user is either senderId or receiverId
        if (parts[0].startsWith('private_')) {
          const receiverId = parts[0].substring(8);
          const senderId = parts[1];
          if (user.id !== senderId && user.id !== receiverId) {
            return err(res, 403, 'Từ chối truy cập: Bạn không có quyền xem tệp đính kèm này');
          }
        }
        // Room chats are room_{roomId}/{senderId}/{fileName}
        // Under our current policy, any authenticated user can read room chat attachments
      }

      // Generate Presigned GET URL for private buckets
      const command = new GetObjectCommand({
        Bucket: targetBucket,
        Key: filePath,
      });

      // Presigned GET link expires in 7 days (604800 seconds) as per Option B requirement
      const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 604800 });

      return ok(res, { downloadUrl });

    } else {
      return err(res, 400, `Hành động không hợp lệ: ${action}`);
    }
  } catch (error) {
    console.error('[StoragePresignError]', action, error);
    return err(res, 500, 'Lỗi hệ thống khi xử lý tệp tin: ' + error.message);
  }
}
