#!/bin/bash
# File Manager Frontend 服务管理脚本 (Linux/Mac)

# 配置
INST_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="${INST_DIR}/logs"
LOG_FILE="${LOG_DIR}/dev.log"
ERROR_LOG_FILE="${LOG_DIR}/dev-error.log"
PID_FILE="${LOG_DIR}/dev.pid"
SERVICE_NAME="File Manager Frontend"
HOST="0.0.0.0"
PORT="5173"

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
# 策略：优先通过端口查找监听进程，验证其为 vite/node
find_service_pid() {
    local pid=""

    # 方法1: 从 PID 文件读取并验证
    if [ -f "${PID_FILE}" ]; then
        local saved_pid
        saved_pid=$(cat "${PID_FILE}" 2>/dev/null | tr -d ' \n')
        if [ -n "$saved_pid" ] && kill -0 "$saved_pid" 2>/dev/null; then
            # 验证进程命令和端口
            local cmd
            cmd=$(ps -p "$saved_pid" -o args= 2>/dev/null | xargs)
            if echo "$cmd" | grep -qE 'vite|node.*vite'; then
                # 确认在监听我们的端口
                if command -v ss &> /dev/null; then
                    if ss -tlnp 2>/dev/null | grep -q ":$PORT.*pid=$saved_pid"; then
                        echo "$saved_pid"
                        return 0
                    fi
                elif command -v netstat &> /dev/null; then
                    if netstat -tlnp 2>/dev/null | grep -q ":$PORT.*${saved_pid}"; then
                        echo "$saved_pid"
                        return 0
                    fi
                else
                    # 无法检查端口，相信 PID 文件
                    echo "$saved_pid"
                    return 0
                fi
            fi
        fi
    fi

    # 方法2: 通过端口查找监听进程（最可靠）
    if command -v ss &> /dev/null; then
        local port_pids
        port_pids=$(ss -tlnp 2>/dev/null | grep ":${PORT}" | grep -oP 'pid=\K[0-9]+' | sort -n | uniq)
        for candidate in $port_pids; do
            local cmd
            cmd=$(ps -p "$candidate" -o args= 2>/dev/null | xargs)
            if echo "$cmd" | grep -qE 'vite|node.*vite'; then
                echo "$candidate"
                return 0
            fi
        done
    elif command -v netstat &> /dev/null; then
        local port_pids
        port_pids=$(netstat -tlnp 2>/dev/null | grep ":${PORT}" | awk '{print $NF}' | sort -n | uniq)
        for candidate in $port_pids; do
            local cmd
            cmd=$(ps -p "$candidate" -o args= 2>/dev/null | xargs)
            if echo "$cmd" | grep -qE 'vite|node.*vite'; then
                echo "$candidate"
                return 0
            fi
        done
    fi

    # 方法3: 使用 pgrep
    local pids
    pids=$(pgrep -f "vite.*--port[[:space:]]*${PORT}" 2>/dev/null)
    if [ -z "$pids" ]; then
        pids=$(pgrep -f "vite" 2>/dev/null)
    fi
    if [ -n "$pids" ]; then
        pid=$(echo "$pids" | awk '!seen[$0]++ {print; exit}')
        [ -n "$pid" ] && echo "$pid" && return 0
    fi

    # 方法4: ps + grep
    pids=$(ps aux 2>/dev/null | grep '[v]ite' | awk '{print $2}')
    if [ -n "$pids" ]; then
        pid=$(echo "$pids" | head -1)
        [ -n "$pid" ] && echo "$pid" && return 0
    fi

    return 1
}

