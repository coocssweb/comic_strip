import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Upload, Loader2, X, GripVertical } from 'lucide-react';
import { imageAPI } from '@/api';

// 允许的图片类型与大小上限
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * 验证文件类型和大小
 * @param {File} file
 * @returns {string | null} 错误消息，无错返回 null
 */
function validateFile(file) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return '仅支持 JPEG、PNG、WebP 格式';
  }
  if (file.size > MAX_FILE_SIZE) {
    return '文件大小不能超过 5 MB';
  }
  return null;
}

/**
 * STS 两阶段上传：申请凭证 → 直传 COS
 * @param {string} comicId
 * @param {File} file
 * @param {(progress: number) => void} [onProgress]
 * @returns {Promise<string>} COS key
 */
async function uploadToCos(comicId, file, onProgress) {
  // 阶段一：申请 STS 凭证
  const sts = await imageAPI.requestSts(comicId, {
    fileName: file.name,
    contentType: file.type,
    contentLength: file.size,
  });

  // 阶段二：直传 COS
  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(sts.method || 'PUT', sts.uploadUrl);

    // 设置返回头
    if (sts.headers) {
      Object.entries(sts.headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });
    }

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`上传失败 (${xhr.status})`));
      }
    };

    xhr.onerror = () => reject(new Error('网络连接失败，请重试'));
    xhr.ontimeout = () => reject(new Error('上传超时，请重试'));

    xhr.send(file);
  });

  // 从 uploadUrl 中提取 COS key（上传路径在 URL path 中）
  const urlObj = new URL(sts.uploadUrl);
  return decodeURIComponent(urlObj.pathname.replace(/^\//, ''));
}

/**
 * 封面上传组件
 * 无封面显示虚线框上传区，有封面显示缩略图 + 替换提示
 */
export function CoverUploader({ comicId, coverUrl, onUploadStart, onUploadSuccess, onUploadError }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 重置 input，允许重复选同一个文件
    e.target.value = '';

    const error = validateFile(file);
    if (error) {
      onUploadError?.(error);
      return;
    }

    onUploadStart?.();
    setUploading(true);

    try {
      const key = await uploadToCos(comicId, file);
      onUploadSuccess?.(key);
    } catch (err) {
      onUploadError?.(err.message || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      {/* 已有封面：显示缩略图 */}
      {coverUrl ? (
        <button
          type="button"
          className="group relative w-40 overflow-hidden rounded-lg border border-border"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          title="点击替换封面"
        >
          <img
            src={coverUrl}
            alt="封面预览"
            className="aspect-[3/4] w-full object-cover"
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            ) : (
              <>
                <Upload className="h-5 w-5 text-white" />
                <span className="mt-1 text-xs font-medium text-white">点击替换</span>
              </>
            )}
          </div>
        </button>
      ) : (
        /* 无封面：上传虚线框 */
        <button
          type="button"
          className="flex w-40 flex-col items-center justify-center rounded-lg border-2 border-dashed border-border py-10 transition-colors hover:border-primary/40 hover:bg-muted/50"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          title="点击上传封面"
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            <>
              <Upload className="h-6 w-6 text-muted-foreground" />
              <span className="mt-2 text-xs font-medium text-muted-foreground">点击上传封面</span>
            </>
          )}
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}

CoverUploader.propTypes = {
  comicId: PropTypes.string.isRequired,
  
  coverUrl: PropTypes.string,
  onUploadStart: PropTypes.func,
  onUploadSuccess: PropTypes.func,
  onUploadError: PropTypes.func,
};

/**
 * 正文多图上传 + 拖拽排序组件
 */
export function BodyImagesUploader({ comicId, images, onAddImage, onRemoveImage, onReorder, onUploadError }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  const handleFilesChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    e.target.value = '';

    // 逐个验证文件
    for (const file of files) {
      const error = validateFile(file);
      if (error) {
        onUploadError?.(error);
        return;
      }
    }

    setUploading(true);
    setUploadProgress(0);

    // 逐个上传，累积进度
    for (let i = 0; i < files.length; i++) {
      try {
        const key = await uploadToCos(comicId, files[i], (pct) => {
          // 整体进度 = （已完成文件数 + 当前进度百分比） / 总文件数
          const overall = Math.round(((i + pct / 100) / files.length) * 100);
          setUploadProgress(overall);
        });
        onAddImage(key);
      } catch (err) {
        onUploadError?.(err.message || '上传失败');
        break;
      }
    }

    setUploading(false);
  };

  // 拖拽排序：HTML5 Drag and Drop
  const handleDragStart = (index) => {
    dragItem.current = index;
  };

  const handleDragEnter = (index) => {
    dragOverItem.current = index;
  };

  const handleDragEnd = () => {
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
      const newImages = [...images];
      const [moved] = newImages.splice(dragItem.current, 1);
      newImages.splice(dragOverItem.current, 0, moved);
      onReorder(newImages);
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };

  return (
    <div>
      {/* 图片网格 */}
      <div className="mb-3 grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-6">
        {images.map((img, index) => (
          <div
            key={img.key || index}
            className="group relative aspect-[3/4] cursor-grab overflow-hidden rounded-lg border border-border active:cursor-grabbing"
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragEnter={() => handleDragEnter(index)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => e.preventDefault()}
          >
            <img
              src={img.url}
              alt={`正文图片 ${index + 1}`}
              className="h-full w-full object-cover"
            />
            {/* 拖拽手柄 */}
            <div className="absolute left-1 top-1 rounded bg-black/50 p-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <GripVertical className="h-3 w-3 text-white" />
            </div>
            {/* 角标序号 */}
            <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-xs font-semibold text-white">
              {index + 1}
            </span>
            {/* 删除按钮 */}
            <button
              type="button"
              className="absolute right-1 top-1 rounded-full bg-black/50 p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
              onClick={() => onRemoveImage(index)}
              title="移除此图片"
            >
              <X className="h-3.5 w-3.5 text-white" />
            </button>
          </div>
        ))}

        {/* 上传入口 */}
        <button
          type="button"
          className="flex aspect-[3/4] flex-col items-center justify-center rounded-lg border-2 border-dashed border-border transition-colors hover:border-primary/40 hover:bg-muted/50"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          title="上传正文图片"
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-1">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">{uploadProgress}%</span>
            </div>
          ) : (
            <>
              <Upload className="h-5 w-5 text-muted-foreground" />
              <span className="mt-1 text-xs font-medium text-muted-foreground">上传</span>
            </>
          )}
        </button>
      </div>

      {images.length > 0 && (
        <p className="text-xs text-muted-foreground">拖拽调整图片顺序</p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={handleFilesChange}
      />
    </div>
  );
}

BodyImagesUploader.propTypes = {
  comicId: PropTypes.string.isRequired,
  images: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string,
      url: PropTypes.string,
    }),
  ).isRequired,
  onAddImage: PropTypes.func.isRequired,
  onRemoveImage: PropTypes.func.isRequired,
  onReorder: PropTypes.func.isRequired,
  onUploadError: PropTypes.func,
};
