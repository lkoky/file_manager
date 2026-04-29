from fastapi import APIRouter
from ..config import get_upload_roots

router = APIRouter(prefix="/api", tags=["Configuration"])

@router.get("/roots")
async def list_roots():
    """
    获取所有可用的上传根目录列表
    """
    roots = get_upload_roots()
    result = []
    for alias, path in roots.items():
        result.append({
            "alias": alias,
            "path": path,
            "name": alias,  # 默认名称就是别名，可扩展为友好名称
        })
    return result
