import PropTypes from 'prop-types';
import { useState } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import { imageUploadApi } from '../api';
import Toast from './Toast';

export default function ImageUploader({ label, value, onChange }) {
  const [isUploading, setIsUploading] = useState(false);

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setIsUploading(true);
    try {
      onChange(await imageUploadApi.upload(file));
      Toast.Success('图片已上传到 COS。');
    } catch (error) {
      Toast.Error(error.message);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <span className="block text-xs font-semibold text-foreground">{label}</span>
      <label className="flex min-h-28 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/50 transition hover:border-primary hover:bg-primary/5">
        {value ? (
          <img src={value} alt={`${label}预览`} className="h-28 w-full object-cover" />
        ) : isUploading ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" aria-label="图片上传中" />
        ) : (
          <span className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
            <ImagePlus className="h-5 w-5" />
            上传 JPEG、PNG 或 WebP
          </span>
        )}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={isUploading}
          onChange={handleFileChange}
        />
      </label>
    </div>
  );
}

ImageUploader.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
};
