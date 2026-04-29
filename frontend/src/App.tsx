import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Breadcrumb from './components/Breadcrumb';
import FileList from './components/FileList';
import PreviewModal from './components/PreviewModal';
import UploadModal from './components/UploadModal';
import CreateDirModal from './components/CreateDirModal';
import DeleteConfirmModal from './components/DeleteConfirmModal';
import { getFiles, downloadFile, deleteFile, getRoots } from './services/api';
import type { FileListResponse, FileItem, RootDirectory } from './types';

// 解析路径：分离 root 和相对路径
// 当 fullPath 为空时，使用当前选中的 root 或第一个可用 root
function getDefaultRoot(roots: RootDirectory[]): string {
  if (roots.length === 0) return 'default';
  // 优先使用 'default' 别名（如果存在）
  const defaultRoot = roots.find(r => r.alias === 'default');
  if (defaultRoot) return 'default';
  // 否则使用第一个根目录
  return roots[0].alias;
}

function usePathParser(roots: RootDirectory[]) {
  const rootAliases = useMemo(() => {
    const aliases = new Set(roots.map(r => r.alias));
    // 按长度降序排序，优先匹配较长别名
    return Array.from(aliases).sort((a, b) => b.length - a.length);
  }, [roots]);

  const defaultRoot = useMemo(() => getDefaultRoot(roots), [roots]);

  return useCallback((fullPath: string): { root: string; relPath: string } => {
    if (!fullPath) {
      return { root: defaultRoot, relPath: '' };
    }

    const parts = fullPath.split('/');
    const firstPart = parts[0];

    for (const alias of rootAliases) {
      if (firstPart === alias) {
        return {
          root: alias,
          relPath: parts.slice(1).join('/')
        };
      }
    }

    // 没有匹配到别名，使用默认根目录
    return { root: defaultRoot, relPath: fullPath };
  }, [rootAliases, defaultRoot]);
}

