import React from 'react';
import type { FileListResponse, FileItem as FileItemType } from '../types';
import FileItemComponent from './FileItem';

interface FileListProps {
  data: FileListResponse;
  onNavigate: (path: string) => void;
  onPreview: (file: FileItemType) => void;
  onDownload: (file: FileItemType) => void;
  onDelete: (file: FileItemType) => void;
}

export const FileList: React.FC<FileListProps> = ({
  data,
  onNavigate,
  onPreview,
  onDownload,
  onDelete,
}) => {
  const handleDirClick = (path: string) => {
    onNavigate(path);
  };

  return (
    <div className="file-list-container">
      {/* 表头 */}
      <div className="file-header">
        <div className="col-icon">📂</div>
        <div className="col-name">名称</div>
        <div className="col-size">大小</div>
        <div className="col-modified">修改时间</div>
        <div className="col-actions">操作</div>
      </div>

      {/* 目录列表 */}
      {data.directories.length > 0 ? (
        <div className="file-section">
          <div className="section-title">📁 目录 ({data.directories.length})</div>
          {data.directories.map((dir) => (
            <div
              key={dir.path}
              className="file-item directory"
              onClick={() => handleDirClick(dir.path)}
            >
              <div className="file-icon">📁</div>
              <div className="file-name" title={dir.name}>
                {dir.name}
              </div>
              <div className="file-size">-</div>
              <div className="file-modified">
                {new Date(dir.modified).toLocaleString('zh-CN')}
              </div>
              <div className="file-actions">
                <span className="action-hint">点击进入</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-section">无子目录</div>
      )}

      {/* 文件列表 */}
      {data.files.length > 0 ? (
        <div className="file-section">
          <div className="section-title">📄 文件 ({data.files.length})</div>
          {data.files.map((file) => (
            <FileItemComponent
              key={file.path}
              file={file}
              onPreview={onPreview}
              onDownload={onDownload}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : (
        <div className="empty-section">暂无文件</div>
      )}
    </div>
  );
};

export default FileList;
