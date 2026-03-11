#!/bin/bash
#
# 多类型视频定时调度
#
# 根据当前时间决定执行哪些任务：
#   - 每3小时：抓取A股热点 + 自动生成 hot_roundup
#   - 工作日 8:00：早评 (morning_brief)
#   - 工作日 15:30：收盘点评 (market_close)
#
# Crontab 配置：
#   */10 * * * * bash /Users/suconnect/Desktop/code/plasma/dialogue-animation/scripts/cron-multi.sh
#
# 也可以直接指定类型运行：
#   bash scripts/cron-multi.sh hot_roundup
#   bash scripts/cron-multi.sh morning_brief
#   bash scripts/cron-multi.sh market_close
#

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

# nvm setup
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

LOG_FILE="$PROJECT_DIR/logs/cron-$(date +%Y%m%d).log"
mkdir -p "$PROJECT_DIR/logs"

DB_CLI="node server/db-cli.mjs"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

run_pipeline() {
  local TYPE="$1"
  log "=== 开始 $TYPE 流水线 ==="

  CRON_ID=$($DB_CLI cron-start 2>/dev/null || echo "")

  bash scripts/auto-pipeline.sh --type "$TYPE" >> "$LOG_FILE" 2>&1
  EXIT_CODE=$?

  if [ -n "$CRON_ID" ]; then
    if [ $EXIT_CODE -eq 0 ]; then
      $DB_CLI cron-end --id "$CRON_ID" --status ok --title "$TYPE" 2>/dev/null || true
    else
      $DB_CLI cron-end --id "$CRON_ID" --status fail --error "exit code $EXIT_CODE" --title "$TYPE" 2>/dev/null || true
    fi
  fi

  log "=== $TYPE 流水线结束 (exit: $EXIT_CODE) ==="
}

# 如果指定了参数，直接运行对应类型
if [ -n "$1" ]; then
  case "$1" in
    hot_roundup|morning_brief|market_close|douyin_hot)
      run_pipeline "$1"
      ;;
    fetch)
      log "=== 抓取A股热点 ==="
      node scripts/fetch-and-save-topics.mjs >> "$LOG_FILE" 2>&1
      log "=== 抓取完成 ==="
      ;;
    *)
      echo "未知类型: $1"
      echo "可用: hot_roundup, morning_brief, market_close, douyin_hot, fetch"
      exit 1
      ;;
  esac
  exit 0
fi

# === 自动调度模式 ===
HOUR=$(date +%H)
MINUTE=$(date +%M)
DAY=$(date +%u)  # 1=Monday, 7=Sunday

# 每3小时整点（0, 3, 6, 9, 12, 15, 18, 21）前10分钟内：
# 抓取热点 + 生成热点整合
if [ $((10#$HOUR % 3)) -eq 0 ] && [ $((10#$MINUTE)) -lt 10 ]; then
  log "=== 定时：抓取A股热点 ==="
  node scripts/fetch-and-save-topics.mjs >> "$LOG_FILE" 2>&1

  # 只在交易日（周一到周五）且交易时段生成 hot_roundup
  if [ $((10#$DAY)) -le 5 ] && [ $((10#$HOUR)) -ge 9 ] && [ $((10#$HOUR)) -le 21 ]; then
    run_pipeline "hot_roundup"
  fi
fi

# 工作日 8:00-8:09：早评
if [ $((10#$DAY)) -le 5 ] && [ "$HOUR" = "08" ] && [ $((10#$MINUTE)) -lt 10 ]; then
  run_pipeline "morning_brief"
fi

# 工作日 15:30-15:39：收盘点评
if [ $((10#$DAY)) -le 5 ] && [ "$HOUR" = "15" ] && [ $((10#$MINUTE)) -ge 30 ] && [ $((10#$MINUTE)) -lt 40 ]; then
  run_pipeline "market_close"
fi
