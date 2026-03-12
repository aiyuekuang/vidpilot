# VidPilot

English | [中文](README.zh.md)

AI-powered short video automation skill for [Claude Code](https://docs.anthropic.com/en/docs/claude-code).

Turn trending topics into engaging short videos with 5 different formats — all rendered locally, no cloud APIs needed.

## Video Formats

| Format | Description | Best For |
|--------|-------------|----------|
| **Dialogue** | Two-character animated conversation with expressions & SFX | Hot takes, humor, controversy |
| **Slides** | PPT-style presentation with narration | Data explainers, comparisons |
| **Ranking** | Animated bar chart rankings | TOP-N lists, benchmarks |
| **Code Demo** | Syntax-highlighted code with typewriter effect | Tutorials, API demos |
| **Narration** | Image + text overlay with Ken Burns effect | News, product launches |

Plus **article** format for long-form text content.

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/aiyuekuang/vidpilot.git
cd vidpilot
bash install.sh

# 2. Edit config (install.sh auto-creates from template)
vim config.json

# 3. Preview in browser
cd engine && npx remotion studio src/index.ts
```

## How It Works

VidPilot is a Claude Code skill. When triggered, it runs this pipeline:

1. **Collect** trending topics (WebSearch / custom scripts)
2. **Select** the best topic and auto-detect video format
3. **Research** the topic in depth
4. **Generate** the script (TypeScript data file)
5. **Review** facts and data accuracy
6. **Render** TTS audio (ChatTTS) + video (Remotion) + merge (FFmpeg)
7. **Package** with title, tags, and description

## Project Structure

```
vidpilot/
├── skill.md                 # Claude Code skill entry point
├── config.json              # Your account configs (gitignored)
├── config.example.json      # Config template
├── install.sh               # One-click setup
├── engine/                  # Remotion video rendering
│   ├── src/
│   │   ├── components/      # 5 scene components
│   │   ├── data/            # Content data files per account
│   │   │   ├── registry.ts  # Data file registry
│   │   │   └── example/     # Example data files
│   │   ├── accounts.ts      # Config-driven account loader
│   │   ├── types.ts         # TypeScript type definitions
│   │   └── Root.tsx         # Remotion composition root
│   └── public/              # Images, sound effects
└── scripts/                 # TTS audio generation (Python)
    ├── config_loader.py     # Shared config reader
    └── generate-audio-*.py  # One script per format
```

## Multi-Account Support

Configure multiple accounts in `config.json`, each with:
- Custom character images and names
- Independent voice seeds (ChatTTS)
- Per-account output directories
- Format restrictions (e.g., stock account = dialogue only)
- Persona settings for content tone

```json
{
  "accounts": {
    "my-channel": {
      "name": "My Channel",
      "outputDir": "~/Videos/my-channel",
      "formats": ["dialogue", "slides"],
      "characters": { ... },
      "voiceSeeds": { "left": 42, "right": 2024, "narrator": 2024 }
    }
  }
}
```

See [config.example.json](config.example.json) for the full schema.

## Requirements

- **Node.js** >= 18
- **Python** >= 3.10 (for TTS)
- **FFmpeg** (for audio post-processing and video merging)
- **Claude Code** (to use as a skill)

## Adding a New Account

1. Add account config to `config.json`
2. Put character images in `engine/public/`
3. Create data directory: `engine/src/data/{accountId}/`
4. The skill auto-generates data files and updates `registry.ts`

## Adding Custom Character Images

Character images should be PNG with transparent background, roughly 500-700px wide and 800px tall. Configure `faceCenter` in config to position the expression overlay correctly.

## License

MIT
