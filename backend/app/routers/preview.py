import os
from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from ..utils.preview import get_file_preview_info

router = APIRouter(prefix="/api/preview", tags=["Preview"])

@router.get("", response_model=None)
async def preview_file(
    root: str = Query("default", description="Root alias (e.g., default, openclaw)"),
    path: str = Query(..., description="Relative path of the file to preview")
):
    """
    预览文件内容

    根据文件类型返回不同的预览数据：
    - 文本文件：返回提取的文本内容
    - PDF：返回PDF文件的访问URL
    - 图片：返回base64编码的图片数据
    - Word/PPT：返回提取的文本内容

    不支持预览的文件类型会返回错误信息
    """
    # 构建完整路径格式 "root/path"
    full_path = f"{root}/{path}" if path else root

    return get_file_preview_info(full_path)
