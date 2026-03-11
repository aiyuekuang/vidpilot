#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== VidPilot Install ==="
echo ""

# 1. Copy example config (don't overwrite existing)
if [ ! -f "$PROJECT_DIR/config.json" ]; then
  cp "$PROJECT_DIR/config.example.json" "$PROJECT_DIR/config.json"
  echo "[ok] Created config.json from template"
  echo "     Edit config.json to add your accounts, then re-run install.sh"
else
  echo "[skip] config.json already exists"
fi

# 2. Install Remotion engine dependencies
echo ""
echo "[step] Installing engine dependencies..."
cd "$PROJECT_DIR/engine"
npm install --silent
echo "[ok] Engine ready"

# 3. Setup account directories + generate registry.ts from config.json
echo ""
echo "[step] Setting up accounts..."
cd "$PROJECT_DIR"
node scripts/setup-accounts.mjs

# 4. Create Python venv for TTS (optional)
echo ""
echo "[step] Setting up TTS environment..."
if command -v python3 &> /dev/null; then
  if [ ! -d "$PROJECT_DIR/.venv" ]; then
    python3 -m venv "$PROJECT_DIR/.venv"
    echo "[ok] Python venv created"
  fi
  source "$PROJECT_DIR/.venv/bin/activate"
  if ! python3 -c "import ChatTTS" 2>/dev/null; then
    echo "[step] Installing ChatTTS (this may take a few minutes)..."
    pip install -q ChatTTS torch torchaudio soundfile numpy
    echo "[ok] TTS ready"
  else
    echo "[skip] TTS already installed"
  fi
else
  echo "[warn] python3 not found, TTS unavailable"
fi

# 5. Install as Claude Code skill
echo ""
SKILLS_DIR="$HOME/.claude/skills"
if [ -d "$SKILLS_DIR" ]; then
  SKILL_LINK="$SKILLS_DIR/vidpilot"
  if [ ! -e "$SKILL_LINK" ]; then
    ln -s "$PROJECT_DIR" "$SKILL_LINK"
    echo "[ok] Skill installed: $SKILL_LINK"
  else
    echo "[skip] Skill already linked"
  fi
fi

echo ""
echo "=== Done ==="
echo ""
echo "Next: add character images to engine/public/, then ask Claude to make a video!"
