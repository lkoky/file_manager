#!/bin/bash
# File Manager 后端服务管理脚本 (Linux/Mac)

# 配置
INST_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="${INST_DIR}/logs"
LOG_FILE="${LOG_DIR}/app.log"
ERROR_LOG_FILE="${LOG_DIR}/error.log"
PID_FILE="${LOG_DIR}/app.pid"
APP_MODULE="app.main:app"
SERVICE_NAME="File Manager"
HOST="0.0.0.0"
PORT="8000"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 创建日志目录
mkdir -p "${LOG_DIR}"

# 打印带颜色的消息
print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[OK]${NC} $1"; }
print_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# 查找服务主进程 PID
# 策略：查找实际运行 uvicorn 的 python 进程，排除 shell 包装进程
find_service_pid() {
    local pid=""

    # 方法1: 从 PID 文件读取并验证
    if [ -f "${PID_FILE}" ]; then
        local saved_pid
        saved_pid=$(cat "${PID_FILE}" 2>/dev/null | tr -d ' \n')
        if [ -n "$saved_pid" ] && kill -0 "$saved_pid" 2>/dev/null; then
            # 验证该进程确实是 uvicorn
            local cmd
            cmd=$(ps -p "$saved_pid" -o args= 2>/dev/null | xargs)
            if echo "$cmd" | grep -qE 'python.*-m uvicorn|uvicorn'; then
                echo "$saved_pid"
                return 0
            fi
        fi
    fi

    # 方法2: 使用 pgrep 查找 uvicorn 进程
    # 查找运行 app.main:app 的 uvicorn 进程
    local pids
    pids=$(pgrep -f "python.*-m uvicorn.*${APP_MODULE}" 2>/dev/null)

    if [ -z "$pids" ]; then
        # 备用模式：uvicorn 命令形式
        pids=$(pgrep -f "uvicorn[[:space:]]+${APP_MODULE}" 2>/dev/null)
    fi

    if [ -n "$pids" ]; then
        # 去重，取第一个
        pid=$(echo "$pids" | tr ' ' '\n' | sort -n | uniq | head -1)
        echo "$pid"
        return 0
    fi

    # 方法3: 通过 ps + grep（最可靠）
    pids=$(ps aux | grep '[u]vicorn' | grep "${APP_MODULE}" | awk '{print $2}')
    if [ -n "$pids" ]; then
        pid=$(echo "$pids" | head -1)
        echo "$pid"
        return 0
    fi

    return 1
}

# 获取所有相关进程（包括子进程）
get_all_related_pids() {
    local main_pid
    main_pid=$(find_service_pid) || return 1

    local all_pids="$main_pid"

    # 查找主进程的所有子进程（递归）
    local child_pids
    child_pids=$(pgrep -P "$main_pid" 2>/dev/null)
    if [ -n "$child_pids" ]; then
        all_pids="$all_pids $child_pids"
        # 递归查找孙子进程
        for child in $child_pids; do
            local grandkids
            grandkids=$(pgrep -P "$child" 2>/dev/null)
            if [ -n "$grandkids" ]; then
                all_pids="$all_pids $grandkids"
            fi
        done
    fi

    # 去重输出
    echo "$all_pids" | tr ' ' '\n' | sort -n | uniq
}

# 检查服务是否运行
is_running() {
    local pid
    pid=$(find_service_pid) && return 0 || return 1
}

# 检查服务状态
check_status() {
    if is_running; then
        echo "running"
        return 0
    else
        echo "stopped"
        return 1
    fi
}

