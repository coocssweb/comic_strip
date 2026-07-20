import { buildCosObjectKey, validateCosUploadRequest } from '../cos/cos-upload.js';
import { env } from '../config/env.js';
import { createPresignedUploadUrl } from '../services/cos.service.js';
import { ApiError } from '../utils/api-error.js';

export async function createCosPresignedUpload(ctx) {
  const uploadRequest = validateCosUploadRequest(ctx.request.body);

  if (!uploadRequest) {
    throw new ApiError(400, 'VALIDATION_ERROR', '仅支持 5 MB 以内的 JPEG、PNG 或 WebP 图片。');
  }

  const objectKey = buildCosObjectKey({ fileName: uploadRequest.fileName, now: new Date() });

  if (!objectKey) {
    throw new ApiError(400, 'VALIDATION_ERROR', '文件名不合法。');
  }

  const uploadUrl = await createPresignedUploadUrl({
    objectKey,
    contentType: uploadRequest.contentType,
  });
  const expiresAt = new Date(Date.now() + env.cosUploadExpiresSeconds * 1000).toISOString();
  const publicUrl = new URL(objectKey, env.cosPublicBaseUrl).href;

  ctx.ok({
    method: 'PUT',
    uploadUrl,
    headers: { 'Content-Type': uploadRequest.contentType },
    publicUrl,
    expiresAt,
  });
}
