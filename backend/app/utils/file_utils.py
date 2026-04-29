import os
from datetime import datetime
from typing import Tuple, Dict, Optional, NamedTuple
from fastapi import HTTPException
from functools import lru_cache
from ..config import settings, UPLOAD_ROOTS


@lru_cache(maxsize=128)
def get_root_aliases() -> Dict[str, str]:
    """获取所有根目录别名和路径映射（带缓存）"""
    return UPLOAD_ROOTS.copy()


@lru_cache(maxsize=128)
def resolve_root_path(root_alias: str) -> str:
    """根据别名获取根目录绝对路径（带缓存）"""
    roots = get_root_aliases()
    if root_alias not in roots:
        raise HTTPException(400, f"Unknown root alias: {root_alias}. Available: {list(roots.keys())}")
    return roots[root_alias]


def get_mime_type(extension: str) -> str:
    """获取文件的 MIME 类型"""
    ext = extension.lower().lstrip('.')
    mime_types = {
        '.pdf': 'application/pdf',
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.webp': 'image/webp',
        '.bmp': 'image/bmp',
        '.ico': 'image/x-icon',
        '.txt': 'text/plain',
        '.json': 'application/json',
        '.md': 'text/markdown',
        '.xml': 'application/xml',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    }
    return mime_types.get('.' + ext, 'application/octet-stream')


class FileStat(NamedTuple):
    """文件统计信息命名元组，减少内存占用"""
    size: int
    mtime: float
    is_dir: bool


@lru_cache(maxsize=1024)
def _cached_file_stat(file_path: str) -> FileStat:
    """缓存的文件统计信息（适用于频繁访问的少量文件）"""
    stat = os.stat(file_path)
    return FileStat(
        size=stat.st_size,
        mtime=stat.st_mtime,
        is_dir=os.path.isdir(file_path)
    )


def clear_file_cache() -> None:
    """清除文件统计缓存（在文件变更时调用）"""
    _cached_file_stat.cache_clear()


def parse_path(path: str) -> Tuple[str, str]:
    """
    解析路径，分离 root_alias 和相对路径

    Args:
        path: 完整路径，格式为 "root_alias/sub/path" 或 "sub/path"（默认使用 default）

    Returns:
        (root_alias, relative_path)
    """
    if not path:
        return "default", ""

    # 移除前导斜杠
    path = path.strip('/')

    # 检查是否以已知根目录别名开头
    roots = get_root_aliases()
    # 按长度降序排序，优先匹配较长的别名（避免 "default" 匹配 "default2"）
    sorted_roots = sorted(roots.keys(), key=len, reverse=True)

    for alias in sorted_roots:
        alias_with_slash = alias + '/'
        if path.startswith(alias_with_slash) or path == alias:
            relative = path[len(alias):].lstrip('/')
            return alias, relative

    # 没有匹配到别名，使用默认根目录
    return "default", path


def validate_file_access(root_alias: str, rel_path: str) -> Tuple[str, str]:
    """
    验证文件访问权限并返回安全路径

    Args:
        root_alias: 根目录别名
        rel_path: 相对路径

    Returns:
        (upload_dir, full_path) 元组

    Raises:
        HTTPException: 如果路径无效或越界
    """
    try:
        upload_dir = ensure_upload_dir(root_alias)
    except HTTPException:
        raise HTTPException(404, f"Root '{root_alias}' not found")

    if not rel_path:
        raise HTTPException(400, "Path is required")

    try:
        full_path = safe_join(root_alias, rel_path)
    except Exception as e:
        raise e

    return upload_dir, full_path