# 启动服务
start_service() {
    print_info "正在启动 ${SERVICE_NAME}..."

    # 检查是否已在运行
    if is_running; then
        local pid
        pid=$(find_service_pid)
        print_warn "服务已在运行，PID: ${pid}"
        return 1
    fi

    # 备份旧日志
    if [ -f "${LOG_FILE}" ]; then
        local backup_name="${LOG_FILE}.$(date +%Y%m%d_%H%M%S).bak"
        mv "${LOG_FILE}" "$backup_name"
        print_info "备份旧日志: $(basename "$backup_name")"
    fi

    # 清理旧错误日志
    > "${ERROR_LOG_FILE}"

    print_info "启动时间: $(date '+%Y-%m-%d %H:%M:%S')"

    # 检查虚拟环境
    local python_cmd="${PYTHON_CMD}"
    if [ -f "${INST_DIR}/.venv/bin/python" ]; then
        python_cmd="${INST_DIR}/.venv/bin/python"
        print_info "使用虚拟环境: ${python_cmd}"
    elif [ -f "${INST_DIR}/.venv/bin/python3" ]; then
        python_cmd="${INST_DIR}/.venv/bin/python3"
        print_info "使用虚拟环境: ${python_cmd}"
    fi

    # 验证 Python 可用性
    if ! command -v "$python_cmd" &> /dev/null; then
        print_error "Python 未找到: ${python_cmd}"
        print_info "请运行: python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
        return 1
    fi

    # 设置环境
    export PYTHONPATH="${INST_DIR}"
    # 注意：.env 文件由 pydantic-settings 自动加载，无需手动 export

    # 启动服务
    print_info "启动命令: ${python_cmd} -m uvicorn ${APP_MODULE} --host ${HOST} --port ${PORT}"

    # 使用 nohup 后台运行，正确重定向输出
    nohup "$python_cmd" -m uvicorn ${APP_MODULE} \
        --host "${HOST}" \
        --port "${PORT}" \
        > "${LOG_FILE}" 2> "${ERROR_LOG_FILE}" &
    local pid=$!

    # 保存 PID
    echo "$pid" > "${PID_FILE}"

    print_info "进程ID: ${pid}"
    print_info "等待服务就绪..."

    # 等待健康检查通过
    local attempts=0
    local max_attempts=30
    while [ $attempts -lt $max_attempts ]; do
        if curl -s "http://localhost:${PORT}/health" > /dev/null 2>&1; then
            break
        fi
        sleep 1
        attempts=$((attempts + 1))

        # 每5秒打印一次进度
        if [ $((attempts % 5)) -eq 0 ]; then
            print_info "等待中... (${attempts}s)"
        fi
    done

    # 最终验证
    if is_running; then
        local actual_pid
        actual_pid=$(find_service_pid)
        print_success "服务启动成功！"
        print_info "  PID: ${actual_pid}"
        print_info "  访问地址: http://localhost:${PORT}"
        print_info "  API 文档: http://localhost:${PORT}/docs"
        print_info "  健康检查: http://localhost:${PORT}/health"
        print_info "  运行日志: ${LOG_FILE}"
        print_info "  错误日志: ${ERROR_LOG_FILE}"
        return 0
    else
        print_error "服务启动失败！"
        print_error "请查看错误日志:"
        if [ -f "${ERROR_LOG_FILE}" ]; then
            tail -n 20 "${ERROR_LOG_FILE}" 2>/dev/null | sed 's/^/    /'
        fi
        return 1
    fi
}