# 获取所有相关进程（包括子进程）
get_all_related_pids() {
    local main_pid
    main_pid=$(find_service_pid) || return 1

    # 尝试按进程组获取（最全面）
    local pgid
    pgid=$(ps -o pgid= -p "$main_pid" 2>/dev/null | tr -d ' ')

    if [ -n "$pgid" ] && [ "$pgid" -eq "$pgid" ] 2>/dev/null && [ "$pgid" != "0" ]; then
        local pgid_pids
        pgid_pids=$(ps -o pid= -g "$pgid" 2>/dev/null | tr '\n' ' ' | sed 's/ *$//')
        if [ -n "$pgid_pids" ]; then
            echo "$pgid_pids"
            return 0
        fi
    fi

    # 回退：父子进程遍历
    local all_pids="$main_pid"
    local child_pids
    child_pids=$(pgrep -P "$main_pid" 2>/dev/null)

    if [ -n "$child_pids" ]; then
        all_pids="$all_pids $child_pids"
        for child in $child_pids; do
            local grandkids
            grandkids=$(pgrep -P "$child" 2>/dev/null)
            [ -n "$grandkids" ] && all_pids="$all_pids $grandkids"
        done
    fi

    # 去重输出
    echo "$all_pids" | tr ' ' '\n' | sort -n | uniq
}

# 检查服务是否运行
is_running() {
    find_service_pid &> /dev/null
}

# 检查依赖
check_dependencies() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js 未安装，请先安装 Node.js 18+"
        return 1
    fi
    if ! command -v npm &> /dev/null; then
        print_error "npm 未安装"
        return 1
    fi
    if [ ! -d "${INST_DIR}/node_modules" ]; then
        print_warn "node_modules 目录不存在，运行: npm install"
        return 1
    fi
    return 0
}

# 启动服务
start_service() {
    print_info "正在启动 ${SERVICE_NAME}..."

    if is_running; then
        local pid
        pid=$(find_service_pid)
        print_warn "服务已在运行，PID: ${pid}"
        print_info "访问地址: http://localhost:${PORT}"
        return 1
    fi

    # 备份旧日志
    if [ -f "${LOG_FILE}" ]; then
        local backup_name="${LOG_FILE}.$(date +%Y%m%d_%H%M%S).bak"
        mv "${LOG_FILE}" "$backup_name"
        print_info "备份旧日志: $(basename "$backup_name")"
    fi
    > "${ERROR_LOG_FILE}"

    print_info "启动时间: $(date '+%Y-%m-%d %H:%M:%S')"

    if ! check_dependencies; then
        print_error "依赖检查失败，无法启动服务"
        return 1
    fi

    print_info "使用 Node.js: $(node --version)"
    print_info "使用 npm: $(npm --version)"
    print_info "启动命令: npm run dev"
    print_info "监听地址: http://${HOST}:${PORT}"

    nohup npm run dev > "${LOG_FILE}" 2> "${ERROR_LOG_FILE}" &
    local pid=$!
    echo "$pid" > "${PID_FILE}"

    print_info "进程ID: ${pid}"
    print_info "等待服务就绪..."

    local attempts=0
    local max_attempts=30
    while [ $attempts -lt $max_attempts ]; do
        if curl -s "http://localhost:${PORT}" > /dev/null 2>&1; then
            break
        fi
        sleep 1
        attempts=$((attempts + 1))
        [ $((attempts % 5)) -eq 0 ] && print_info "等待中... (${attempts}s)"
    done

    if is_running; then
        local actual_pid
        actual_pid=$(find_service_pid)
        print_success "服务启动成功！"
        print_info "  PID: ${actual_pid}"
        print_info "  访问地址: http://localhost:${PORT}"
        print_info "  运行日志: ${LOG_FILE}"
        print_info "  错误日志: ${ERROR_LOG_FILE}"
        return 0
    else
        print_error "服务启动失败！"
        print_error "请查看错误日志:"
        [ -f "${ERROR_LOG_FILE}" ] && tail -n 20 "${ERROR_LOG_FILE}" 2>/dev/null | sed 's/^/    /'
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

    local wait_seconds=5
    for i in $(seq 1 $wait_seconds); do
        if ! is_running; then
            break
        fi
        sleep 1
    done

    # 步骤2: 检查残留进程
    if is_running; then
        print_warn "进程未响应 SIGTERM，等待子进程结束..."
        sleep 2
    fi

    # 步骤3: 强制关闭所有相关进程
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
        [ -f "${PID_FILE}" ] && rm -f "${PID_FILE}"
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

        if command -v ps &> /dev/null; then
            local start_time cpu_usage mem_usage cmd
            start_time=$(ps -p "$pid" -o lstart= 2>/dev/null | xargs)
            cpu_usage=$(ps -p "$pid" -o %cpu= 2>/dev/null | xargs)
            mem_usage=$(ps -p "$pid" -o %mem= 2>/dev/null | xargs)
            cmd=$(ps -p "$pid" -o cmd= 2>/dev/null | xargs)

            print_info "  启动时间: ${start_time}"
            print_info "  CPU使用率: ${cpu_usage}%"
            print_info "  内存使用: ${mem_usage}%"
            print_info "  运行命令: ${cmd}"
        fi

        if command -v ss &> /dev/null; then
            local port_listening
            port_listening=$(ss -tlnp 2>/dev/null | grep ":${PORT}" || true)
            [ -n "$port_listening" ] && {
                echo ""
                print_info "  监听端口:"
                echo "$port_listening" | sed 's/^/    /'
            }
        elif command -v netstat &> /dev/null; then
            local port_listening
            port_listening=$(netstat -tlnp 2>/dev/null | grep ":${PORT}" || true)
            [ -n "$port_listening" ] && {
                echo ""
                print_info "  监听端口:"
                echo "$port_listening" | sed 's/^/    /'
            }
        fi

        echo ""
        if curl -s "http://localhost:${PORT}" > /dev/null 2>&1; then
            print_success "  健康检查: 通过 ✓"
        else
            print_error "  健康检查: 失败 ✗"
        fi

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
    print_success "=== File Manager Frontend 服务信息 ==="
    echo ""
    print_info "安装目录: ${INST_DIR}"
    print_info "日志目录: ${LOG_DIR}"
    print_info "配置文件: ${INST_DIR}/.env (如存在)"
    echo ""
    print_info "服务地址: http://localhost:${PORT}"
    print_info "后端 API: http://localhost:8000"
    echo ""
    print_info "日志文件:"
    echo "  运行日志: ${LOG_FILE}"
    echo "  错误日志: ${ERROR_LOG_FILE}"
    echo "  PID 文件: ${PID_FILE}"
    echo ""
    print_info "依赖检查:"
    if command -v node &> /dev/null; then
        print_success "  Node.js: $(node --version)"
    else
        print_error "  Node.js: 未安装"
    fi
    if command -v npm &> /dev/null; then
        print_success "  npm: $(npm --version)"
    else
        print_error "  npm: 未安装"
    fi
    if [ -d "${INST_DIR}/node_modules" ]; then
        print_success "  node_modules: 存在"
    else
        print_warn "  node_modules: 不存在 (请运行 npm install)"
    fi
    echo ""
}

