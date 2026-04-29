import React from 'react';
import type { FileItem } from '../types';

interface DeleteConfirmModalProps {
  file: FileItem | null;
  onConfirm: () => void;
  onClose: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  file,
  onConfirm,
  onClose,
}) => {
  if (!file) return null;

  const isDir = file.is_dir;
  const icon = isDir ? '📁' : '📄';
  const actionText = isDir ? '删除目录' : '删除文件';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">⚠️ 确认删除</h3>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="delete-warning">
            <span className="delete-icon">{icon}</span>
            <div className="delete-info">
              <p className="delete-name">{file.name}</p>
              <p className="delete-type">
                {isDir ? '目录' : '文件'}
                {!isDir && ` (${(file.size / 1024).toFixed(2)} KB)`}
              </p>
            </div>
          </div>

          <p className="delete-message">
            确定要{actionText} "{file.name}" 吗？此操作无法撤销。
          </p>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              取消
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={onConfirm}
            >
              🗑️ 确认删除
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;