# 停止服务
stop_service() {
    print_info "正在停止 ${SERVICE_NAME}..."

    local pid
    pid=$(find_service_pid)

    if [ -z "$pid" ]; then
        print_warn "服务未运行"
        return 0
    fi

    print_info "停止时间: $(date '+%Y-%m-%d %H:%M:%S')"
    print_info "正在停止进程 PID: ${pid}"

    # 获取所有相关进程
    local all_pids
    all_pids=$(get_all_related_pids)

    # 步骤1: 尝试优雅关闭 (SIGTERM)
    print_info "发送 SIGTERM 信号..."
    kill "$pid" 2>/dev/null

    # 等待进程结束
    local wait_seconds=5
    for i in $(seq 1 $wait_seconds); do
        if ! is_running; then
            break
        fi
        sleep 1
    done

    # 步骤2: 检查是否还有残留进程
    if is_running; then
        print_warn "进程未响应 SIGTERM，等待子进程结束..."
        sleep 2
    fi

    # 再次检查并杀死所有剩余相关进程
    all_pids=$(get_all_related_pids 2>/dev/null)
    if [ -n "$all_pids" ]; then
        print_warn "仍有进程在运行，强制关闭 (SIGKILL)..."
        for p in $all_pids; do
            if kill -0 "$p" 2>/dev/null; then
                kill -9 "$p" 2>/dev/null
                print_info "  已杀死 PID: ${p}"
            fi
        done
        sleep 1
    fi

    # 最终验证
    if is_running; then
        local still_pid
        still_pid=$(find_service_pid)
        print_error "服务停止失败，PID: ${still_pid} 仍在运行"
        return 1
    else
        print_success "服务停止成功"

        # 清理 PID 文件
        if [ -f "${PID_FILE}" ]; then
            rm -f "${PID_FILE}"
        fi
        return 0
    fi
}

# 重启服务
restart_service() {
    print_info "正在重启 ${SERVICE_NAME}..."
    stop_service
    sleep 2
    start_service
}

# 显示服务状态
show_status() {
    echo ""
    if is_running; then
        local pid
        pid=$(find_service_pid)

        print_success "服务状态: 运行中"
        print_info "  进程ID: ${pid}"

        # 显示进程信息
        if command -v ps &> /dev/null; then
            local start_time
            start_time=$(ps -p "$pid" -o lstart= 2>/dev/null | xargs)
            local cpu_usage
            cpu_usage=$(ps -p "$pid" -o %cpu= 2>/dev/null | xargs)
            local mem_usage
            mem_usage=$(ps -p "$pid" -o %mem= 2>/dev/null | xargs)
            local cmd
            cmd=$(ps -p "$pid" -o cmd= 2>/dev/null | xargs)

            print_info "  启动时间: ${start_time}"
            print_info "  CPU使用率: ${cpu_usage}%"
            print_info "  内存使用: ${mem_usage}%"
            print_info "  运行命令: ${cmd}"
        fi

        # 显示监听端口
        if command -v ss &> /dev/null; then
            local port_listening
            port_listening=$(ss -tlnp 2>/dev/null | grep ":${PORT}" || true)
            if [ -n "$port_listening" ]; then
                echo ""
                print_info "  监听端口:"
                echo "$port_listening" | sed 's/^/    /'
            fi
        elif command -v netstat &> /dev/null; then
            local port_listening
            port_listening=$(netstat -tlnp 2>/dev/null | grep ":${PORT}" || true)
            if [ -n "$port_listening" ]; then
                echo ""
                print_info "  监听端口:"
                echo "$port_listening" | sed 's/^/    /'
            fi
        fi

        # 健康检查
        echo ""
        if curl -s "http://localhost:${PORT}/health" > /dev/null 2>&1; then
            print_success "  健康检查: 通过 ✓"
        else
            print_error "  健康检查: 失败 ✗"
        fi

        # 显示日志最后几行
        if [ -f "${LOG_FILE}" ]; then
            echo ""
            print_info "最近日志 (最后10行):"
            tail -n 10 "${LOG_FILE}" 2>/dev/null | sed 's/^/    /'
        fi
        return 0
    else
        print_error "服务状态: 未运行"
        return 1
    fi
}

# 查看日志
show_logs() {
    local follow="$1"
    if [ ! -f "${LOG_FILE}" ]; then
        print_error "日志文件不存在: ${LOG_FILE}"
        return 1
    fi

    if [ "$follow" = "-f" ] || [ "$follow" = "--follow" ]; then
        print_info "实时监控日志 (Ctrl+C 退出)..."
        tail -f "${LOG_FILE}"
    else
        print_info "显示最近100行日志:"
        echo ""
        tail -n 100 "${LOG_FILE}" 2>/dev/null | sed 's/^/    /'
    fi
}

