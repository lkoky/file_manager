import axios from 'axios';
import type {
  FileListResponse,
  PreviewResponse,
  UploadResponse,
  RootDirectory
} from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 300000, // 5分钟超时（用于大文件上传）
});

// 获取所有根目录列表
export async function getRoots(): Promise<RootDirectory[]> {
  const response = await api.get('/roots');
  return response.data;
}

// 获取文件列表（支持多根目录）
export async function getFiles(path?: string, root?: string): Promise<FileListResponse> {
  const params: any = {};
  if (path) params.path = path;
  if (root) params.root = root;
  const response = await api.get('/files', { params });
  return response.data;
}

// 预览文件
export async function previewFile(path: string, root?: string): Promise<PreviewResponse> {
  const params: any = { path };
  if (root) params.root = root;
  const response = await api.get('/preview', { params });
  return response.data;
}

// 获取文件内容流（用于PDF/图片预览）
export function getFileContentUrl(path: string, root: string = 'default'): string {
  const encodedPath = encodeURIComponent(path);
  return `/api/file-content?root=${root}&path=${encodedPath}`;
}

// 下载文件
export function downloadFile(path: string, root: string = 'default'): void {
  const encodedPath = encodeURIComponent(path);
  // 创建隐藏的 a 标签触发下载，避免被浏览器拦截
  const link = document.createElement('a');
  link.href = `/api/download?root=${root}&path=${encodedPath}`;
  link.setAttribute('download', '');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 创建目录
export async function createDirectory(path: string, name: string, root?: string): Promise<{ success: boolean; name: string; path: string }> {
  const data: any = { path, name };
  if (root) data.root = root;
  const response = await api.post('/create-directory', data);
  return response.data;
}

// 删除文件或目录
export async function deleteFile(path: string, root?: string): Promise<{ success: boolean }> {
  const params: any = { path };
  if (root) params.root = root;
  const response = await api.delete('/files', { params });
  return response.data;
}

// 上传文件（支持进度回调和取消）
export async function uploadFile(
  file: File,
  targetPath: string,
  root: string = 'default',
  onProgress?: (progressEvent: any) => void,
  signal?: AbortSignal
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('target_path', targetPath);
  formData.append('root', root);

  const response = await api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: onProgress,
    signal,
  });

  return response.data;
}

export default api;