const App: React.FC = () => {
  const [fileList, setFileList] = useState<FileListResponse | null>(null);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [currentRoot, setCurrentRoot] = useState<string>('default');
  const [roots, setRoots] = useState<RootDirectory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>(''); // 搜索关键词

  // 预览模态框状态
  const [previewFileItem, setPreviewFileItem] = useState<FileItem | null>(null);

  // 上传模态框状态
  const [uploadOpen, setUploadOpen] = useState(false);

  // 新建目录模态框状态
  const [createDirOpen, setCreateDirOpen] = useState(false);

  // 删除确认模态框状态
  const [deleteFileItem, setDeleteFileItem] = useState<FileItem | null>(null);

  // 标记初始加载是否已执行
  const initialLoadDone = useRef(false);

  // 使用 useCallback 缓存路径解析器
  const parsePath = usePathParser(roots);

  // 加载根目录列表
  useEffect(() => {
    const loadRoots = async () => {
      try {
        console.log('[App] Loading roots...');
        const rootsData = await getRoots();
        console.log('[App] Roots loaded:', rootsData);
        setRoots(rootsData);
        // 如果当前根目录不在有效别名列表中，自动切换到默认根目录
        const validAliases = rootsData.map(r => r.alias);
        console.log('[App] Valid aliases:', validAliases, 'currentRoot:', currentRoot);
        if (!validAliases.includes(currentRoot)) {
          const defaultRoot = getDefaultRoot(rootsData);
          console.log('[App] Current root invalid, switching to:', defaultRoot);
          setCurrentRoot(defaultRoot);
        }
      } catch (err) {
        console.error('[App] Failed to load roots:', err);
      }
    };
    loadRoots();
  }, []);

  // 加载文件列表（使用 useCallback 避免重复创建）
  const loadFiles = useCallback(async (fullPath: string) => {
    // 清空搜索
    setSearchQuery('');

    // 构建用于解析的路径：确保包含根目录信息
    let pathToParse: string;
    if (!fullPath) {
      // 空路径使用当前根目录（点击面包屑根目录时）
      pathToParse = currentRoot;
    } else {
      const rootAliases = roots.map(r => r.alias);
      const isRootPath = rootAliases.some(alias => fullPath === alias || fullPath.startsWith(alias + '/'));
      if (!isRootPath) {
        // 相对路径，添加当前根目录前缀
        pathToParse = `${currentRoot}/${fullPath}`;
      } else {
        pathToParse = fullPath;
      }
    }

    // 解析路径
    const { root, relPath } = parsePath(pathToParse);

    setLoading(true);
    setError(null);
    try {
      const data = await getFiles(relPath, root);
      // 确保数据结构完整
      const safeData: FileListResponse = {
        current_path: data.current_path || '',
        parent_path: data.parent_path || null,
        directories: Array.isArray(data.directories) ? data.directories : [],
        files: Array.isArray(data.files) ? data.files : [],
      };
      setFileList(safeData);
      setCurrentRoot(root);

      // 从返回的 current_path 提取相对路径
      // API 返回格式: "root/subpath" 或 "root"
      let returnedRelPath = safeData.current_path;
      const prefix = root + '/';
      if (returnedRelPath.startsWith(prefix)) {
        returnedRelPath = returnedRelPath.slice(prefix.length);
      } else if (returnedRelPath === root) {
        returnedRelPath = '';
      }
      setCurrentPath(returnedRelPath);
    } catch (err: any) {
      console.error('loadFiles error:', err);
      const message = err?.message || (typeof err === 'string' ? err : 'Failed to load files');
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [parsePath, currentRoot, roots]);

  // 初始加载文件列表（在根目录加载完成后）
  useEffect(() => {
    if (roots.length > 0 && !initialLoadDone.current) {
      console.log('[App] Initial load, roots ready:', roots);
      loadFiles('');
      initialLoadDone.current = true;
    }
  }, [roots, loadFiles]);

  // 切换根目录
  const handleRootChange = useCallback((alias: string) => {
    loadFiles(alias);
  }, [loadFiles]);

  // 导航处理
  const handleNavigate = useCallback((path: string) => {
    loadFiles(path);
  }, [loadFiles]);

  // 预览处理
  const handlePreview = useCallback((file: FileItem) => {
    setPreviewFileItem(file);
  }, []);

  // 下载处理
  const handleDownload = useCallback((file: FileItem) => {
    downloadFile(file.path, currentRoot);
  }, [currentRoot]);

  // 上传完成刷新列表
  const handleUploadComplete = useCallback(() => {
    setUploadOpen(false);
    loadFiles(currentPath ? `${currentRoot}/${currentPath}` : currentRoot);
  }, [currentPath, currentRoot, loadFiles]);

  // 新建目录
  const handleCreateDir = useCallback(() => {
    setCreateDirOpen(true);
  }, []);

  // 新建目录完成
  const handleCreateDirComplete = useCallback((_newDirName: string) => {
    setCreateDirOpen(false);
    loadFiles(currentPath ? `${currentRoot}/${currentPath}` : currentRoot);
  }, [currentPath, currentRoot, loadFiles]);

  // 删除文件/目录
  const handleDelete = useCallback((file: FileItem) => {
    setDeleteFileItem(file);
  }, []);

  // 确认删除
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteFileItem) return;

    try {
      await deleteFile(deleteFileItem.path, currentRoot);
      setDeleteFileItem(null);
      loadFiles(currentPath ? `${currentRoot}/${currentPath}` : currentRoot);
    } catch (err: any) {
      alert(`删除失败: ${err.message || '未知错误'}`);
    }
  }, [deleteFileItem, currentRoot, currentPath, loadFiles]);

  // 获取当前根目录的显示名称
  const currentRootInfo = useMemo(() =>
    roots.find(r => r.alias === currentRoot),
    [roots, currentRoot]
  );
  const currentRootName = useMemo(() =>
    currentRootInfo?.name || currentRootInfo?.alias || currentRoot,
    [currentRootInfo, currentRoot]
  );

  // 计算重试路径
  const retryPath = useMemo(() => {
    const path = `${currentRoot}/${currentPath}`.replace(/\/+$/, '').replace(/^\/+/, '');
    return path;
  }, [currentRoot, currentPath]);

  // 过滤后的文件列表（搜索功能）
  const filteredFileList = useMemo((): FileListResponse | null => {
    if (!fileList) return null;
    if (!searchQuery.trim()) return fileList;

    const query = searchQuery.toLowerCase().trim();
    const directories = fileList.directories || [];
    const files = fileList.files || [];
    const filteredDirectories = directories.filter(dir =>
      dir.name?.toLowerCase().includes(query)
    );
    const filteredFiles = files.filter(file =>
      file.name?.toLowerCase().includes(query)
    );

    return {
      ...fileList,
      directories: filteredDirectories,
      files: filteredFiles,
    };
  }, [fileList, searchQuery]);

  // 搜索匹配计数
  const searchMatchCount = useMemo(() => {
    if (!filteredFileList) return 0;
    return filteredFileList.directories.length + filteredFileList.files.length;
  }, [filteredFileList]);

  // 是否显示搜索结果
  const hasSearchResults = searchQuery.trim().length > 0;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1>📁 文件管理器</h1>
          {roots.length > 1 && (
            <div className="root-selector">
              <label>存储位置：</label>
              <select
                value={currentRoot}
                onChange={(e) => handleRootChange(e.target.value)}
              >
                {roots.map((root) => (
                  <option key={root.alias} value={root.alias}>
                    {root.name || root.alias} ({root.path})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <button
          className="upload-btn"
          onClick={() => setUploadOpen(true)}
        >
          📤 上传文件
        </button>
      </header>

      <main className="app-main">
        {/* 顶部控制栏 - 根目录加载后显示 */}
        {roots.length > 0 && (
          <div className="top-bar">
            <Breadcrumb
              currentPath={currentPath}
              onNavigate={handleNavigate}
              rootName={currentRootName}
            />
            <div className="top-bar-right">
              <div className="search-bar-inline">
                <div className="search-input-wrapper">
                  <span className="search-icon">🔍</span>
                  <input
                    type="text"
                    className="search-input"
                    placeholder="搜索..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      className="search-clear-btn"
                      onClick={() => setSearchQuery('')}
                      title="清除搜索"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {hasSearchResults && fileList && (
                  <span className="search-hint">
                    {searchMatchCount} 项
                    {searchMatchCount !== fileList.directories.length + fileList.files.length && (
                      <span className="search-total-hint">
                        {' '}/ {fileList.directories.length + fileList.files.length}
                      </span>
                    )}
                  </span>
                )}
              </div>
              <button
                className="create-dir-btn"
                onClick={handleCreateDir}
                title="新建目录"
              >
                📁 新建目录
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="loading-state">
            <div className="spinner">⏳</div>
            <p>加载中...</p>
          </div>
        ) : error ? (
          <div className="error-state">
            <div className="error-icon">❌</div>
            <p>{error}</p>
            <button onClick={() => loadFiles(retryPath)}>
              重试
            </button>
          </div>
        ) : fileList ? (
          <>
            <FileList
              data={filteredFileList || fileList}
              onNavigate={handleNavigate}
              onPreview={handlePreview}
              onDownload={handleDownload}
              onDelete={handleDelete}
            />
            {/* 搜索无结果提示 */}
            {hasSearchResults && filteredFileList && searchMatchCount === 0 && (
              <div className="search-no-results">
                <div className="no-results-icon">🔍</div>
                <p>未找到匹配 "<strong>{searchQuery}</strong>" 的文件或目录</p>
                <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
                  清除搜索
                </button>
              </div>
            )}
          </>
        ) : null}
      </main>

      {/* 预览模态框 */}
      <PreviewModal
        file={previewFileItem}
        root={currentRoot}
        onClose={() => setPreviewFileItem(null)}
      />

      {/* 上传模态框 */}
      {uploadOpen && (
        <UploadModal
          currentPath={currentPath}
          root={currentRoot}
          onUploadComplete={handleUploadComplete}
          onClose={() => setUploadOpen(false)}
        />
      )}

      {/* 新建目录模态框 */}
      {createDirOpen && (
        <CreateDirModal
          currentPath={currentPath}
          root={currentRoot}
          onCreateComplete={handleCreateDirComplete}
          onClose={() => setCreateDirOpen(false)}
        />
      )}

      {/* 删除确认模态框 */}
      {deleteFileItem && (
        <DeleteConfirmModal
          file={deleteFileItem}
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeleteFileItem(null)}
        />
      )}
    </div>
  );
};

export default App;
