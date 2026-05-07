export const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

/**
 * Nén ảnh bằng HTML5 Canvas nếu dung lượng vượt quá 2MB.
 * Giữ nguyên định dạng và giảm chất lượng/kích thước ảnh.
 * @param {File} file File ảnh cần nén
 * @returns {Promise<File>} File ảnh đã nén hoặc file gốc nếu không cần nén
 */
export const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    // Nếu không phải là ảnh hoặc dung lượng dưới 2MB thì trả về file gốc
    if (!file.type.startsWith('image/') || file.size <= MAX_FILE_SIZE) {
      resolve(file);
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      // Kích thước tối đa mong muốn
      const MAX_WIDTH = 1920;
      const MAX_HEIGHT = 1080;
      let width = img.width;
      let height = img.height;

      // Tính toán tỷ lệ thu nhỏ nếu ảnh quá lớn
      if (width > height) {
        if (width > MAX_WIDTH) {
          height = Math.round((height *= MAX_WIDTH / width));
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width = Math.round((width *= MAX_HEIGHT / height));
          height = MAX_HEIGHT;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Nén ảnh với chất lượng 0.7 ban đầu
      let quality = 0.7;
      
      const attemptCompress = (q) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Canvas to Blob failed'));
              return;
            }

            // Nếu blob vẫn lớn hơn 2MB và chất lượng còn có thể giảm, thử nén tiếp
            if (blob.size > MAX_FILE_SIZE && q > 0.3) {
              attemptCompress(q - 0.2);
            } else {
              // Trả về file đã nén
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            }
          },
          'image/jpeg',
          q
        );
      };

      attemptCompress(quality);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Lỗi khi tải ảnh để nén'));
    };

    img.src = objectUrl;
  });
};

/**
 * Kiểm tra tính hợp lệ của file (dung lượng và nén nếu cần)
 * @param {File} file File đầu vào
 * @returns {Promise<{isValid: boolean, file: File, error?: string}>}
 */
export const validateAndCompressFile = async (file) => {
  try {
    if (!file) return { isValid: false, error: 'Không có file' };

    // Xử lý nén nếu là file ảnh
    if (file.type.startsWith('image/')) {
      const processedFile = await compressImage(file);
      if (processedFile.size > MAX_FILE_SIZE) {
        return { 
          isValid: false, 
          file: processedFile, 
          error: 'Ảnh quá lớn và không thể nén xuống dưới 2MB. Vui lòng chọn ảnh khác.' 
        };
      }
      return { isValid: true, file: processedFile };
    }

    // Xử lý các loại file khác (Tài liệu, v.v...)
    if (file.size > MAX_FILE_SIZE) {
      return { 
        isValid: false, 
        file, 
        error: 'Dung lượng file vượt quá 2MB. Vui lòng chọn file nhỏ hơn.' 
      };
    }

    return { isValid: true, file };
  } catch (error) {
    console.error('File validation error:', error);
    return { isValid: false, file, error: 'Có lỗi xảy ra khi xử lý file' };
  }
};
