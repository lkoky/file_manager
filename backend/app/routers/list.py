import os
from fastapi import APIRouter, Query, HTTPException
from ..utils.file_utils import parse_path, list_directory, ensure_upload_dir, get_root_aliases

router = APIRouter(prefix="/api/files", tags=["Files"])


@router.get("")
async def get_files(
    path: str = Query("", description="Relative path within upload directory, format: [root_alias/]sub/path"),
    root: str = Query("default", description="Root alias (default, openclaw, etc.)")
):
    """
    获取指定目录的文件列表

    - path: 相对路径（可选，默认为根目录）
    - root: 根目录别名（默认 default）
    - 返回：当前目录信息、父目录路径、子目录列表、文件列表
    """
    # 获取所有可用根目录别名
    available_roots = list(get_root_aliases().keys())

    # 处理 root 参数：如果是 "default" 但实际配置中没有 default，则使用第一个可用根目录
    if root == "default" and "default" not in available_roots:
        if available_roots:
            root_alias = available_roots[0]
        else:
            raise HTTPException(404, "No upload directories configured")
    else:
        root_alias = root

    rel_path = path.strip("/") if path else ""

    try:
        upload_dir = ensure_upload_dir(root_alias)
    except HTTPException:
        raise HTTPException(404, f"Upload directory '{root_alias}' not found")

    target_dir = os.path.join(upload_dir, rel_path) if rel_path else upload_dir

    # 列出目录内容，使用根目录作为基准路径
    directories, files = list_directory(target_dir, root_alias=root_alias, base_path=upload_dir)

    # 计算父目录路径（相对于根目录）
    parent_path = None
    if rel_path:
        parent_rel = os.path.dirname(rel_path)
        parent_path = f"{root_alias}/{parent_rel}" if parent_rel else root_alias

    return {
        "current_path": f"{root_alias}/{rel_path}" if rel_path else root_alias,
        "parent_path": parent_path,
        "directories": directories,
        "files": files,
    }
