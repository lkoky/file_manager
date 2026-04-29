from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class FileItem(BaseModel):
    """文件/目录项模型"""
    name: str
    path: str
    is_dir: bool
    size: int
    modified: str
    extension: str

class FileListResponse(BaseModel):
    """文件列表响应"""
    current_path: str
    parent_path: Optional[str]
    directories: List[FileItem]
    files: List[FileItem]

class PreviewResponse(BaseModel):
    """预览响应"""
    filename: str
    content: Optional[str] = None
    type: str = "text"  # "text" | "image" | "pdf"
    error: Optional[str] = None

class UploadResponse(BaseModel):
    """上传响应"""
    success: bool
    filename: str
    path: str
    size: int
    message: Optional[str] = None

class ErrorResponse(BaseModel):
    """错误响应"""
    error: str
    detail: Optional[str] = None
