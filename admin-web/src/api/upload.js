import request from '../utils/request';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

class ImageUploadApi {
  async upload(file) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_SIZE) {
      throw new Error('仅支持 5 MB 以内的 JPEG、PNG 或 WebP 图片。');
    }

    const signedUpload = await request.post('/admin/cos/presign', {
      fileName: file.name,
      contentType: file.type,
      contentLength: file.size,
    });
    const response = await fetch(signedUpload.uploadUrl, {
      method: signedUpload.method || 'PUT',
      headers: signedUpload.headers,
      body: file,
    });

    if (!response.ok) {
      throw new Error('图片上传失败，请重新选择图片后重试。');
    }

    return signedUpload.publicUrl;
  }
}

export const imageUploadApi = new ImageUploadApi();
