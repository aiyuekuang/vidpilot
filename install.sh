#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== VidPilot Install ==="
echo ""

# 1. Copy example config (don't overwrite existing)
if [ ! -f "$PROJECT_DIR/config.json" ]; then
  cp "$PROJECT_DIR/config.example.json" "$PROJECT_DIR/config.json"
  echo "[ok] Created config: $PROJECT_DIR/config.json"
  echo "     Edit this file to configure your accounts."
else
  echo "[skip] Config already exists: $PROJECT_DIR/config.json"
fi

# 2. Install Remotion engine dependencies
echo ""
echo "[step] Installing Remotion engine dependencies..."
cd "$PROJECT_DIR/engine"
npm install --silent
echo "[ok] Engine dependencies installed."

# 3. Create Python venv for TTS (optional)
echo ""
echo "[step] Setting up Python environment for TTS..."
if command -v python3 &> /dev/null; then
  if [ ! -d "$PROJECT_DIR/.venv" ]; then
    python3 -m venv "$PROJECT_DIR/.venv"
    echo "[ok] Python venv created: $PROJECT_DIR/.venv"
  else
    echo "[skip] Python venv already exists."
  fi

  source "$PROJECT_DIR/.venv/bin/activate"

  # Check if ChatTTS is installed
  if ! python3 -c "import ChatTTS" 2>/dev/null; then
    echo "[step] Installing ChatTTS and dependencies..."
    pip install -q ChatTTS torch torchaudio soundfile numpy
    echo "[ok] TTS dependencies installed."
  else
    echo "[skip] ChatTTS already installed."
  fi
else
  echo "[warn] python3 not found. TTS features will not be available."
  echo "       Install Python 3.10+ to enable voice generation."
fi

# 4. Install as Claude Code skill (optional)
echo ""
SKILLS_DIR="$HOME/.claude/skills"
if [ -d "$SKILLS_DIR" ]; then
  SKILL_LINK="$SKILLS_DIR/vidpilot"
  if [ ! -e "$SKILL_LINK" ]; then
    ln -s "$PROJECT_DIR" "$SKILL_LINK"
    echo "[ok] Installed as Claude Code skill: $SKILL_LINK"
  else
    echo "[skip] Claude Code skill already linked."
  fi
else
  echo "[info] Claude Code skills directory not found."
  echo "       To use as a skill, manually symlink:"
  echo "       ln -s $PROJECT_DIR $SKILLS_DIR/vidpilot"
fi

echo ""
echo "=== Install Complete ==="
echo ""
echo "Next steps:"
echo "  1. Edit $PROJECT_DIR/config.json to configure your accounts"
echo "  2. Add character images to engine/public/"
echo "  3. Use 'ACCOUNT=yourname' with the TTS and render scripts"
echo ""
echo "Quick test:"
echo "  cd $PROJECT_DIR/engine && npx remotion studio src/index.ts"
