import os
from pydantic_settings import BaseSettings
from typing import Optional, Dict, List, Union

class Settings(BaseSettings):
    """应用配置"""

    # 文件存储根目录（单目录，向后兼容）
    UPLOAD_DIR: str = "uploads"

    # 多根目录配置（可选）
    # 格式1（列表）: ["/path/root1", "/path/root2"] - 自动生成别名 root0, root1
    # 格式2（字典）: {"default": "/path/root1", "openclaw": "/home/user/.openclaw/workspace"}
    UPLOAD_DIRS: Union[List[str], Dict[str, str]] = []

    # 最大文件大小（100MB）
    MAX_FILE_SIZE: int = 100 * 1024 * 1024

    # 预览最大文件大小（5MB）
    PREVIEW_MAX_SIZE: int = 5 * 1024 * 1024

    # 允许预览的文件类型（扩展名，不含点）
    PREVIEW_ALLOWED_EXTENSIONS: set = {
        # 文本/代码
        "txt", "json", "csv", "md", "xml", "yaml", "yml", "log",
        "py", "js", "ts", "jsx", "tsx", "java", "cpp", "c", "go", "rs",
        "ini", "conf", "env", "toml", "html", "css", "scss", "less",
        "sql", "sh", "bash", "ps1", "rb", "php", "r",
        # 文档
        "pdf",
        "docx", "pptx",
        # 图片
        "jpg", "jpeg", "png", "gif", "svg", "webp", "bmp", "ico",
    }

    # 支持的图片类型（用于预览）
    IMAGE_EXTENSIONS: set = {"jpg", "jpeg", "png", "gif", "svg", "webp", "bmp", "ico"}

    # CORS 允许的源（生产环境应设置为具体域名）
    # 例如: ["http://localhost:5173", "https://yourdomain.com"]
    ALLOWED_ORIGINS: List[str] = ["*"]

    class Config:
        env_file = ".env"

settings = Settings()

# 规范化上传目录配置为字典格式 {别名: 路径}
def get_upload_roots() -> Dict[str, str]:
    """获取所有上传根目录映射"""
    roots = {}

    # 如果配置了 UPLOAD_DIRS（列表或字典），优先使用
    if settings.UPLOAD_DIRS:
        if isinstance(settings.UPLOAD_DIRS, dict):
            # 字典格式：{"alias": "path", ...}
            for alias, path in settings.UPLOAD_DIRS.items():
                roots[alias] = os.path.abspath(path)
        elif isinstance(settings.UPLOAD_DIRS, list):
            # 列表格式：自动生成别名 root0, root1...
            for i, path in enumerate(settings.UPLOAD_DIRS):
                alias = f"root{i}"
                roots[alias] = os.path.abspath(path)
    else:
        # 回退到单目录配置
        roots["default"] = os.path.abspath(settings.UPLOAD_DIR)

    return roots

# 获取所有根目录
UPLOAD_ROOTS = get_upload_roots()

# 确保所有上传目录存在
for path in UPLOAD_ROOTS.values():
    os.makedirs(path, exist_ok=True)
