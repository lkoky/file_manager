import React, { useState, useRef } from 'react';
import { uploadFile } from '../services/api';

interface UploadModalProps {
  currentPath: string;
  root: string;  // 当前根目录别名
  onUploadComplete: () => void;
  onClose: () => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  currentPath,
  root,
  onUploadComplete,
  onClose,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    setMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFile) {
      setMessage({ type: 'error', text: '请选择文件' });
      return;
    }

    // 取消之前的请求（如果有）
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setUploading(true);
    setProgress(0);
    setMessage(null);

    try {
      await uploadFile(selectedFile, currentPath, root, (progressEvent) => {
        const total = progressEvent.total || 1;
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / total
        );
        setProgress(percentCompleted);
      }, abortControllerRef.current.signal);

      setMessage({ type: 'success', text: `文件 "${selectedFile.name}" 上传成功！` });

      // 2秒后关闭弹窗
      setTimeout(() => {
        onUploadComplete();
      }, 1500);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return; // 请求被取消，不显示错误
      }
      setMessage({
        type: 'error',
        text: error.message || '上传失败，请重试',
      });
    } finally {
      setUploading(false);
      abortControllerRef.current = null;
    }
  };

  const handleClose = () => {
    // 中止正在进行的上传
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content upload-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">📤 上传文件</h3>
          <button className="close-btn" onClick={handleClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>选择文件</label>
            <div
              className={`file-select-area ${selectedFile ? 'has-file' : ''}`}
              onClick={() => fileInputRef.current?.click()}
            >
              {selectedFile ? (
                <div className="selected-file">
                  <span className="file-icon">📎</span>
                  <span className="file-name">{selectedFile.name}</span>
                  <span className="file-size">
                    ({(selectedFile.size / 1024).toFixed(2)} KB)
                  </span>
                </div>
              ) : (
                <div className="placeholder">
                  <span className="placeholder-icon">📁</span>
                  <span>点击选择文件</span>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </div>

          {currentPath && (
            <div className="current-path-hint" style={{ marginBottom: '20px' }}>
              📍 上传至：/{root}/{currentPath}
            </div>
          )}

          {uploading && (
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }}></div>
              <span className="progress-text">{progress}%</span>
            </div>
          )}

          {message && (
            <div className={`message ${message.type}`}>
              {message.type === 'success' ? '✅' : '❌'} {message.text}
            </div>
          )}

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleClose}
              disabled={uploading}
            >
              取消
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!selectedFile || uploading}
            >
              {uploading ? '⏳ 上传中...' : '📤 开始上传'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UploadModal;
