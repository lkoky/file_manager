# File Manager - 文件上传下载管理系统

一个基于 Python FastAPI + React 的前后端分离文件管理系统，支持文件上传、下载、预览和多级目录浏览。

![Python](https://img.shields.io/badge/Python-3.9%2B-blue)
![React](https://img.shields.io/badge/React-18-green)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104-orange)

## 功能特性

- 📁 **多级目录浏览**：支持无限层级目录，点击即可进入
- 📤 **文件上传**：选择文件并指定上传目录（支持中文文件名）
- 📥 **文件下载**：一键下载，自动处理中文文件名编码
### 文件预览

#### 图片预览功能

点击图片文件后，会打开**全屏图片查看器**，支持以下操作：

- **放大/缩小**：点击工具栏按钮或使用键盘 `+` / `-`
- **重置视图**：点击重置按钮或按 `0`
- **鼠标滚轮**：直接滚动滚轮缩放
- **拖拽移动**：放大后按住鼠标拖拽查看图片不同区域
- **键盘快捷键**：
  - `+` / `=` - 放大
  - `-` - 缩小
  - `0` - 重置
  - `ESC` - 关闭查看器

- 点击图片本身也可以放大到 200%
- 右下角显示当前缩放比例

| 类型 | 扩展名 | 预览方式 |
|------|--------|----------|
| 图片 | .jpg, .png, .gif, .svg, .webp... | 全屏查看器（可缩放） |
- 🏠 **面包屑导航**：快速跳转到任意上级目录
- 🔒 **安全防护**：目录遍历攻击防护，路径限制在存储根目录内

## 技术栈

### 后端
- **FastAPI** - 现代 Python Web 框架
- **Uvicorn** - ASGI 服务器
- **Pydantic** - 数据验证

### 前端
- **React 18** + **TypeScript**
- **Vite** - 极速构建
- **Axios** - HTTP 客户端
- **react-pdf** - PDF 嵌入预览
- **mammoth.js** - Word 文档预览（浏览器端）

## 快速开始

### 克隆/进入项目

```bash
cd file_manager
```

### 启动后端

```bash
cd backend

# 方式1：使用服务管理脚本（推荐）
./service.sh start        # 启动
./service.sh stop         # 停止
./service.sh restart      # 重启
./service.sh status       # 查看状态
./service.sh logs         # 查看日志
./service.sh help         # 查看帮助

# 方式2：直接启动（开发模式）
uvicorn app.main:app --reload --port 8000
```

后端服务启动后：
- API 文档：http://localhost:8000/docs
- 健康检查：http://localhost:8000/health

### 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端应用将在 http://localhost:5173 启动。

### 访问应用

打开浏览器访问：http://localhost:5173

## 项目结构

```
file_manager/
├── backend/                  # Python FastAPI 后端
│   ├── app/
│   │   ├── main.py           # 应用入口
│   │   ├── config.py         # 配置管理
│   │   ├── models.py         # 数据模型
│   │   ├── routers/          # API 路由
│   │   │   ├── files.py      # 文件浏览/下载
│   │   │   ├── preview.py    # 文件预览
│   │   │   └── upload.py     # 文件上传
│   │   └── utils/            # 工具函数
│   │       ├── file_utils.py # 文件系统操作
│   │       └── preview.py    # 预览提取
│   ├── requirements.txt
│   ├── .env.example
│   ├── README.md
│   └── uploads/              # 文件存储目录（运行时创建）
├── frontend/                 # React 前端
│   ├── src/
│   │   ├── components/       # React 组件
│   │   ├── services/         # API 服务
│   │   ├── types/            # TypeScript 类型
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── package.json
│   ├── vite.config.ts
│   └── README.md
├── .gitignore
└── README.md
```

## API 接口速查

| 方法 | 路径 | 说明 |
|-----|------|-----|
| GET | `/api/files?path=` | 列出目录内容 |
| GET | `/api/preview?path=` | 预览文件 |
| GET | `/api/file-content?path=` | 获取文件流（预览用） |
| GET | `/api/download?path=` | 下载文件 |
| POST | `/api/upload` | 上传文件 |

详细接口文档请访问 http://localhost:8000/docs（启动后端后）

## 配置说明

### 后端配置（`.env`）

| 变量 | 说明 | 默认值 |
|-----|------|--------|
| `UPLOAD_DIR` | 文件存储目录 | `uploads` |
| `MAX_FILE_SIZE` | 最大上传文件大小（字节） | `104857600` (100MB) |
| `PREVIEW_MAX_SIZE` | 预览最大文件大小（字节） | `5242880` (5MB) |

### 前端代理配置

编辑 `frontend/vite.config.ts` 中的 `target` 可修改后端地址。

## 支持的文件类型

| 类别 | 扩展名 | 支持预览 |
|-----|--------|---------|
| 文本/代码 | .txt, .json, .csv, .md, .py, .js, .ts, .java, .cpp... | ✅ |
| PDF | .pdf | ✅ (嵌入查看器) |
| 图片 | .jpg, .png, .gif, .svg, .webp... | ✅ |
| Word | .docx | ✅ (文本提取) |
| PPT | .pptx | ✅ (文本提取) |
| 压缩包 | .zip, .rar, .7z | ❌ (仅下载) |
| 可执行文件 | .exe, .app, .dmg | ❌ (仅下载) |

## 常见问题

### 1. python-docx 或 python-pptx 安装失败

某些系统可能需要额外依赖：

**Ubuntu/Debian:**
```bash
sudo apt-get install python3-dev libxml2-dev libxslt1-dev
```

**macOS:**
```bash
brew install libxml2 libxslt
```

### 2. 中文文件名显示乱码

确保系统环境为 UTF-8：
```bash
export PYTHONIOENCODING=utf-8
```

### 3. PDF 预览空白

检查网络连接，确保能访问 CDN 的 PDF.js worker。生产环境建议本地化 worker 文件。

## 服务管理

### 后端服务

项目提供完整的服务管理脚本（`backend/service.sh`）：

```bash
cd backend

# 查看所有命令
./service.sh help

# 常用操作
./service.sh start      # 启动服务
./service.sh stop       # 停止服务（自动清理子进程）
./service.sh restart    # 重启服务
./service.sh status     # 查看运行状态
./service.sh logs       # 查看运行日志
./service.sh logs -f    # 实时跟踪日志
./service.sh errors     # 查看错误日志
./service.sh clean      # 清理旧日志备份
./service.sh info       # 显示服务信息
```

**脚本特性：**
- ✓ 自动检测虚拟环境
- ✓ PID 文件管理（`logs/app.pid`）
- ✓ 自动日志轮转和备份
- ✓ 健康检查验证服务就绪
- ✓ 停止时递归杀死所有子进程
- ✓ 彩色终端输出（状态清晰）
- ✓ 错误日志分离（`error.log`）

- 使用后端自动生成的 API 文档进行接口调试：http://localhost:8000/docs
- 前端开发时，Vite 的热重载会自动刷新浏览器
- 建议使用 VS Code 并安装相关插件（Python, ESLint, Prettier）

## 安全说明

- 所有路径操作限制在 `UPLOAD_DIR` 内，防止目录穿越攻击
- 限制文件上传大小
- 仅白名单文件类型允许预览
- **生产环境**请：
  - 修改 CORS 配置，限制允许的域名
  - 添加用户认证机制
  - 使用 HTTPS
  - 定期备份文件

## License

MIT
