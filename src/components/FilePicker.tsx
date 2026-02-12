/**
 * 📎 FilePicker Component
 * ============================================
 * File selection and preview UI for chat attachments
 * Features:
 * - ➕ button to open file picker
 * - Preview overlay with thumbnail
 * - File info display (name, size)
 * - Cancel button to remove selection
 * - Upload progress indicator
 */

import React, { useRef, useState, useEffect } from 'react';
import { Image as ImageIcon, X, Upload } from 'lucide-react';
import { ACCEPTED_IMAGE_TYPES, ACCEPTED_VIDEO_TYPES } from '../services/uploadService';

interface FilePreview {
  file: File;
  preview: string;
  type: 'image' | 'video';
}

interface FilePickerProps {
  onFileSelect: (file: File) => Promise<void>;
  isUploading?: boolean;
}

export const FilePicker: React.FC<FilePickerProps> = ({
  onFileSelect,
  isUploading = false
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<FilePreview | null>(null);

  // Clean up preview URL on unmount
  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview.preview);
      }
    };
  }, [preview]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Determine file type
    const isImage = ACCEPTED_IMAGE_TYPES.includes(file.type);
    const isVideo = ACCEPTED_VIDEO_TYPES.includes(file.type);

    if (!isImage && !isVideo) {
      alert('请选择图片或视频文件');
      return;
    }

    // Create preview
    const previewUrl = URL.createObjectURL(file);
    setPreview({
      file,
      preview: previewUrl,
      type: isImage ? 'image' : 'video'
    });

    // Trigger upload
    try {
      await onFileSelect(file);
    } catch (error: any) {
      console.error('Upload failed:', error);
      alert(error.message || '上传失败，请重试');
      clearPreview();
    }
  };

  const clearPreview = () => {
    if (preview) {
      URL.revokeObjectURL(preview.preview);
    }
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="relative">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={[...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES].join(',')}
        onChange={handleFileChange}
        className="hidden"
        disabled={isUploading}
      />

      {/* File picker button */}
      {!preview && (
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="w-10 h-10 rounded-full hover:bg-white/5 dark:hover:bg-white/10 flex items-center justify-center transition-colors text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 active:scale-90 duration-200"
          title="添加图片或视频"
        >
          <ImageIcon size={20} />
        </button>
      )}

      {/* Preview modal/overlay */}
      {preview && (
        <div className="absolute bottom-14 left-0 bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-3 w-72 border border-slate-200 dark:border-slate-700 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-start justify-between mb-2">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              {preview.type === 'image' ? '图片预览' : '视频预览'}
            </span>
            <button
              onClick={clearPreview}
              className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700"
              disabled={isUploading}
            >
              <X size={16} />
            </button>
          </div>

          {/* Preview content */}
          <div className="relative rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-900 mb-2">
            {preview.type === 'image' ? (
              <img
                src={preview.preview}
                alt="Preview"
                className="w-full h-40 object-cover"
              />
            ) : (
              <video
                src={preview.preview}
                className="w-full h-40 object-cover"
                controls
              />
            )}
            {isUploading && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                <div className="text-white text-xs flex items-center gap-2">
                  <Upload size={14} className="animate-bounce" />
                  上传中...
                </div>
              </div>
            )}
          </div>

          {/* File info */}
          <div className="text-[10px] text-slate-500 dark:text-slate-400 space-y-0.5">
            <p className="font-medium truncate">{preview.file.name}</p>
            <p>{(preview.file.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilePicker;
