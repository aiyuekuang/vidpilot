#!/bin/bash
set -e

SKILL_DIR="$(cd "$(dirname "$0")" && pwd)"

# Resolve project directory
PROJECT_DIR="${1:-$(pwd)}"

echo "=== VidPilot Install ==="
echo ""
echo "Skill dir:   $SKILL_DIR"
echo "Project dir: $PROJECT_DIR"
echo ""

# 1. Check or create vidpilot.json in project
if [ ! -f "$PROJECT_DIR/vidpilot.json" ]; then
  cp "$SKILL_DIR/config.example.json" "$PROJECT_DIR/vidpilot.json"
  echo "[ok] Created vidpilot.json in project directory"
  echo "     Edit vidpilot.json to configure your accounts, then re-run."
else
  echo "[skip] vidpilot.json already exists in project"
fi

# 2. Install Remotion engine dependencies
echo ""
echo "[step] Installing engine dependencies..."
cd "$SKILL_DIR/engine"
npm install --silent
echo "[ok] Engine ready"

# 3. Setup account directories + generate registry.ts
echo ""
echo "[step] Setting up accounts..."
cd "$SKILL_DIR"
node scripts/setup-accounts.mjs "$PROJECT_DIR"

# 4. Create Python venv for TTS (optional)
echo ""
echo "[step] Setting up TTS environment..."
if command -v python3 &> /dev/null; then
  if [ ! -d "$SKILL_DIR/.venv" ]; then
    python3 -m venv "$SKILL_DIR/.venv"
    echo "[ok] Python venv created"
  fi
  source "$SKILL_DIR/.venv/bin/activate"
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
    ln -s "$SKILL_DIR" "$SKILL_LINK"
    echo "[ok] Skill installed: $SKILL_LINK"
  else
    echo "[skip] Skill already linked"
  fi
fi

echo ""
echo "=== Done ==="
echo ""
echo "Project structure:"
echo "  $PROJECT_DIR/"
echo "    vidpilot.json     — account config"
echo "    accounts/{id}/    — character images (drop your images here)"
echo "    output/{name}/    — archived videos"
echo ""
echo "Next: add character images to accounts/{id}/, then ask Claude to make a video!"
