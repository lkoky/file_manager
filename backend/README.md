# File Manager Backend

Python FastAPI 后端服务，提供文件上传、下载、预览和浏览功能。

## 功能特性

- 文件浏览（支持多级目录）
- 文件预览（文本、图片、PDF、Word、PPT）
- 文件下载（支持中文文件名）
- 文件上传（支持指定上传目录）

## 技术栈

- **FastAPI** - 现代 Python Web 框架
- **Uvicorn** - ASGI 服务器
- **Pydantic** - 数据验证

预览策略：
- 文本文件：后端直接读取文本
- 图片：后端返回 base64
- PDF：后端返回文件流，前端 PDF.js 渲染
- Word/PPT：后端返回文件流，前端 mammoth.js 渲染

## 快速开始

### 环境要求

- Python 3.9+
- pip

### 安装依赖

```bash
cd backend
pip install -r requirements.txt
```

requirements.txt 内容：
- fastapi
- uvicorn[standard]
- python-multipart
- pydantic
- pydantic-settings

### 运行服务

#### 方式一：使用服务管理脚本（推荐）

```bash
# 启动服务
./start.sh start

# 停止服务
./start.sh stop

# 重启服务
./start.sh restart

# 查看服务状态
./start.sh status

# 查看运行日志
./start.sh logs

# 实时跟踪日志
./start.sh logs -f

# 查看错误日志
./start.sh errors

# 查看帮助
./start.sh help
```

脚本特性：
- 自动检测虚拟环境
- PID 文件管理（`logs/app.pid`）
- 自动日志轮转和备份
- 健康检查验证启动
- 停止时自动清理子进程
- 彩色输出状态信息

#### 方式二：直接启动

```bash
# 开发模式（自动重载）
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 生产模式
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

服务启动后：
- API 文档：http://localhost:8000/docs
- 健康检查：http://localhost:8000/health

### 配置

创建 `.env` 文件自定义配置：

```env
# 单目录模式（向后兼容，默认使用此配置）
UPLOAD_DIR=uploads

# 多根目录配置（推荐，可设置多个存储位置）
# 支持两种格式：
# 1. 列表格式：自动生成别名 ["/path/root1", "/path/root2"]
#    别名自动为: root0, root1...
# 2. 字典格式：自定义别名 {"default": "/path/root1", "work": "/path/root2"}
#    别名可以是中文，如：{"默认": "/opt/uploads", "工作": "/home/user/work"}
# 注意：设置了 UPLOAD_DIRS 后，UPLOAD_DIR 会被忽略
# UPLOAD_DIRS=[]

# 最大上传文件大小（字节，默认 100MB）
MAX_FILE_SIZE=104857600

# 预览最大文件大小（字节，默认 5MB）
PREVIEW_MAX_SIZE=5242880

# CORS 允许的源（生产环境应设置为具体前端域名）
# 示例：ALLOWED_ORIGINS=["http://localhost:5173","https://yourdomain.com"]
ALLOWED_ORIGINS=["*"]
```

**多根目录配置示例：**

```bash
# 示例1：使用两个目录，自动生成别名
UPLOAD_DIRS=["/opt/uploads", "/home/user/workspace"]
# 前端将看到：root0 (别名), root1 (别名)

# 示例2：自定义英文别名
UPLOAD_DIRS={"default": "/opt/uploads", "openclaw": "/home/user/.openclaw/workspace"}
# 前端将看到：default, openclaw 两个选项

# 示例3：使用中文别名（支持）
UPLOAD_DIRS={"默认": "/opt/uploads", "工作": "/home/user/work", "临时": "/tmp"}
# 前端将看到：默认、工作、临时 三个选项

配置验证：
```bash
# 运行配置检查脚本验证配置
python3 check_config.py
```