# 显示帮助信息
show_help() {
    cat << EOF
${GREEN}File Manager Frontend 服务管理脚本${NC}

用法:
  ./service.sh [命令] [选项]

命令:
  start             启动开发服务器
  stop              停止开发服务器
  restart           重启开发服务器
  status            查看服务状态
  info              显示服务信息
  logs [-f|--follow] 查看日志（-f 实时跟踪）
  errors            查看错误日志
  clean             清理旧日志备份
  help              显示帮助信息

示例:
  ./service.sh start         # 启动开发服务器
  ./service.sh stop          # 停止开发服务器
  ./service.sh restart       # 重启开发服务器
  ./service.sh status        # 查看状态
  ./service.sh logs          # 查看日志
  ./service.sh logs -f       # 实时跟踪日志
  ./service.sh errors        # 查看错误日志
  ./service.sh clean         # 清理旧日志
  ./service.sh info          # 显示服务信息

环境变量配置 (可选):
  可通过 .env 文件或直接 export:
  - VITE_API_URL: 后端 API 地址 (默认: /api，通过 Vite 代理)
  - HOST: 监听地址 (默认: 0.0.0.0)
  - PORT: 监听端口 (默认: 5173)

注意事项:
  1. 确保已安装 Node.js 18+
  2. 首次使用请运行: npm install
  3. 开发模式支持热重载
  4. 日志目录: frontend/logs/
  5. 通过 Vite 代理访问后端 (无需配置 CORS)

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
