#!/usr/bin/env bash
# 启动头脑风暴可视化辅助服务器并输出连接信息
# 用法: start-server.sh [--project-dir <路径>] [--host <绑定地址>] [--url-host <显示地址>] [--foreground] [--background]
#
# 在随机高端口启动服务器，输出包含 URL 的 JSON。
# 每个会话有独立目录，避免冲突。
#
# 选项:
#   --project-dir <路径>  将会话文件存储在 <路径>/.superpowers/brainstorm/ 下
#                         而非 /tmp。服务器停止后文件保留。
#   --host <绑定地址>     绑定的主机/接口（默认: 127.0.0.1）。
#                         远程/容器化环境中使用 0.0.0.0。
#   --url-host <地址>     返回的 URL JSON 中显示的主机名。
#   --foreground          在当前终端运行服务器（不后台化）。
#   --background          强制后台模式（覆盖 Codex 自动前台化）。

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 解析参数
PROJECT_DIR=""
FOREGROUND="false"
FORCE_BACKGROUND="false"
BIND_HOST="127.0.0.1"
URL_HOST=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --project-dir)
      PROJECT_DIR="$2"
      shift 2
      ;;
    --host)
      BIND_HOST="$2"
      shift 2
      ;;
    --url-host)
      URL_HOST="$2"
      shift 2
      ;;
    --foreground|--no-daemon)
      FOREGROUND="true"
      shift
      ;;
    --background|--daemon)
      FORCE_BACKGROUND="true"
      shift
      ;;
    *)
      echo "{\"error\": \"未知参数: $1\"}"
      exit 1
      ;;
  esac
done

if [[ -z "$URL_HOST" ]]; then
  if [[ "$BIND_HOST" == "127.0.0.1" || "$BIND_HOST" == "localhost" ]]; then
    URL_HOST="localhost"
  else
    URL_HOST="$BIND_HOST"
  fi
fi

# 某些环境会回收后台进程。检测到时自动切换为前台模式。
if [[ -n "${CODEX_CI:-}" && "$FOREGROUND" != "true" && "$FORCE_BACKGROUND" != "true" ]]; then
  FOREGROUND="true"
fi

# Windows/Git Bash 会回收 nohup 后台进程。检测到时自动切换为前台模式。
if [[ "$FOREGROUND" != "true" && "$FORCE_BACKGROUND" != "true" ]]; then
  case "${OSTYPE:-}" in
    msys*|cygwin*|mingw*) FOREGROUND="true" ;;
  esac
  if [[ -n "${MSYSTEM:-}" ]]; then
    FOREGROUND="true"
  fi
fi

# 生成唯一会话目录
SESSION_ID="$$-$(date +%s)"

if [[ -n "$PROJECT_DIR" ]]; then
  SESSION_DIR="${PROJECT_DIR}/.superpowers/brainstorm/${SESSION_ID}"
else
  SESSION_DIR="/tmp/brainstorm-${SESSION_ID}"
fi

STATE_DIR="${SESSION_DIR}/state"
PID_FILE="${STATE_DIR}/server.pid"
LOG_FILE="${STATE_DIR}/server.log"

# 创建会话目录，content 和 state 为同级目录
mkdir -p "${SESSION_DIR}/content" "$STATE_DIR"

# 终止已有服务器
if [[ -f "$PID_FILE" ]]; then
  old_pid=$(cat "$PID_FILE")
  kill "$old_pid" 2>/dev/null
  rm -f "$PID_FILE"
fi

cd "$SCRIPT_DIR"

# 解析宿主 PID（本脚本的祖父进程）。
# $PPID 是宿主为运行本脚本而创建的临时 shell — 脚本退出后它就消失了。
# 宿主本身是 $PPID 的父进程。
OWNER_PID="$(ps -o ppid= -p "$PPID" 2>/dev/null | tr -d ' ')"
if [[ -z "$OWNER_PID" || "$OWNER_PID" == "1" ]]; then
  OWNER_PID="$PPID"
fi

# 前台模式，用于会回收后台进程的环境。
if [[ "$FOREGROUND" == "true" ]]; then
  echo "$$" > "$PID_FILE"
  env BRAINSTORM_DIR="$SESSION_DIR" BRAINSTORM_HOST="$BIND_HOST" BRAINSTORM_URL_HOST="$URL_HOST" BRAINSTORM_OWNER_PID="$OWNER_PID" node server.cjs
  exit $?
fi

# 启动服务器，输出记录到日志文件
# 使用 nohup 使其在 shell 退出后存活；disown 从作业表中移除
nohup env BRAINSTORM_DIR="$SESSION_DIR" BRAINSTORM_HOST="$BIND_HOST" BRAINSTORM_URL_HOST="$URL_HOST" BRAINSTORM_OWNER_PID="$OWNER_PID" node server.cjs > "$LOG_FILE" 2>&1 &
SERVER_PID=$!
disown "$SERVER_PID" 2>/dev/null
echo "$SERVER_PID" > "$PID_FILE"

# 等待 server-started 消息（检查日志文件）
for i in {1..50}; do
  if grep -q "server-started" "$LOG_FILE" 2>/dev/null; then
    # 短暂等待后验证服务器是否仍然存活（检测进程回收器）
    alive="true"
    for _ in {1..20}; do
      if ! kill -0 "$SERVER_PID" 2>/dev/null; then
        alive="false"
        break
      fi
      sleep 0.1
    done
    if [[ "$alive" != "true" ]]; then
      echo "{\"error\": \"服务器已启动但被终止。请在持久终端中重试: $SCRIPT_DIR/start-server.sh${PROJECT_DIR:+ --project-dir $PROJECT_DIR} --host $BIND_HOST --url-host $URL_HOST --foreground\"}"
      exit 1
    fi
    grep "server-started" "$LOG_FILE" | head -1
    exit 0
  fi
  sleep 0.1
done

# 超时 - 服务器未能启动
echo '{"error": "服务器在 5 秒内未能启动"}'
exit 1