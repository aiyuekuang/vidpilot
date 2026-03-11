#!/bin/bash
#
# A股热点 → 对话视频流水线（多类型支持）
#
# 流程：
#   1. 选题/数据收集（按类型）
#   2. Claude 写搞笑对话（按类型加载 prompt）
#   3. 生成背景素材
#   4. ChatTTS 生成语音
#   5. Remotion 渲染视频
#   6. 合并音视频
#   7. (跳过 — 发布改为 Dashboard 手动)
#   8. 归档
#
# 支持的视频类型：
#   hot_roundup   — 热点消息整合（多条热点串烧）
#   douyin_hot    — 抖音热点（单条搞笑对话，默认）
#   market_close  — 收盘点评（大盘数据分析）
#   morning_brief — 早评（隔夜消息+美欧市场）
#
# 用法：
#   bash scripts/auto-pipeline.sh --type douyin_hot --topic-id 42 --topic-title "..."
#   bash scripts/auto-pipeline.sh --type hot_roundup
#   bash scripts/auto-pipeline.sh --type market_close
#   bash scripts/auto-pipeline.sh --type morning_brief
#   bash scripts/auto-pipeline.sh --dry --type hot_roundup
#

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

LOG_FILE="$PROJECT_DIR/logs/pipeline-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "$PROJECT_DIR/logs"

DB_CLI="node server/db-cli.mjs"

log() {
  echo "[$(date '+%H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# db-log helper: db_log <video_id> <step> <msg> [level]
db_log() {
  $DB_CLI log --video-id "$1" --step "$2" --msg "$3" --level "${4:-info}" 2>/dev/null || true
}

# === Parse arguments ===
DRY_RUN=false
TOPIC_ID=""
TOPIC_TITLE=""
VIDEO_TYPE="douyin_hot"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry) DRY_RUN=true; shift ;;
    --topic-id) TOPIC_ID="$2"; shift 2 ;;
    --topic-title) TOPIC_TITLE="$2"; shift 2 ;;
    --type) VIDEO_TYPE="$2"; shift 2 ;;
    *) shift ;;
  esac
done

log "=== 流水线启动 === 类型: $VIDEO_TYPE"

# === Step 1: 选题/数据收集（按类型分支）===
PROMPT_DATA=""  # 用于 market_close / morning_brief 的数据注入

