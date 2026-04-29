import React, { useState, useEffect, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import mammoth from 'mammoth';
import type { FileItem } from '../types';
import { previewFile, downloadFile } from '../services/api';

// 配置 PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface PreviewModalProps {
  file: FileItem | null;
  root: string;
  onClose: () => void;
}

// 图片查看器子组件 - 支持放大缩小、拖拽、全屏
const ImageViewer: React.FC<{
  src: string;
  filename: string;
  onClose: () => void;
  onDownload: () => void;
}> = ({ src, filename, onClose, onDownload }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // 重置视图
  const resetView = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  // 放大
  const zoomIn = useCallback(() => {
    setScale(prev => Math.min(prev + 0.25, 5));
  }, []);

  // 缩小
  const zoomOut = useCallback(() => {
    setScale(prev => Math.max(prev - 0.25, 0.25));
  }, []);

  // 键盘事件
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case '+':
        case '=':
          e.preventDefault();
          zoomIn();
          break;
        case '-':
          e.preventDefault();
          zoomOut();
          break;
        case '0':
          e.preventDefault();
          resetView();
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomIn, zoomOut, resetView, onClose]);

  // 鼠标滚轮缩放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setScale(prev => Math.min(prev + 0.1, 5));
    } else {
      setScale(prev => Math.max(prev - 0.1, 0.25));
    }
  }, []);

  // 拖拽处理
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleImageClick = (_e: React.MouseEvent) => {
    // 如果正在拖拽，不触发点击
    if (isDragging) return;
    // 点击图片本身也可以放大
    if (scale === 1) {
      setScale(2);
    }
  };

  return (
    <div className="image-viewer-overlay" onClick={onClose}>
      <div
        className="image-viewer-container"
        onClick={(e) => e.stopPropagation()}
        onWheel={handleWheel}
      >
        {/* 工具栏 */}
        <div className="image-viewer-toolbar">
          <div className="toolbar-group">
            <button
              className="toolbar-btn"
              onClick={zoomIn}
              title="放大 (+)"
              disabled={scale >= 5}
            >
              🔍+
            </button>
            <button
              className="toolbar-btn"
              onClick={zoomOut}
              title="缩小 (-)"
              disabled={scale <= 0.25}
            >
              🔍-
            </button>
            <button
              className="toolbar-btn"
              onClick={resetView}
              title="重置 (0)"
              disabled={scale === 1 && position.x === 0 && position.y === 0}
            >
              ↺
            </button>
          </div>
          <div className="toolbar-info">
            {Math.round(scale * 100)}%
          </div>
          <div className="toolbar-group">
            <button
              className="toolbar-btn download-btn"
              onClick={onDownload}
              title="下载"
            >
              ⬇️ 下载
            </button>
            <button
              className="toolbar-btn close-btn"
              onClick={onClose}
              title="关闭 (ESC)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 图片容器 */}
        <div
          className="image-viewer-viewport"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <img
            src={src}
            alt={filename}
            className="image-viewer-image"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
            }}
            onClick={handleImageClick}
            draggable={false}
          />
        </div>

        {/* 提示信息 */}
        <div className="image-viewer-hints">
          <span>滚轮缩放 | 拖拽移动 | +/− 调整 | 0 重置 | ESC 关闭</span>
        </div>
      </div>
    </div>
  );
};

export const PreviewModal: React.FC<PreviewModalProps> = ({ file, root, onClose }) => {
  const [previewData, setPreviewData] = useState<{
    type: 'text' | 'image' | 'pdf' | 'docx' | 'unsupported';
    content: string | null;
    error: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [numPages, setNumPages] = useState<number>(0);
  const [docxHtml, setDocxHtml] = useState<string>('');
  const [imageViewerOpen, setImageViewerOpen] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreviewData(null);
      setDocxHtml('');
      setImageViewerOpen(false);
      return;
    }

    const loadPreview = async () => {
      setLoading(true);
      setPreviewData(null);
      setDocxHtml('');
      setImageViewerOpen(false);

      try {
        const data = await previewFile(file.path, root);
        setPreviewData(data);

        if (data.type === 'docx' && data.content) {
          try {
            const fileRes = await fetch(data.content);
            const blob = await fileRes.blob();
            const arrayBuffer = await blob.arrayBuffer();
            const result = await mammoth.convertToHtml({ arrayBuffer });
            setDocxHtml(result.value);
          } catch (e) {
            console.error('Failed to convert docx:', e);
          }
        }
      } catch (err) {
        setPreviewData({
          type: 'unsupported',
          content: null,
          error: 'Failed to load preview',
        });
      } finally {
        setLoading(false);
      }
    };

    loadPreview();
  }, [file, root]);

  if (!file) return null;

  const handleImageViewerClose = () => {
    setImageViewerOpen(false);
  };

  const handleImageClick = () => {
    if (previewData?.type === 'image' && previewData.content) {
      setImageViewerOpen(true);
    }
  };

  const renderPreview = () => {
    if (loading) {
      return <div className="preview-loading">⏳ 加载中...</div>;
    }

    if (!previewData) return null;

    if (previewData.type === 'unsupported' || previewData.error) {
      return (
        <div className="preview-error">
          <div className="error-icon">⚠️</div>
          <div className="error-message">
            {previewData.error || '该文件类型不支持预览'}
          </div>
          <div className="error-hint">
            请点击下载按钮获取文件
          </div>
        </div>
      );
    }

    switch (previewData.type) {
      case 'text':
        return (
          <div className="preview-text">
            <pre>{previewData.content}</pre>
          </div>
        );

      case 'image':
        return (
          <div className="preview-image-container" onClick={handleImageClick}>
            <img
              src={previewData.content || ''}
              alt={file.name}
              className="preview-image clickable"
              onError={() => {
                setPreviewData((prev) => ({
                  ...prev!,
                  type: 'unsupported',
                  error: 'Failed to load image',
                }));
              }}
            />
            <div className="preview-image-hint">点击查看大图</div>
          </div>
        );

      case 'pdf':
        return (
          <div className="preview-pdf">
            <Document
              file={previewData.content}
              onLoadSuccess={({ numPages }) => setNumPages(numPages)}
              onLoadError={() => {
                setPreviewData((prev) => ({
                  ...prev!,
                  type: 'unsupported',
                  error: 'Failed to load PDF',
                }));
              }}
              loading={<div className="preview-loading">⏳ 加载 PDF 中...</div>}
            >
              {Array.from(new Array(numPages), (_, index) => (
                <Page
                  key={`page_${index + 1}`}
                  pageNumber={index + 1}
                  width={600}
                />
              ))}
            </Document>
          </div>
        );

      case 'docx':
        return (
          <div
            className="preview-docx"
            dangerouslySetInnerHTML={{ __html: docxHtml }}
          />
        );

      default:
        return null;
    }
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal-content preview-modal"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header">
            <h3 className="modal-title">{file.name}</h3>
            <div className="modal-header-actions">
              <button
                className="action-btn download-btn"
                onClick={() => downloadFile(file.path, root)}
                title="下载文件"
              >
                ⬇️ 下载
              </button>
              <button className="close-btn" onClick={onClose}>
                ✕
              </button>
            </div>
          </div>
          <div className="modal-body">{renderPreview()}</div>
        </div>
      </div>

      {/* 图片独立查看器 */}
      {imageViewerOpen && previewData?.type === 'image' && previewData.content && (
        <ImageViewer
          src={previewData.content}
          filename={file.name}
          onClose={handleImageViewerClose}
          onDownload={() => downloadFile(file.path, root)}
        />
      )}
    </>
  );
};

export default PreviewModal;
