export interface FileItem {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: string;
  extension: string;
}

export interface FileListResponse {
  current_path: string;
  parent_path: string | null;
  directories: FileItem[];
  files: FileItem[];
}

export interface PreviewResponse {
  filename: string;
  content: string | null;
  type: 'text' | 'image' | 'pdf' | 'docx' | 'unsupported';
  error: string | null;
}

export interface UploadResponse {
  success: boolean;
  filename: string;
  path: string;
  size: number;
  message?: string;
}

// 根目录配置
export interface RootDirectory {
  alias: string;
  path: string;
  name?: string;  // 显示名称，可选
}

// 用于格式化文件大小
export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 格式化日期时间
export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// 获取文件类型图标（Emoji）
export function getFileIcon(extension: string): string {
  const ext = extension.toLowerCase();
  const iconMap: Record<string, string> = {
    // 文本/代码
    txt: '📄', json: '📄', csv: '📄', md: '📄',
    py: '🐍', js: '📜', ts: '📜', jsx: '⚛️', tsx: '⚛️',
    java: '☕', cpp: '🔧', c: '🔧', go: '🐹', rs: '🦀',
    html: '🌐', css: '🎨', xml: '📰', yaml: '📋', yml: '📋',
    log: '📝', ini: '⚙️', conf: '⚙️', env: '🔐', toml: '📋',
    sql: '🗃️', sh: '💻', bash: '💻',

    // 文档
    pdf: '📕',
    doc: '📘', docx: '📘',
    xls: '📗', xlsx: '📗',
    ppt: '📙', pptx: '📙',

    // 图片
    jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️',
    svg: '🖼️', webp: '🖼️', bmp: '🖼️', ico: '🖼️',

    // 音视频
    mp4: '🎬', mov: '🎬', avi: '🎬', mkv: '🎬',
    mp3: '🎵', wav: '🎵', flac: '🎵', aac: '🎵',

    // 压缩
    zip: '📦', rar: '📦', '7z': '📦', tar: '📦', gz: '📦',

    // 可执行
    exe: '⚡', app: '⚡', dmg: '⚡', apk: '📱',

    // 默认
    default: '📁',
  };

  return iconMap[ext] || iconMap.default;
}

// 检查文件是否可预览
export function isPreviewable(extension: string): boolean {
  const previewExts = [
    'txt', 'json', 'csv', 'md', 'xml', 'yaml', 'yml', 'log',
    'py', 'js', 'ts', 'jsx', 'tsx', 'java', 'cpp', 'c', 'go', 'rs',
    'ini', 'conf', 'env', 'toml', 'html', 'css', 'scss', 'less',
    'sql', 'sh', 'bash', 'ps1', 'rb', 'php', 'r',
    'pdf', 'docx', 'pptx',
    'jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico',
  ];
  return previewExts.includes(extension.toLowerCase());
}
