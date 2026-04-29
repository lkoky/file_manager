import React from 'react';
import type { FileItem as FileItemType } from '../types';
import { formatSize, formatDate, getFileIcon, isPreviewable } from '../types';

interface FileItemProps {
  file: FileItemType;
  onPreview: (file: FileItemType) => void;
  onDownload: (file: FileItemType) => void;
  onDelete: (file: FileItemType) => void;
}

export const FileItem: React.FC<FileItemProps> = ({ file, onPreview, onDownload, onDelete }) => {
  const canPreview = !file.is_dir && isPreviewable(file.extension);
  const icon = getFileIcon(file.extension);

  const handleNameClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!file.is_dir && canPreview) {
      onPreview(file);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(file);
  };

  return (
    <div className="file-item">
      <div className="file-icon">{icon}</div>
      <div
        className={`file-name ${!file.is_dir && canPreview ? 'clickable previewable' : ''}`}
        title={file.name}
        onClick={handleNameClick}
      >
        {file.name}
      </div>
      <div className="file-size">
        {file.is_dir ? '-' : formatSize(file.size)}
      </div>
      <div className="file-modified">
        {formatDate(file.modified)}
      </div>
      <div className="file-actions">
        {file.is_dir ? (
          <span className="action-hint">📂 目录</span>
        ) : (
          <>
            {canPreview && (
              <button
                className="action-btn preview-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onPreview(file);
                }}
                title="预览"
              >
                👁️ 预览
              </button>
            )}
            <button
              className="action-btn download-btn"
              onClick={(e) => {
                e.stopPropagation();
                onDownload(file);
              }}
              title="下载"
            >
              ⬇️ 下载
            </button>
          </>
        )}
        <button
          className="action-btn delete-btn"
          onClick={handleDeleteClick}
          title="删除"
        >
          🗑️ 删除
        </button>
      </div>
    </div>
  );
};

export default FileItem;
