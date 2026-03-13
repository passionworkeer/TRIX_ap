import React from 'react';
import {
  Download,
  FileArchive,
  FileImage,
  FileText,
  FileVideo,
  Music2,
  Paperclip,
} from 'lucide-react';
import { formatFileSize } from '../services/uploadService';

interface FileAttachmentCardProps {
  uri: string;
  mimeType?: string;
  fileName?: string;
  size?: number;
  compact?: boolean;
  className?: string;
}

function inferFileName(uri: string): string {
  try {
    const parsedUrl = new URL(uri);
    const lastSegment = parsedUrl.pathname.split('/').filter(Boolean).pop();
    return decodeURIComponent(lastSegment || '附件');
  } catch {
    const sanitizedUri = uri.split('?')[0] || uri;
    const lastSegment = sanitizedUri.split('/').filter(Boolean).pop();
    return decodeURIComponent(lastSegment || '附件');
  }
}

function getAttachmentIcon(mimeType?: string) {
  const normalizedMimeType = String(mimeType || '').toLowerCase();

  if (normalizedMimeType.startsWith('image/')) {
    return FileImage;
  }
  if (normalizedMimeType.startsWith('video/')) {
    return FileVideo;
  }
  if (normalizedMimeType.startsWith('audio/')) {
    return Music2;
  }
  if (
    normalizedMimeType.includes('zip')
    || normalizedMimeType.includes('rar')
    || normalizedMimeType.includes('7z')
    || normalizedMimeType.includes('tar')
  ) {
    return FileArchive;
  }
  if (
    normalizedMimeType.includes('pdf')
    || normalizedMimeType.includes('document')
    || normalizedMimeType.includes('sheet')
    || normalizedMimeType.includes('presentation')
    || normalizedMimeType.startsWith('text/')
  ) {
    return FileText;
  }

  return Paperclip;
}

function buildMetaLine(mimeType?: string, size?: number): string {
  const metaParts: string[] = [];

  if (mimeType) {
    metaParts.push(mimeType);
  }
  if (typeof size === 'number' && Number.isFinite(size) && size >= 0) {
    metaParts.push(formatFileSize(size));
  }

  return metaParts.join(' • ');
}

const FileAttachmentCard: React.FC<FileAttachmentCardProps> = ({
  uri,
  mimeType,
  fileName,
  size,
  compact = false,
  className = '',
}) => {
  const resolvedFileName = fileName || inferFileName(uri);
  const Icon = getAttachmentIcon(mimeType);
  const metaLine = buildMetaLine(mimeType, size);

  return (
    <a
      href={uri}
      target="_blank"
      rel="noreferrer"
      download={resolvedFileName}
      className={`group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/90 px-3 py-3 text-left shadow-sm transition hover:border-slate-300 hover:bg-white dark:border-slate-700 dark:bg-slate-800/90 dark:hover:border-slate-600 dark:hover:bg-slate-800 ${className}`}
    >
      <div className={`flex shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200 ${compact ? 'h-10 w-10' : 'h-12 w-12'}`}>
        <Icon size={compact ? 18 : 20} />
      </div>
      <div className="min-w-0 flex-1">
        <div className={`truncate font-medium text-slate-900 dark:text-slate-100 ${compact ? 'text-xs' : 'text-sm'}`}>
          {resolvedFileName}
        </div>
        {metaLine && (
          <div className={`truncate text-slate-500 dark:text-slate-400 ${compact ? 'text-[11px]' : 'text-xs'}`}>
            {metaLine}
          </div>
        )}
      </div>
      <div className="shrink-0 text-slate-400 transition group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300">
        <Download size={compact ? 16 : 18} />
      </div>
    </a>
  );
};

export default FileAttachmentCard;
