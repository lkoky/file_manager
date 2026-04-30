# File Manager Frontend

React + TypeScript + Vite 前端应用，提供文件上传、下载、预览和浏览功能。

## 功能特性

- 文件浏览（多级目录导航）
- 文件预览（文本、图片、PDF、Word、PPT）
- 文件下载（支持中文文件名）
- 文件上传（可选择目标目录）

## 快速开始

### 环境要求

- Node.js 18+
- npm 或 yarn

### 安装依赖

```bash
cd frontend
npm install
```

### 开发模式

#### 方式一：使用服务管理脚本（推荐）

```bash
cd frontend

# 启动开发服务器
./service.sh start

# 查看状态
./service.sh status

# 查看日志
./service.sh logs

# 停止服务
./service.sh stop
```

#### 方式二：直接启动

```bash
npm run dev
```

应用将在 http://localhost:5173 启动，并自动代理 API 请求到后端（http://localhost:8000）。

### 生产构建

```bash
npm run build
npm run preview
```

## 项目结构

```
frontend/
├── src/
│   ├── components/     # React 组件
│   │   ├── Breadcrumb.tsx    # 面包屑导航
│   │   ├── FileItem.tsx      # 文件项组件
│   │   ├── FileList.tsx      # 文件列表组件
│   │   ├── PreviewModal.tsx  # 预览弹窗
│   │   └── UploadModal.tsx   # 上传弹窗
│   ├── services/       # API 服务
│   │   └── api.ts
│   ├── types/          # TypeScript 类型定义
│   │   └── index.ts
│   ├── App.tsx         # 主应用组件
│   ├── main.tsx        # 应用入口
│   └── index.css       # 全局样式
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 依赖说明

| 依赖 | 用途 |
|-----|------|
| react | UI 框架 |
| react-dom | React DOM 渲染 |
| axios | HTTP 请求 |
| react-pdf | PDF 文档预览 |
| pdfjs-dist | PDF.js 核心库 |

## API 接口

前端通过 `/api/*` 路径访问后端 API，开发模式下 Vite 代理会自动转发到 http://localhost:8000。

### 主要接口

- `GET /api/files?path=` - 获取文件列表
- `GET /api/preview?path=` - 预览文件
- `GET /api/download?path=` - 下载文件
- `POST /api/upload` - 上传文件

详细接口定义见后端文档。

## 组件说明

### App.tsx
主应用组件，管理全局状态：
- `currentPath`: 当前浏览路径
- `fileList`: 文件列表数据
- 预览/上传模态框开关状态

### Breadcrumb
面包屑导航组件，支持点击跳转到任意上级目录。

### FileList
文件列表组件，渲染目录和文件项。

### FileItem
单个文件/目录项组件，显示图标、名称、大小、时间和操作按钮。

### PreviewModal
预览弹窗组件，根据文件类型动态渲染预览内容：
- 文本：`<pre>` 标签
- 图片：`<img>` 标签
- PDF：`react-pdf` 组件

### UploadModal
上传弹窗组件，支持选择文件和目标目录。

## 类型工具函数

在 `src/types/index.ts` 中定义：

- `formatSize(bytes)` - 格式化文件大小
- `formatDate(isoString)` - 格式化日期
- `getFileIcon(extension)` - 获取文件类型图标（Emoji）
- `isPreviewable(extension)` - 判断文件是否可预览

## 样式

使用纯 CSS 编写，支持响应式布局。主要颜色：
- 主色：`#667eea`（渐变到 `#764ba2`）
- 预览按钮：蓝色系
- 下载按钮：绿色系

## 注意事项

### PDF 预览

- 使用 `react-pdf` 库
- PDF.js worker 从 CDN 加载（生产环境建议本地化）
- 大 PDF 文件可能需要调整 `pdfjs` 配置

### 中文文件名

- 所有 API 请求路径中的中文会自动 URL 编码
- 下载响应头正确设置 `Content-Disposition` 支持中文文件名

### 代理配置

开发模式下，`vite.config.ts` 配置了 API 代理：
- `/api/*` → `http://localhost:8000`

如需修改后端地址，更新 `vite.config.ts` 中的 `target` 配置。

## 故障排除

### PDF 加载失败

检查网络连接，确保能访问 CDN 的 PDF.js worker。生产环境可考虑本地化 worker。

### 上传失败

- 确认后端服务已启动
- 检查文件大小是否超过限制（默认 100MB）
- 查看浏览器控制台错误信息

### 预览空白

某些文件类型可能不支持预览，检查文件扩展名是否在白名单中。

## 生产部署

构建后，将 `dist/` 目录部署到任何静态文件服务器。确保：
1. 后端 API 地址正确（修改 `vite.config.ts` 中的代理配置或在前端代码中替换 API 基础 URL）
2. 后端已配置 CORS 允许前端域名访问

### 修改 API 地址

在 `src/services/api.ts` 中修改 `baseURL`：

```typescript
const api = axios.create({
  baseURL: process.env.NODE_PV || 'https://your-api-domain.com/api',
  // ...
});
```

并使用环境变量注入。

## 服务管理

### 使用 service.sh 脚本

项目提供完整的服务管理脚本 `frontend/service.sh`，支持启动、停止、重启和监控。

```bash
cd frontend

# 查看所有命令
./service.sh help

# 常用操作
./service.sh start      # 启动开发服务器
./service.sh stop       # 停止开发服务器
./service.sh restart    # 重启开发服务器
./service.sh status     # 查看运行状态
./service.sh logs       # 查看运行日志
./service.sh logs -f    # 实时跟踪日志
./service.sh errors     # 查看错误日志
./service.sh clean      # 清理旧日志备份
./service.sh info       # 显示服务信息
```

**脚本特性：**
- ✓ 自动检查 Node.js 和 npm 依赖
- ✓ PID 文件管理（`logs/dev.pid`）
- ✓ 自动日志轮转和备份
- ✓ 健康检查验证服务就绪（访问 http://localhost:5173）
- ✓ 停止时递归杀死所有子进程
- ✓ 彩色终端输出（状态清晰）
- ✓ 错误日志分离（`dev-error.log`）

### 日志文件

服务日志位于 `frontend/logs/` 目录：
- `dev.log` - 主运行日志
- `dev-error.log` - 错误日志
- `dev.pid` - 进程ID文件

### 环境变量

可通过环境变量或 `.env` 文件配置：

| 变量 | 说明 | 默认值 |
|-----|------|--------|
| `HOST` | 监听地址 | `0.0.0.0` |
| `PORT` | 监听端口 | `5173` |
| `VITE_API_URL` | 后端 API 地址 | `/api`（通过 Vite 代理） |

### 故障排除

#### 端口被占用

如果 5173 端口被占用，可以通过修改 `vite.config.ts` 中的 `port` 配置或设置 `PORT` 环境变量来更换端口：

```bash
PORT=3000 ./service.sh start
```

#### npm install 未运行

首次使用前需要安装依赖：

```bash
cd frontend
npm install
```

#### 服务启动失败

查看错误日志：
```bash
./service.sh errors
```
