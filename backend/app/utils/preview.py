import os
import base64
from urllib.parse import quote
from fastapi import HTTPException
from ..config import settings
from .file_utils import parse_path, safe_join, get_file_info, validate_file_access, get_mime_type


def get_file_preview_info(path: str) -> dict:
    """
    获取文件预览信息

    Args:
        path: 文件路径，格式 "root_alias/sub/path" 或 "sub/path"（使用 default 根目录）

    Returns:
        预览信息字典
    """
    # 解析路径
    root_alias, rel_path = parse_path(path)

    if not rel_path:
        raise HTTPException(400, "File path is required")

    # 验证路径并获取文件
    upload_dir, full_path = validate_file_access(root_alias, rel_path)

    return _generate_preview(full_path, rel_path, root_alias)


def _generate_preview(file_path: str, relative_path: str, root_alias: str) -> dict:
    """生成预览数据"""
    if not os.path.exists(file_path):
        raise HTTPException(404, "File not found")

    if os.path.isdir(file_path):
        raise HTTPException(400, "Cannot preview a directory")

    # 检查文件大小
    file_size = os.path.getsize(file_path)
    filename = os.path.basename(file_path)
    _, ext = os.path.splitext(filename)
    extension = ext.lower().lstrip('.') if ext else ''

    # 检查是否允许预览
    if extension not in settings.PREVIEW_ALLOWED_EXTENSIONS:
        return {
            "filename": filename,
            "type": "unsupported",
            "content": None,
            "error": f"File type .{extension} does not support preview"
        }

    # 检查预览大小限制
    if file_size > settings.PREVIEW_MAX_SIZE:
        return {
            "filename": filename,
            "type": "unsupported",
            "content": None,
            "error": f"File too large for preview (max {settings.PREVIEW_MAX_SIZE // 1024 // 1024}MB)"
        }

    # 根据类型处理
    try:
        if extension in settings.IMAGE_EXTENSIONS:
            # 图片：返回 base64
            return _preview_image(file_path, filename)

        elif extension == "pdf":
            # PDF：返回访问 URL
            return {
                "filename": filename,
                "type": "pdf",
                "content": f"/api/file-content?root={root_alias}&path={quote(relative_path)}",
                "error": None
            }

        elif extension == "docx":
            # Word：返回文件 URL
            return {
                "filename": filename,
                "type": "docx",
                "content": f"/api/file-content?root={root_alias}&path={quote(relative_path)}",
                "error": None
            }

        else:
            # 文本文件（包括 pptx）：直接读取
            return _preview_text(file_path, filename)

    except Exception as e:
        return {
            "filename": filename,
            "type": "unsupported",
            "content": None,
            "error": f"Failed to preview: {str(e)}"
        }


def _preview_text(file_path: str, filename: str) -> dict:
    """预览文本文件（支持大文件截断）"""
    try:
        # 检查文件大小，过大的文件只读取前部分
        file_size = os.path.getsize(file_path)
        max_read_size = 1024 * 1024  # 1MB 限制

        with open(file_path, 'r', encoding='utf-8') as f:
            if file_size > max_read_size:
                # 大文件只读取前 1MB 并提示
                content = f.read(max_read_size)
                content += f"\n\n[文件较大，仅显示前 {max_read_size // 1024}KB 内容...]"
            else:
                content = f.read()
        return {
            "filename": filename,
            "type": "text",
            "content": content,
            "error": None
        }
    except UnicodeDecodeError:
        # 尝试其他编码
        for encoding in ['gbk', 'gb2312', 'latin1', 'cp1252']:
            try:
                with open(file_path, 'r', encoding=encoding) as f:
                    if file_size > max_read_size:
                        content = f.read(max_read_size)
                        content += f"\n\n[文件较大，仅显示前 {max_read_size // 1024}KB 内容...]"
                    else:
                        content = f.read()
                return {
                    "filename": filename,
                    "type": "text",
                    "content": content,
                    "error": None
                }
            except UnicodeDecodeError:
                continue
        raise HTTPException(400, "Unable to decode file with supported encodings")


def _preview_image(file_path: str, filename: str) -> dict:
    """预览图片文件（返回 base64）"""
    try:
        with open(file_path, 'rb') as f:
            image_data = f.read()
        # 获取图片 mime type
        _, ext = os.path.splitext(filename)
        mime_type = get_mime_type(ext)
        base64_data = base64.b64encode(image_data).decode('utf-8')
        return {
            "filename": filename,
            "type": "image",
            "content": f"data:{mime_type};base64,{base64_data}",
            "error": None
        }
    except Exception as e:
        raise HTTPException(500, f"Failed to read image: {str(e)}")
