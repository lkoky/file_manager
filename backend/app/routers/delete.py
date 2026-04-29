import os
from fastapi import APIRouter, HTTPException, Query, Body
from ..utils.file_utils import parse_path, safe_join, ensure_upload_dir

router = APIRouter(prefix="/api", tags=["Directories"])


@router.post("/create-directory")
async def create_directory(
    root: str = Body("default", embed=True, description="Root alias"),
    path: str = Body("", embed=True, description="Parent directory relative path"),
    name: str = Body(..., embed=True, description="New directory name")
):
    """
    创建新目录

    - root: 根目录别名
    - path: 父目录相对路径（相对于指定根目录）
    - name: 新目录名称
    """
    try:
        upload_dir = ensure_upload_dir(root)
    except HTTPException:
        raise HTTPException(404, f"Root '{root}' not found")

    # 处理父目录路径
    rel_path = path.strip("/") if path else ""
    parent_full_path = safe_join(root, rel_path) if rel_path else upload_dir

    # 验证父目录存在
    if not os.path.exists(parent_full_path):
        raise HTTPException(404, "Parent directory not found")

    if not os.path.isdir(parent_full_path):
        raise HTTPException(400, "Parent path is not a directory")

    # 验证目录名称
    if not name or name.strip() == "":
        raise HTTPException(400, "Directory name cannot be empty")

    # 检查非法字符
    invalid_chars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|']
    for char in invalid_chars:
        if char in name:
            raise HTTPException(400, f"Directory name contains invalid character: '{char}'")

    # 构建新目录的完整路径
    new_dir_path = os.path.join(parent_full_path, name)

    # 检查是否已存在
    if os.path.exists(new_dir_path):
        raise HTTPException(400, f"Directory or file '{name}' already exists")

    try:
        os.makedirs(new_dir_path, exist_ok=False)
    except OSError as e:
        raise HTTPException(500, f"Failed to create directory: {str(e)}")

    # 返回新目录信息
    from ..utils.file_utils import get_file_info
    dir_info = get_file_info(new_dir_path, upload_dir)

    return {
        "success": True,
        "name": dir_info["name"],
        "path": dir_info["path"],
        "message": f"Directory '{name}' created successfully"
    }


@router.delete("/files")
async def delete_file(
    root: str = Query("default", description="Root alias"),
    path: str = Query(..., description="Relative path of the file or directory to delete")
):
    """
    删除文件或目录

    - root: 根目录别名
    - path: 相对于根目录的路径
    - 如果是目录，会递归删除所有内容
    """
    try:
        upload_dir = ensure_upload_dir(root)
    except HTTPException:
        raise HTTPException(404, f"Root '{root}' not found")

    # 解码路径
    rel_path = path.strip("/") if path else ""
    if not rel_path:
        raise HTTPException(400, "Path is required")

    try:
        full_path = safe_join(root, rel_path)
    except Exception as e:
        raise e

    # 检查是否存在
    if not os.path.exists(full_path):
        raise HTTPException(404, "File or directory not found")

    try:
        if os.path.isdir(full_path):
            import shutil
            shutil.rmtree(full_path)
        else:
            os.remove(full_path)
    except OSError as e:
        raise HTTPException(500, f"Failed to delete: {str(e)}")

    return {
        "success": True,
        "message": f"Successfully deleted '{rel_path}'"
    }
