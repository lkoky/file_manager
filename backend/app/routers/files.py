import os
from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import FileResponse
from ..utils.file_utils import parse_path, safe_join, ensure_upload_dir, validate_file_access, get_mime_type

router = APIRouter(prefix="/api", tags=["Files"])

@router.get("/file-content")
async def get_file_content(
    root: str = Query("default", description="Root alias (e.g., default, openclaw)"),
    path: str = Query(..., description="Relative path of the file")
):
    """
    获取文件的原始内容流（用于预览）

    - root: 根目录别名
    - path: 相对于根目录的路径
    - 返回：文件流，前端用于渲染预览
    """
    # 解析路径并验证
    root_alias, rel_path = parse_path(f"{root}/{path}" if path else root)
    upload_dir, full_path = validate_file_access(root_alias, rel_path)

    if not os.path.isfile(full_path):
        raise HTTPException(404, "File not found")

    # 获取文件名用于 Content-Type 推断
    filename = os.path.basename(full_path)
    _, ext = os.path.splitext(filename)

    media_type = get_mime_type(ext)

    return FileResponse(
        full_path,
        media_type=media_type,
        filename=filename
    )


@router.get("/download")
async def download_file(
    root: str = Query("default", description="Root alias"),
    path: str = Query(..., description="Relative path of the file to download")
):
    """
    下载文件

    - root: 根目录别名
    - path: 相对于根目录的路径
    - 返回：文件流，浏览器触发下载
    """
    # 解析路径并验证
    root_alias, rel_path = parse_path(f"{root}/{path}" if path else root)
    upload_dir, full_path = validate_file_access(root_alias, rel_path)

    if not os.path.isfile(full_path):
        raise HTTPException(404, "File not found")

    filename = os.path.basename(full_path)

    # 编码中文文件名
    from urllib.parse import quote
    encoded_filename = quote(filename)

    headers = {
        "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
        "Content-Type": "application/octet-stream",
    }

    return FileResponse(
        full_path,
        headers=headers,
        filename=filename
    )
