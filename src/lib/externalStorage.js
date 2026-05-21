import { supabase } from './supabase';

/**
 * Lấy token xác thực hiện tại của người dùng từ Supabase Session
 */
const getSessionToken = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
};

/**
 * Tự động chuyển đổi các liên kết từ localhost / 127.0.0.1 sang địa chỉ IP/Host hiện tại của client
 * nhằm giải quyết triệt để lỗi "Failed to fetch" khi thử nghiệm phần mềm qua mạng LAN (IP thay thế localhost)
 * @param {string} url - URL cần chuyển đổi
 * @returns {string} URL đã chuyển đổi hostname tương thích
 */
const resolveClientUrl = (url) => {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') &&
      typeof window !== 'undefined' &&
      window.location.hostname &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      parsed.hostname = window.location.hostname;
    }
    return parsed.toString();
  } catch (e) {
    return url;
  }
};

/**
 * Tải tệp tin lên ổ cứng ngoài thông qua API ký mã hóa (Presigned PUT URL) của MinIO
 * @param {File} file - Đối tượng File từ HTML Input
 * @param {string} bucket - Tên bucket ('avatars' hoặc 'message-attachments')
 * @param {string} filePath - Đường dẫn tương đối lưu tệp (ví dụ: 'userId/avatar.png')
 * @returns {Promise<string>} Trả về URL đọc tệp (Public URL hoặc URL bảo mật đã ký)
 */
export const uploadFileToExternalStorage = async (file, bucket, filePath) => {
  try {
    const token = await getSessionToken();
    if (!token) {
      throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }

    // 1. Gửi yêu cầu ký URL upload lên Backend Vercel Serverless
    const response = await fetch('/api/storage-presign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        action: 'getUploadUrl',
        bucket,
        filePath,
        fileType: file.type
      })
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Không thể lấy chữ ký tải lên tệp tin.');
    }

    const { uploadUrl, readUrl } = result;

    // Tự động giải quyết địa chỉ IP LAN cho uploadUrl
    const resolvedUploadUrl = resolveClientUrl(uploadUrl);

    // 2. Tiến hành tải trực tiếp từ Client lên MinIO
    // Sử dụng PUT với body là Raw File, bỏ qua proxy server để tối ưu băng thông
    const uploadResponse = await fetch(resolvedUploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type || 'application/octet-stream'
      },
      body: file
    });

    if (!uploadResponse.ok) {
      throw new Error(`Tải tệp lên máy chủ lưu trữ local thất bại (Mã lỗi: ${uploadResponse.status})`);
    }

    // 3. Nếu là tệp đính kèm tin nhắn (cần bảo mật riêng tư), 
    // chúng ta sẽ sinh thêm Presigned GET URL thời hạn dài (7 ngày) làm liên kết đọc.
    if (bucket === 'message-attachments') {
      const getUrlResponse = await fetch('/api/storage-presign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'getDownloadUrl',
          bucket,
          filePath
        })
      });

      const getUrlResult = await getUrlResponse.json();
      if (getUrlResponse.ok && getUrlResult.success) {
        return resolveClientUrl(getUrlResult.downloadUrl);
      }
    }

    // Đối với ảnh đại diện (avatars - bucket công khai) hoặc fallback: trả về URL tĩnh
    return resolveClientUrl(readUrl);
  } catch (error) {
    console.error('[ExternalStorage Upload Error]:', error);
    throw error;
  }
};

/**
 * Lấy chữ ký liên kết tải về/xem tệp tin trên MinIO (dành cho các tệp tin cũ hoặc cần làm mới)
 * @param {string} filePath - Đường dẫn tương đối của tệp
 * @param {string} bucket - Tên bucket
 * @returns {Promise<string>} URL đã ký mã hóa
 */
export const getExternalDownloadUrl = async (filePath, bucket) => {
  try {
    const token = await getSessionToken();
    if (!token) return '';

    const response = await fetch('/api/storage-presign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        action: 'getDownloadUrl',
        bucket,
        filePath
      })
    });

    const result = await response.json();
    if (response.ok && result.success) {
      return resolveClientUrl(result.downloadUrl);
    }
    
    // Fallback trả về URL tĩnh
    const publicEndpoint = import.meta.env.VITE_MINIO_ENDPOINT || 'http://localhost:9000';
    return resolveClientUrl(`${publicEndpoint}/${bucket}/${filePath}`);
  } catch (error) {
    console.error('[ExternalStorage Get URL Error]:', error);
    const publicEndpoint = import.meta.env.VITE_MINIO_ENDPOINT || 'http://localhost:9000';
    return resolveClientUrl(`${publicEndpoint}/${bucket}/${filePath}`);
  }
};

/**
 * Kiểm tra xem một URL MinIO đã ký có bị hết hạn (hoặc sắp hết hạn trong 1 giờ tới) hay không.
 * Nếu đã/sắp hết hạn, tiến hành gọi API xin cấp một chữ ký mới có hiệu lực 7 ngày tiếp theo.
 * @param {string} url - URL hiện tại của tệp
 * @returns {Promise<string>} Trả về URL hợp lệ (mới hoặc cũ)
 */
export const getFreshUrlIfExpired = async (url) => {
  if (!url) return '';
  
  // Tự động chuyển đổi sang IP LAN nếu URL lưu trong database chứa localhost
  const resolvedUrl = resolveClientUrl(url);

  // Chỉ xử lý các liên kết từ bucket attachments hoặc avatars của local storage
  if (!resolvedUrl.includes('/message-attachments/') && !resolvedUrl.includes('/avatars/')) {
    return resolvedUrl;
  }

  try {
    const parsed = new URL(resolvedUrl);
    const pathname = parsed.pathname; // /bucket-name/path/to/file
    const parts = pathname.split('/');
    
    // parts[0] = "", parts[1] = bucketName, parts[2..] = filePath
    if (parts.length >= 3) {
      const bucketName = parts[1];
      const filePath = decodeURIComponent(parts.slice(2).join('/'));
      
      const amzDateStr = parsed.searchParams.get('X-Amz-Date');
      const amzExpiresStr = parsed.searchParams.get('X-Amz-Expires');
      
      if (amzDateStr && amzExpiresStr) {
        // Định dạng X-Amz-Date thường là: YYYYMMDDTHHmmSSZ (ví dụ: 20260520T090306Z)
        const year = parseInt(amzDateStr.substring(0, 4), 10);
        const month = parseInt(amzDateStr.substring(4, 6), 10);
        const day = parseInt(amzDateStr.substring(6, 8), 10);
        const hour = parseInt(amzDateStr.substring(9, 11), 10);
        const min = parseInt(amzDateStr.substring(11, 13), 10);
        const sec = parseInt(amzDateStr.substring(13, 15), 10);
        
        const creationTime = Date.UTC(year, month - 1, day, hour, min, sec);
        const expiresSeconds = parseInt(amzExpiresStr, 10);
        const expirationTime = creationTime + (expiresSeconds * 1000);
        
        const now = Date.now();
        // Nếu liên kết đã hết hạn, hoặc sẽ hết hạn trong vòng 1 giờ tới, tự động ký mới
        if (now > expirationTime - (60 * 60 * 1000)) {
          console.log(`[StoragePresign] URL for ${filePath} is expired or expiring soon. Renewing...`);
          const bucketType = bucketName.includes('avatar') ? 'avatars' : 'message-attachments';
          const freshUrl = await getExternalDownloadUrl(filePath, bucketType);
          return freshUrl;
        }
      }
    }
  } catch (err) {
    console.error('[StoragePresign] Failed to check/renew signed URL:', err);
  }
  
  return resolvedUrl;
};
