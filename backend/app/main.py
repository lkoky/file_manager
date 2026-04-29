from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from starlette.middleware.gzip import GZipMiddleware
from app.routers import list as list_router, files, preview, upload, directories, delete, roots
from app.config import settings

app = FastAPI(
    title="File Manager API",
    description="File upload/download and preview API",
    version="1.0.0"
)

# 添加 GZip 压缩中间件（压缩文本响应）
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS 中间件（限制允许的域名）
allowed_origins = settings.ALLOWED_ORIGINS if hasattr(settings, 'ALLOWED_ORIGINS') and settings.ALLOWED_ORIGINS else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(list_router.router)
app.include_router(files.router)
app.include_router(preview.router)
app.include_router(upload.router)
app.include_router(directories.router)
app.include_router(delete.router)
app.include_router(roots.router)


@app.get("/")
async def root():
    """根路径，返回 API 信息"""
    return {
        "name": "File Manager API",
        "version": "1.0.0",
        "docs": "/docs",
        "upload_dir": settings.UPLOAD_DIR
    }


@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {"status": "healthy"}


# 中间件：添加缓存和安全头
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)

    # 安全头
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"

    # API 响应不缓存，确保获取最新内容
    if request.url.path.startswith('/api/'):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"

    return response
