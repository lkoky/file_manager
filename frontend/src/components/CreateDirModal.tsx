import React, { useState } from 'react';

interface CreateDirModalProps {
  currentPath: string;
  root: string;  // 当前根目录别名
  onCreateComplete: (newDirName: string) => void;
  onClose: () => void;
}

export const CreateDirModal: React.FC<CreateDirModalProps> = ({
  currentPath,
  root,
  onCreateComplete,
  onClose,
}) => {
  const [dirName, setDirName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!dirName.trim()) {
      setError('请输入目录名称');
      return;
    }

    // 验证目录名称合法性
    const invalidChars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|'];
    if (invalidChars.some((char) => dirName.includes(char))) {
      setError('目录名称不能包含非法字符: / \\ : * ? " < > |');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const response = await fetch('/api/create-directory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          root,
          path: currentPath,
          name: dirName.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '创建目录失败');
      }

      const result = await response.json();
      onCreateComplete(result.name);
    } catch (err: any) {
      setError(err.message || '创建目录失败，请重试');
    } finally {
      setCreating(false);
    }
  };

  const displayPath = currentPath ? `/${root}/${currentPath}` : `/${root} (根目录)`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content create-dir-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">📁 新建目录</h3>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label>目标位置</label>
            <div className="path-hint">{displayPath}</div>
          </div>

          <div className="form-group">
            <label>目录名称</label>
            <input
              type="text"
              className="dir-name-input"
              value={dirName}
              onChange={(e) => {
                setDirName(e.target.value);
                setError(null);
              }}
              placeholder="请输入目录名称"
              disabled={creating}
              autoFocus
            />
            {error && (
              <div className="input-error">
                ⚠️ {error}
              </div>
            )}
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={creating}
            >
              取消
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!dirName.trim() || creating}
            >
              {creating ? '⏳ 创建中...' : '✅ 创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateDirModal;
