#!/bin/bash
#
# cron wrapper — 定时抓取 A股热点选题存入数据库
# 不再执行完整流水线，视频生成改为 Dashboard 手动触发
#

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

export PATH="$HOME/.nvm/versions/node/v22.21.1/bin:$PATH"

cd /Users/suconnect/Desktop/code/plasma/dialogue-animation

DB_CLI="node server/db-cli.mjs"
LOG_FILE="logs/cron.log"
mkdir -p logs

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Record cron start
CRON_ID=$($DB_CLI cron-start 2>/dev/null || echo "")

log "开始抓取热点选题..."

# 抓取热点并存入DB
OUTPUT=$(node scripts/fetch-and-save-topics.mjs 2>>"$LOG_FILE")
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  ADDED=$(echo "$OUTPUT" | node -e "process.stdin.on('data',d=>{console.log(JSON.parse(d).added||0)})")
  log "抓取完成: 新增 ${ADDED} 个话题"

  if [ -n "$CRON_ID" ]; then
    $DB_CLI cron-end --id "$CRON_ID" --status ok --title "抓取选题: 新增${ADDED}个" 2>/dev/null || true
  fi
else
  log "[error] 抓取失败 exit code $EXIT_CODE"

  if [ -n "$CRON_ID" ]; then
    $DB_CLI cron-end --id "$CRON_ID" --status fail --error "抓取失败 exit code $EXIT_CODE" 2>/dev/null || true
  fi
fi