def safe_join(root_alias: str, *paths: str) -> str:
    """
    安全拼接路径，防止目录穿越攻击

    Args:
        root_alias: 根目录别名
        *paths: 路径片段

    Returns:
        安全的绝对路径

    Raises:
        HTTPException: 如果路径越界
    """
    base_dir = resolve_root_path(root_alias)

    # 拼接并获取绝对路径
    result = os.path.abspath(os.path.join(base_dir, *paths))
    base_abs = os.path.abspath(base_dir)

    # 使用 commonpath 检查 result 是否在 base_abs 内
    try:
        common = os.path.commonpath([result, base_abs])
        if common != base_abs:
            raise HTTPException(400, "Invalid path: directory traversal detected")
    except ValueError:
        raise HTTPException(400, "Invalid path")

    return result


def get_file_info(file_path: str, relative_to: Optional[str] = None, use_cache: bool = False) -> dict:
    """
    获取文件/目录信息

    Args:
        file_path: 文件/目录的绝对路径
        relative_to: 用于计算相对路径的基准目录（可以是 root_alias 或绝对路径）
        use_cache: 是否使用文件统计缓存（适用于重复读取的场景）

    Returns:
        文件信息字典
    """
    if use_cache:
        stat_result = _cached_file_stat(file_path)
        size = stat_result.size
        mtime = stat_result.mtime
        is_dir = stat_result.is_dir
    else:
        stat = os.stat(file_path)
        size = stat.st_size
        mtime = stat.st_mtime
        is_dir = os.path.isdir(file_path)

    name = os.path.basename(file_path)

    if relative_to is None:
        # 自动从路径推断 root_alias
        relative_to = os.path.dirname(file_path)

    # 计算相对路径
    rel_path = os.path.relpath(file_path, relative_to)

    # 获取扩展名（小写，不含点）
    _, ext = os.path.splitext(name)
    extension = ext.lower().lstrip('.') if ext else ''

    return {
        "name": name,
        "path": rel_path.replace(os.sep, '/'),  # 统一使用 / 分隔符
        "is_dir": is_dir,
        "size": size,
        "modified": datetime.fromtimestamp(mtime).isoformat(),
        "extension": extension,
    }


def list_directory(dir_path: str, root_alias: Optional[str] = None, base_path: Optional[str] = None) -> Tuple[list, list]:
    """
    列出目录内容

    Args:
        dir_path: 目录的绝对路径
        root_alias: 根目录别名，用于计算相对路径
        base_path: 用于计算相对路径的基准目录，默认为 dir_path 本身

    Returns:
        (目录列表, 文件列表)
    """
    if not os.path.exists(dir_path):
        raise HTTPException(404, "Directory not found")

    if not os.path.isdir(dir_path):
        raise HTTPException(400, "Path is not a directory")

    # 确定基准路径
    if base_path is not None:
        relative_to = base_path
    elif root_alias is not None:
        relative_to = resolve_root_path(root_alias)
    else:
        relative_to = dir_path

    directories = []
    files = []

    try:
        for entry in os.scandir(dir_path):
            # 使用 DirEntry 的 stat 缓存，避免重复系统调用
            stat = entry.stat(follow_symlinks=False)
            name = entry.name
            rel_path = os.path.relpath(entry.path, relative_to)

            # 获取扩展名
            _, ext = os.path.splitext(name)
            extension = ext.lower().lstrip('.') if ext else ''

            info = {
                "name": name,
                "path": rel_path.replace(os.sep, '/'),
                "is_dir": entry.is_dir(follow_symlinks=False),
                "size": stat.st_size,
                "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                "extension": extension,
            }

            if entry.is_dir(follow_symlinks=False):
                directories.append(info)
            else:
                files.append(info)

        # 排序：目录在前，文件在后；都按名称排序
        directories.sort(key=lambda x: x["name"])
        files.sort(key=lambda x: x["name"])
    except PermissionError:
        raise HTTPException(500, "Permission denied when reading directory")

    return directories, files


def ensure_upload_dir(root_alias: str = "default") -> str:
    """确保指定根目录存在，返回绝对路径"""
    path = resolve_root_path(root_alias)
    os.makedirs(path, exist_ok=True)
    return path