case "$VIDEO_TYPE" in
  hot_roundup)
    log "Step 1: [热点整合] 读取最近3小时未用话题..."
    # 从 DB 读取最近3小时内、今天尚未生成过视频的候选话题
    TOPICS_JSON=$(node -e "
      const { getDb } = require('./server/db.mjs');
      const db = getDb();
      const since = new Date(Date.now() - 3*3600*1000).toISOString().replace('T',' ').slice(0,19);
      // 查询：最近3小时的候选话题（status='candidate' 即未被使用或跳过）
      const rows = db.prepare(\`
        SELECT id, title, score FROM topics
        WHERE fetched_at >= ?
          AND status = 'candidate'
        ORDER BY score DESC LIMIT 15
      \`).all(since);
      if (rows.length === 0) { console.error('最近3小时没有可用话题'); process.exit(1); }
      console.log(JSON.stringify(rows));
    " 2>>"$LOG_FILE")

    if [ $? -ne 0 ] || [ -z "$TOPICS_JSON" ]; then
      log "最近3小时没有可用话题，跳过"
      exit 0
    fi

    # 保存话题 ID 列表，用于后续标记
    ROUNDUP_TOPIC_IDS=$(echo "$TOPICS_JSON" | node -e "
      let d=''; process.stdin.on('data',c=>d+=c);
      process.stdin.on('end',()=>{ console.log(JSON.parse(d).map(t=>t.id).join(',')); });
    ")
    ROUNDUP_TOPIC_COUNT=$(echo "$ROUNDUP_TOPIC_IDS" | tr ',' '\n' | wc -l | tr -d ' ')

    log "纳入话题 ${ROUNDUP_TOPIC_COUNT} 条: IDs=${ROUNDUP_TOPIC_IDS}"

    # 立即标记为 selected（防止同时运行两个 hot_roundup 时重复选题）
    if [ -n "$ROUNDUP_TOPIC_IDS" ]; then
      node -e "
        const { getDb } = require('./server/db.mjs');
        const db = getDb();
        const ids = '$ROUNDUP_TOPIC_IDS'.split(',').map(Number);
        const stmt = db.prepare('UPDATE topics SET status = ? WHERE id = ?');
        ids.forEach(id => stmt.run('selected', id));
      " 2>/dev/null || true
    fi

    TOPIC_TITLE="A股热点快报 $(date +%H:%M)"
    PROMPT_DATA="$TOPICS_JSON"

    # 创建虚拟 topic
    TOPIC_ID=$($DB_CLI topic-add --title "$TOPIC_TITLE" --source "roundup" --score 0 --type "hot_roundup" 2>/dev/null || echo "")
    ;;

  douyin_hot)
    if [ -n "$TOPIC_ID" ] && [ -n "$TOPIC_TITLE" ]; then
      log "Step 1: [抖音热点] 使用指定话题 #$TOPIC_ID: $TOPIC_TITLE"
      $DB_CLI topic-update --id "$TOPIC_ID" --status selected 2>/dev/null || true
    else
      log "Step 1: [抖音热点] 抓取 A股热点..."
      TOPIC_JSON=$(node scripts/fetch-stock-hot.mjs --pick 2>>"$LOG_FILE")
      if [ $? -ne 0 ] || [ -z "$TOPIC_JSON" ]; then
        log "没有合适的新话题，跳过本次"
        exit 0
      fi

      TOPIC_TITLE=$(echo "$TOPIC_JSON" | node -e "process.stdin.on('data',d=>{console.log(JSON.parse(d).title)})")
      TOPIC_SCORE=$(echo "$TOPIC_JSON" | node -e "process.stdin.on('data',d=>{console.log(JSON.parse(d).hotValue||0)})")
      TOPIC_URL=$(echo "$TOPIC_JSON" | node -e "process.stdin.on('data',d=>{console.log(JSON.parse(d).url||'')})")
      log "选中话题: $TOPIC_TITLE"

      TOPIC_ID=$($DB_CLI topic-add --title "$TOPIC_TITLE" --score "$TOPIC_SCORE" --url "$TOPIC_URL" 2>/dev/null || echo "")
    fi
    ;;

  market_close)
    log "Step 1: [收盘点评] 抓取收盘数据..."
    MARKET_DATA=$(node scripts/fetch-market-data.mjs 2>>"$LOG_FILE")
    if [ $? -ne 0 ] || [ -z "$MARKET_DATA" ]; then
      log "[error] 收盘数据抓取失败"
      exit 1
    fi

    TOPIC_TITLE="收盘点评 $(date +%Y-%m-%d)"
    PROMPT_DATA="$MARKET_DATA"

    TOPIC_ID=$($DB_CLI topic-add --title "$TOPIC_TITLE" --source "market" --score 0 2>/dev/null || echo "")
    ;;

  morning_brief)
    log "Step 1: [早评] 抓取隔夜数据..."
    OVERNIGHT_DATA=$(node scripts/fetch-overnight-news.mjs 2>>"$LOG_FILE")
    if [ $? -ne 0 ] || [ -z "$OVERNIGHT_DATA" ]; then
      log "[error] 隔夜数据抓取失败"
      exit 1
    fi

    TOPIC_TITLE="早评 $(date +%Y-%m-%d)"
    PROMPT_DATA="$OVERNIGHT_DATA"

    TOPIC_ID=$($DB_CLI topic-add --title "$TOPIC_TITLE" --source "morning" --score 0 2>/dev/null || echo "")
    ;;

  *)
    log "[error] 未知视频类型: $VIDEO_TYPE"
    exit 1
    ;;
esac

if [ "$DRY_RUN" = true ]; then
  log "[dry-run] 类型: $VIDEO_TYPE | 话题: $TOPIC_TITLE"
  [ -n "$PROMPT_DATA" ] && log "[dry-run] 数据预览: $(echo "$PROMPT_DATA" | head -c 200)"
  exit 0
fi

# 创建视频记录
VIDEO_ID=$($DB_CLI video-create --topic-id "${TOPIC_ID:-0}" --type "$VIDEO_TYPE" 2>/dev/null || echo "")
[ -n "$VIDEO_ID" ] && $DB_CLI video-update --id "$VIDEO_ID" --log-file "$LOG_FILE" 2>/dev/null || true
[ -n "$VIDEO_ID" ] && $DB_CLI video-step --id "$VIDEO_ID" --step 1 --status ok 2>/dev/null || true
[ -n "$VIDEO_ID" ] && db_log "$VIDEO_ID" 1 "[$VIDEO_TYPE] 选中话题: $TOPIC_TITLE"

# === Step 2: Claude 写对话（按类型加载 prompt）===
log "Step 2: 调用 Claude 写对话... (类型: $VIDEO_TYPE)"

# 读取 prompt 模板并替换变量
PROMPT_FILE="$PROJECT_DIR/scripts/prompts/${VIDEO_TYPE//_/-}.txt"
if [ ! -f "$PROMPT_FILE" ]; then
  log "[error] Prompt 模板不存在: $PROMPT_FILE"
  [ -n "$VIDEO_ID" ] && $DB_CLI video-step --id "$VIDEO_ID" --step 2 --status fail --error "Prompt模板不存在" 2>/dev/null || true
  exit 1
fi

PROMPT_TEMPLATE=$(cat "$PROMPT_FILE")

# 根据类型替换占位符
# 用 Node.js 做 prompt 替换（写临时文件，避免 sed 无法处理多行内容的问题）
PROMPT_DATA_FILE="/tmp/pipeline-prompt-data-$$.txt"
printf '%s' "$( [ "$VIDEO_TYPE" = "douyin_hot" ] && echo "$TOPIC_TITLE" || echo "$PROMPT_DATA" )" > "$PROMPT_DATA_FILE"

CLAUDE_PROMPT=$(PIPE_VIDEO_TYPE="$VIDEO_TYPE" PIPE_TMPL_FILE="$PROMPT_FILE" PIPE_DATA_FILE="$PROMPT_DATA_FILE" node -e "
  const fs = require('fs');
  const type = process.env.PIPE_VIDEO_TYPE;
  const templateFile = process.env.PIPE_TMPL_FILE;
  const dataFile = process.env.PIPE_DATA_FILE;
  const template = fs.readFileSync(templateFile, 'utf8');
  const rawData = fs.readFileSync(dataFile, 'utf8').trim();
  let prompt = template;
  if (type === 'hot_roundup') {
    const arr = JSON.parse(rawData);
    const list = arr.map((t, i) => (i+1) + '. ' + t.title).join('\n');
    prompt = template.replace('{TOPICS}', list);
  } else if (type === 'douyin_hot') {
    prompt = template.replace('{TITLE}', rawData);
  } else if (type === 'market_close') {
    prompt = template.replace('{MARKET_DATA}', rawData);
  } else if (type === 'morning_brief') {
    prompt = template.replace('{OVERNIGHT_DATA}', rawData);
  }
  process.stdout.write(prompt);
")
rm -f "$PROMPT_DATA_FILE"

claude --print --model sonnet "$CLAUDE_PROMPT" > /tmp/dialogue-output.txt 2>>"$LOG_FILE"

# 提取 TypeScript 代码部分
if grep -q "export const sampleDialogue" /tmp/dialogue-output.txt; then
  # 保留原文件的 import 行
  head -1 src/data/sample-dialogue.ts > /tmp/dialogue-header.txt
  echo "" >> /tmp/dialogue-header.txt

  # 提取新对话
  sed -n '/\/\/ /,/^$/p' /tmp/dialogue-output.txt > /tmp/dialogue-comment.txt 2>/dev/null || true
  sed -n '/export const sampleDialogue/,/^];$/p' /tmp/dialogue-output.txt > /tmp/dialogue-body.txt

  # 组合
  cat /tmp/dialogue-header.txt > src/data/sample-dialogue.ts
  echo "// [$VIDEO_TYPE] $TOPIC_TITLE" >> src/data/sample-dialogue.ts
  echo "" >> src/data/sample-dialogue.ts
  cat /tmp/dialogue-body.txt >> src/data/sample-dialogue.ts

  # 追加角色配置（如果输出中没有）
  if ! grep -q "leftCharacter" src/data/sample-dialogue.ts; then
    cat >> src/data/sample-dialogue.ts << 'CHARS'

export const leftCharacter: CharacterConfig = {
  name: "小韭",
  image: "char-韭菜.png",
  imageWidth: 533,
  imageHeight: 800,
  faceCenter: { x: 208, y: 280, radius: 160 },
};

export const rightCharacter: CharacterConfig = {
  name: "老庄",
  image: "char-主力.png",
  imageWidth: 676,
  imageHeight: 800,
  faceCenter: { x: 350, y: 250, radius: 130 },
};
CHARS
  fi
  log "对话已写入 sample-dialogue.ts"
  LINE_COUNT=$(grep -c "speaker:" src/data/sample-dialogue.ts || echo "0")
  [ -n "$VIDEO_ID" ] && $DB_CLI video-step --id "$VIDEO_ID" --step 2 --status ok 2>/dev/null || true
  [ -n "$VIDEO_ID" ] && db_log "$VIDEO_ID" 2 "生成对话 ${LINE_COUNT} 轮"
else
  log "[error] Claude 输出格式异常，跳过"
  [ -n "$VIDEO_ID" ] && $DB_CLI video-step --id "$VIDEO_ID" --step 2 --status fail --error "Claude输出格式异常" 2>/dev/null || true
  exit 1
fi

# === Step 3: 选取背景素材 ===
log "Step 3: 随机选取背景素材..."
node scripts/pick-assets.mjs 2>>"$LOG_FILE"
log "背景素材选取完毕"
[ -n "$VIDEO_ID" ] && $DB_CLI video-step --id "$VIDEO_ID" --step 3 --status ok 2>/dev/null || true
[ -n "$VIDEO_ID" ] && db_log "$VIDEO_ID" 3 "背景素材选取完毕"

# === Step 4: ChatTTS 生成语音 ===
log "Step 4: ChatTTS 生成语音..."
if source .venv/bin/activate && python scripts/generate-audio-chattts.py 2>>"$LOG_FILE"; then
  log "语音生成完毕"
  [ -n "$VIDEO_ID" ] && $DB_CLI video-step --id "$VIDEO_ID" --step 4 --status ok 2>/dev/null || true
  [ -n "$VIDEO_ID" ] && $DB_CLI video-update --id "$VIDEO_ID" --audio "out/dialogue-audio.wav" 2>/dev/null || true
  [ -n "$VIDEO_ID" ] && db_log "$VIDEO_ID" 4 "语音生成完毕"
else
  log "[error] ChatTTS 语音生成失败"
  [ -n "$VIDEO_ID" ] && $DB_CLI video-step --id "$VIDEO_ID" --step 4 --status fail --error "ChatTTS生成失败" 2>/dev/null || true
  exit 1
fi

# === Step 5: 渲染视频 ===
log "Step 5: Remotion 渲染视频..."
if npx remotion render DialogueAnimation out/dialogue.mp4 --codec h264 2>>"$LOG_FILE"; then
  log "视频渲染完毕"
  [ -n "$VIDEO_ID" ] && $DB_CLI video-step --id "$VIDEO_ID" --step 5 --status ok 2>/dev/null || true
  [ -n "$VIDEO_ID" ] && $DB_CLI video-update --id "$VIDEO_ID" --video "out/dialogue.mp4" 2>/dev/null || true
  [ -n "$VIDEO_ID" ] && db_log "$VIDEO_ID" 5 "视频渲染完毕"
else
  log "[error] Remotion 渲染失败"
  [ -n "$VIDEO_ID" ] && $DB_CLI video-step --id "$VIDEO_ID" --step 5 --status fail --error "Remotion渲染失败" 2>/dev/null || true
  exit 1
fi

# === Step 6: 合并音视频（混音：视频内嵌音效 + TTS 语音）===
log "Step 6: 合并音视频..."
if ffmpeg -y -i out/dialogue.mp4 -i out/dialogue-audio.wav \
  -filter_complex "[0:a][1:a]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[aout]" \
  -map 0:v:0 -map "[aout]" -c:v copy -c:a aac -b:a 128k -shortest \
  out/dialogue-final.mp4 2>>"$LOG_FILE"; then
  log "合并完成: out/dialogue-final.mp4"
  FINAL_SIZE=$(du -m out/dialogue-final.mp4 | cut -f1)
  FINAL_DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 out/dialogue-final.mp4 2>/dev/null | cut -d. -f1 || echo "0")
  [ -n "$VIDEO_ID" ] && $DB_CLI video-step --id "$VIDEO_ID" --step 6 --status ok 2>/dev/null || true
  [ -n "$VIDEO_ID" ] && $DB_CLI video-update --id "$VIDEO_ID" --final "out/dialogue-final.mp4" --size "$FINAL_SIZE" --duration "$FINAL_DURATION" 2>/dev/null || true
  [ -n "$VIDEO_ID" ] && db_log "$VIDEO_ID" 6 "合并完成 ${FINAL_SIZE}MB ${FINAL_DURATION}s"
else
  log "[error] ffmpeg 合并失败"
  [ -n "$VIDEO_ID" ] && $DB_CLI video-step --id "$VIDEO_ID" --step 6 --status fail --error "ffmpeg合并失败" 2>/dev/null || true
  exit 1
fi

# === Step 7: 跳过（发布改为 Dashboard 手动操作）===
log "Step 7: 跳过（发布改为手动）"
[ -n "$VIDEO_ID" ] && db_log "$VIDEO_ID" 7 "跳过自动发布，请在 Dashboard 手动发布"

# === Step 8: 归档 ===
log "Step 8: 归档..."

# 写 published.json（兼容旧去重逻辑）
PUBLISHED_FILE="$PROJECT_DIR/data/published.json"
DATE_NOW=$(date +%Y-%m-%dT%H:%M:%S)
SHORT_TITLE=$(echo "$TOPIC_TITLE" | cut -c1-28)

node -e "
const fs = require('fs');
const file = '$PUBLISHED_FILE';
const list = JSON.parse(fs.readFileSync(file, 'utf-8'));
list.push({
  title: $(echo "$TOPIC_TITLE" | node -e "process.stdin.on('data',d=>{console.log(JSON.stringify(d.toString().trim()))})"),
  date: '$DATE_NOW',
  video: 'out/dialogue-final.mp4',
  type: '$VIDEO_TYPE',
});
fs.writeFileSync(file, JSON.stringify(list, null, 2));
"
log "已记录到 published.json"

# 归档
ARCHIVE_DIR="$PROJECT_DIR/a股/$(date +%Y%m%d)"
mkdir -p "$ARCHIVE_DIR"
SAFE_TITLE=$(echo "$SHORT_TITLE" | tr '/' '_')
cp out/dialogue-final.mp4 "$ARCHIVE_DIR/$SAFE_TITLE.mp4"
log "已归档到 $ARCHIVE_DIR/"

# 更新数据库 — 标记为 completed（等待手动发布）
[ -n "$VIDEO_ID" ] && $DB_CLI video-step --id "$VIDEO_ID" --step 8 --status ok 2>/dev/null || true
[ -n "$VIDEO_ID" ] && $DB_CLI video-update --id "$VIDEO_ID" --status completed --archive "$ARCHIVE_DIR/$SAFE_TITLE.mp4" 2>/dev/null || true
[ -n "$VIDEO_ID" ] && $DB_CLI topic-update --id "${TOPIC_ID:-0}" --status used 2>/dev/null || true

# hot_roundup 额外：把所有纳入的子话题标记为 used（防止下一批重复选入）
if [ "$VIDEO_TYPE" = "hot_roundup" ] && [ -n "${ROUNDUP_TOPIC_IDS:-}" ]; then
  node -e "
    const { getDb } = require('./server/db.mjs');
    const db = getDb();
    const ids = '$ROUNDUP_TOPIC_IDS'.split(',').map(Number);
    const stmt = db.prepare('UPDATE topics SET status = ? WHERE id = ?');
    ids.forEach(id => stmt.run('used', id));
    console.log('标记 ' + ids.length + ' 条子话题为 used');
  " 2>/dev/null || true
  log "hot_roundup 子话题已标记为 used: ${ROUNDUP_TOPIC_IDS}"
fi

[ -n "$VIDEO_ID" ] && db_log "$VIDEO_ID" 8 "归档完成: $ARCHIVE_DIR/"

log "=== [$VIDEO_TYPE] 流水线完成！视频待发布，请在 Dashboard 操作 ==="