# 查看错误日志
show_error_logs() {
    if [ ! -f "${ERROR_LOG_FILE}" ]; then
        print_error "错误日志不存在: ${ERROR_LOG_FILE}"
        return 1
    fi

    print_info "显示错误日志 (最后50行):"
    echo ""
    tail -n 50 "${ERROR_LOG_FILE}" 2>/dev/null | sed 's/^/    /'
}

# 清理旧日志
clean_logs() {
    print_info "清理旧日志备份..."
    local count=0
    for backup in "${LOG_FILE}".*.bak; do
        [ -e "$backup" ] || continue
        rm -f "$backup"
        count=$((count + 1))
    done
    if [ $count -gt 0 ]; then
        print_success "已清理 ${count} 个备份日志文件"
    else
        print_info "没有找到备份日志文件"
    fi
}

# 显示服务信息
show_info() {
    echo ""
    print_success "=== File Manager 服务信息 ==="
    echo ""
    print_info "安装目录: ${INST_DIR}"
    print_info "日志目录: ${LOG_DIR}"
    print_info "配置文件: ${INST_DIR}/.env"
    echo ""
    print_info "服务地址: http://localhost:${PORT}"
    print_info "API 文档: http://localhost:${PORT}/docs"
    print_info "健康检查: http://localhost:${PORT}/health"
    echo ""
    print_info "日志文件:"
    echo "  运行日志: ${LOG_FILE}"
    echo "  错误日志: ${ERROR_LOG_FILE}"
    echo "  PID 文件: ${PID_FILE}"
    echo ""
}

# 显示帮助信息
show_help() {
    cat << EOF
${GREEN}File Manager 服务管理脚本${NC}

用法:
  ./service.sh [命令] [选项]

命令:
  start             启动服务
  stop              停止服务
  restart           重启服务
  status            查看服务状态
  info              显示服务信息
  logs [-f|--follow] 查看日志（-f 实时跟踪）
  errors            查看错误日志
  clean             清理旧日志备份
  help              显示帮助信息

示例:
  ./service.sh start         # 启动服务
  ./service.sh stop          # 停止服务
  ./service.sh restart       # 重启服务
  ./service.sh status        # 查看状态
  ./service.sh logs          # 查看日志
  ./service.sh logs -f       # 实时跟踪日志
  ./service.sh errors        # 查看错误日志
  ./service.sh clean         # 清理旧日志
  ./service.sh info          # 显示服务信息

环境变量配置 (可选):
  通过 backend/.env 文件配置:
  - UPLOAD_DIR: 文件存储目录
  - MAX_FILE_SIZE: 最大上传大小（字节）
  - PREVIEW_MAX_SIZE: 预览最大大小（字节）
  - ALLOWED_ORIGINS: CORS 允许的源列表

注意事项:
  1. 确保已安装 Python 3.9+
  2. 首次使用请创建虚拟环境: python3 -m venv .venv
  3. 安装依赖: pip install -r requirements.txt
  4. 生产环境建议使用 systemd 管理服务
  5. 日志目录: backend/logs/

EOF
}

# 主程序
case "${1:-}" in
    start)
        start_service
        exit $?
        ;;
    stop)
        stop_service
        exit $?
        ;;
    restart)
        restart_service
        exit $?
        ;;
    status)
        show_status
        exit $?
        ;;
    info)
        show_info
        exit $?
        ;;
    logs)
        show_logs "$2"
        exit $?
        ;;
    errors|error)
        show_error_logs
        exit $?
        ;;
    clean)
        clean_logs
        exit $?
        ;;
    help|-h|--help)
        show_help
        exit 0
        ;;
    "")
        print_error "错误: 缺少命令参数"
        echo ""
        show_help
        exit 1
        ;;
    *)
        print_error "错误: 未知命令 '${1}'"
        echo ""
        show_help
        exit 1
        ;;
esac

exit 0