# 示例3：使用中文别名
UPLOAD_DIRS={"默认": "/opt/uploads", "工作": "/home/user/work", "临时": "/tmp"}
# 前端将看到：默认、工作、临时 三个选项
```

默认配置：
- 上传目录：`backend/uploads/`
- 最大文件：100MB
- 预览最大：5MB

## API 接口

### 文件浏览

```
GET /api/files?path=
```

查询参数：
- `path`：相对路径（可选，默认为根目录）

响应示例：
```json
{
  "current_path": "",
  "parent_path": null,
  "directories": [
    {
      "name": "docs",
      "path": "docs",
      "is_dir": true,
      "size": 0,
      "modified": "2024-01-15T10:30:00",
      "extension": ""
    }
  ],
  "files": [
    {
      "name": "readme.txt",
      "path": "readme.txt",
      "is_dir": false,
      "size": 1024,
      "modified": "2024-01-15T10:30:00",
      "extension": "txt"
    }
  ]
}
```

### 文件预览

```
GET /api/preview?path=
```

查询参数：
- `path`：文件相对路径（必需）

响应示例：
```json
{
  "filename": "test.pdf",
  "type": "pdf",
  "content": "/api/file-content?path=test.pdf"
}
```

### 文件内容流

```
GET /api/file-content?path=
```

查询参数：
- `path`：文件相对路径（必需）

返回：文件原始流（用于预览）

### 文件下载

```
GET /api/download?path=
```

查询参数：
- `path`：文件相对路径（必需）

返回：文件下载流，自动处理中文文件名

### 文件上传

```
POST /api/upload
Content-Type: multipart/form-data
```

表单字段：
- `file`：上传的文件
- `target_path`：目标目录（可选，默认为根目录）

响应示例：
```json
{
  "success": true,
  "filename": "newfile.txt",
  "path": "newfile.txt",
  "size": 1024,
  "message": "File uploaded successfully"
}
```

## 支持的文件类型

### 预览支持

| 类型 | 扩展名 | 预览方式 |
|-----|--------|---------|
| 文本 | .txt, .json, .csv, .md, .py, .js, .ts... | 文本提取 |
| PDF | .pdf | 流式返回（PDF.js 渲染） |
| 图片 | .jpg, .png, .gif, .svg... | Base64 返回 |
| Word | .docx | 文本提取 |
| PPT | .pptx | 文本提取 |

### 仅下载

.zip, .rar, .exe, .dmg 等二进制文件

## 安全说明

- 所有路径操作限制在 `UPLOAD_DIR` 内
- 使用 `safe_join` 防止目录穿越攻击
- 限制文件大小上传
- 仅允许白名单扩展名进行预览

## 故障排除

### python-docx 或 python-pptx 安装失败

某些系统可能需要额外依赖：

```bash
# Ubuntu/Debian
sudo apt-get install python3-dev libxml2-dev libxslt1-dev

# macOS
brew install libxml2 libxslt
```

### 中文文件名乱码

确保系统环境支持 UTF-8：
```bash
export PYTHONIOENCODING=utf-8
```

## 服务管理

### 使用 start.sh 脚本

项目提供完整的服务管理脚本 `start.sh`，支持启动、停止、重启和监控。

```bash
# 查看所有可用命令
./start.sh help

# 常用操作
./start.sh start      # 启动
./start.sh stop       # 停止
./start.sh restart    # 重启
./start.sh status     # 状态
./start.sh logs       # 查看日志
./start.sh logs -f    # 实时跟踪日志
./start.sh errors     # 错误日志
```

脚本功能：
- ✓ 自动检测并使用虚拟环境
- ✓ PID 文件持久化（`logs/app.pid`）
- ✓ 启动前自动备份旧日志
- ✓ 健康检查验证服务就绪
- ✓ 停止时递归杀死所有子进程
- ✓ 彩色终端输出（状态清晰）
- ✓ 错误日志分离（`error.log`）

### 日志文件

服务日志位于 `backend/logs/` 目录：
- `app.log` - 主运行日志
- `error.log` - 错误日志
- `app.pid` - 进程ID文件

### 生产环境建议

生产环境推荐使用 systemd 管理服务：

```ini
# /etc/systemd/system/file-manager.service
[Unit]
Description=File Manager Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/file_bro/backend
Environment="PYTHONPATH=/path/to/file_bro/backend"
ExecStart=/path/to/file_bro/backend/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```
