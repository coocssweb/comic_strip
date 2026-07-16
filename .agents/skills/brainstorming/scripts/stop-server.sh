#!/usr/bin/env bash
# 停止头脑风暴服务器并清理
# 用法: stop-server.sh <会话目录>
#
# 终止服务器进程。仅删除 /tmp 下的会话目录（临时的）。
# 持久化目录（.superpowers/）保留，以便后续查看模型图。

SESSION_DIR="$1"

if [[ -z "$SESSION_DIR" ]]; then
  echo '{"error": "用法: stop-server.sh <会话目录>"}'
  exit 1
fi

STATE_DIR="${SESSION_DIR}/state"
PID_FILE="${STATE_DIR}/server.pid"

if [[ -f "$PID_FILE" ]]; then
  pid=$(cat "$PID_FILE")

  # 尝试优雅停止，如果仍然存活则强制终止
  kill "$pid" 2>/dev/null || true

  # 等待优雅关闭（最多约 2 秒）
  for i in {1..20}; do
    if ! kill -0 "$pid" 2>/dev/null; then
      break
    fi
    sleep 0.1
  done

  # 如果仍在运行，升级为 SIGKILL
  if kill -0 "$pid" 2>/dev/null; then
    kill -9 "$pid" 2>/dev/null || true

    # 等待 SIGKILL 生效
    sleep 0.1
  fi

  if kill -0 "$pid" 2>/dev/null; then
    echo '{"status": "failed", "error": "进程仍在运行"}'
    exit 1
  fi

  rm -f "$PID_FILE" "${STATE_DIR}/server.log"

  # 仅删除临时的 /tmp 目录
  if [[ "$SESSION_DIR" == /tmp/* ]]; then
    rm -rf "$SESSION_DIR"
  fi

  echo '{"status": "stopped"}'
else
  echo '{"status": "not_running"}'
fi