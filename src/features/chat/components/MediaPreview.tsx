/**
 * MediaPreview - 媒体预览组件
 *
 * 显示待发送的图片或视频预览
 */

import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

interface MediaData {
  uri: string;
  type: 'image' | 'video';
  size: number;
}

interface MediaPreviewProps {
  media: MediaData;
  onRemove: () => void;
}

const MediaPreview: React.FC<MediaPreviewProps> = ({ media, onRemove }) => {
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="mb-2 p-2 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20"
    >
      <div className="flex items-center gap-3">
        {/* 媒体预览 */}
        <div className="w-16 h-16 rounded-lg overflow-hidden bg-black/20 flex-shrink-0">
          {media.type === 'image' ? (
            <img
              src={media.uri}
              alt="Preview"
              className="w-full h-full object-cover"
            />
          ) : (
            <video
              src={media.uri}
              className="w-full h-full object-cover"
              muted
            />
          )}
        </div>

        {/* 文件信息 */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white font-medium truncate">
            {media.type === 'image' ? '图片' : '视频'}
          </p>
          <p className="text-xs text-gray-400">{formatSize(media.size)}</p>
        </div>

        {/* 删除按钮 */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onRemove}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          <X size={16} className="text-white" />
        </motion.button>
      </div>
    </motion.div>
  );
};

export default MediaPreview;
