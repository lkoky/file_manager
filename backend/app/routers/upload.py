import os
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query
from fastapi.responses import JSONResponse
from typing import Optional
from ..models import UploadResponse
from ..utils.file_utils import parse_path, safe_join, ensure_upload_dir, validate_file_access
from ..config import settings

router = APIRouter(prefix="/api/upload", tags=["Upload"])

@router.post("", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(..., description="File to upload"),
    target_path: str = Form("", description="Target directory relative to upload root (format: [root_alias/]sub/path)"),
    root: str = Form("default", description="Root alias")
):
    """
    上传文件到指定目录

    - file: 上传的文件
    - target_path: 目标目录相对路径（相对于上传根目录）
    - root: 根目录别名

    返回上传结果信息
    """
    try:
        upload_dir = ensure_upload_dir(root)
    except HTTPException:
        raise HTTPException(404, f"Root '{root}' not found")

    # 处理目标路径
    rel_target_dir = target_path.strip("/") if target_path else ""

    try:
        # 安全获取目标目录
        target_dir = safe_join(root, rel_target_dir) if rel_target_dir else upload_dir
    except Exception as e:
        raise e

    # 确保目标目录存在
    os.makedirs(target_dir, exist_ok=True)

    # 检查文件名
    original_filename = file.filename
    if not original_filename:
        raise HTTPException(400, "Invalid filename")

    # 构建保存路径
    save_path = os.path.join(target_dir, original_filename)

    # 检查文件是否已存在
    if os.path.exists(save_path):
        raise HTTPException(409, f"File '{original_filename}' already exists")

    # 检查文件大小
    file.file.seek(0, os.SEEK_END)
    file_size = file.file.tell()
    file.file.seek(0)

    if file_size > settings.MAX_FILE_SIZE:
        raise HTTPException(
            400,
            f"File too large. Maximum size is {settings.MAX_FILE_SIZE // 1024 // 1024}MB"
        )

    # 保存文件
    try:
        with open(save_path, "wb") as buffer:
            import shutil
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(500, f"Failed to save file: {str(e)}")
    finally:
        file.file.close()

    # 计算相对于根目录的路径
    rel_path = os.path.relpath(save_path, upload_dir).replace(os.sep, '/')

    return UploadResponse(
        success=True,
        filename=original_filename,
        path=rel_path,
        size=file_size,
        message="File uploaded successfully"
    )
