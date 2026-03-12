/**
 * FilePicker Component
 * File selection and preview UI for chat attachments.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Upload, X } from 'lucide-react';
import { ACCEPTED_IMAGE_TYPES, ACCEPTED_VIDEO_TYPES } from '../services/uploadService';
import { useNotification } from '../hooks/useNotification';
import { getErrorMessage } from '../utils/errorHandler';

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
  isUploading = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<FilePreview | null>(null);
  const { showError } = useNotification();

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview.preview);
      }
    };
  }, [preview]);

  const clearPreview = () => {
    if (preview) {
      URL.revokeObjectURL(preview.preview);
    }
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isImage = ACCEPTED_IMAGE_TYPES.includes(file.type);
    const isVideo = ACCEPTED_VIDEO_TYPES.includes(file.type);

    if (!isImage && !isVideo) {
      showError('请选择图片或视频文件');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setPreview({
      file,
      preview: previewUrl,
      type: isImage ? 'image' : 'video',
    });

    try {
      await onFileSelect(file);
    } catch (error: unknown) {
      showError(getErrorMessage(error, '上传失败，请重试'));
      clearPreview();
    }
  };

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept={[...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES].join(',')}
        onChange={handleFileChange}
        className="hidden"
        disabled={isUploading}
      />

      {!preview && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="ios-pressable ios-surface-button ios-icon-button flex items-center justify-center text-slate-400 disabled:opacity-50 dark:text-slate-300"
          title="添加图片或视频"
        >
          <ImageIcon size={20} />
        </button>
      )}

      {preview && (
        <div className="ios-glass-surface absolute bottom-14 left-0 z-50 w-full max-w-[280px] animate-in rounded-[1.2rem] border border-slate-200 bg-white/96 p-3 shadow-2xl fade-in slide-in-from-bottom-2 duration-200 sm:max-w-[320px] dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-2 flex items-start justify-between">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              {preview.type === 'image' ? '图片预览' : '视频预览'}
            </span>
            <button
              type="button"
              onClick={clearPreview}
              className="ios-pressable ios-icon-button-compact flex items-center justify-center rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              disabled={isUploading}
              aria-label="清除预览"
            >
              <X size={16} />
            </button>
          </div>

          <div className="relative mb-2 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-900">
            {preview.type === 'image' ? (
              <img
                src={preview.preview}
                alt="Preview"
                className="h-40 w-full object-cover"
              />
            ) : (
              <video
                src={preview.preview}
                className="h-40 w-full object-cover"
                controls
              />
            )}

            {isUploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-xs text-white">
                  <Upload size={14} className="animate-bounce" />
                  上传中...
                </div>
              </div>
            )}
          </div>

          <div className="space-y-0.5 text-[10px] text-slate-500 dark:text-slate-400">
            <p className="truncate font-medium">{preview.file.name}</p>
            <p>{(preview.file.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilePicker;
