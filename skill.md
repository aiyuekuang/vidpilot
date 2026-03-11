---
name: vidpilot
description: "AI-powered short video automation. Triggers when user says 'make a video', 'generate content', 'run vidpilot', or references video/content creation for social media accounts. Supports 5 video formats (dialogue, slides, ranking, code demo, narration) + article. Multi-account support with config-driven characters, voice seeds, and personas. Full pipeline: hot topic collection, script generation, TTS audio (ChatTTS), Remotion video rendering, and FFmpeg merging."
---

# VidPilot - AI Short Video Automation Skill

Multi-account short video automation for Claude Code. Supports 5 video modes + article format.

---

## Project Layout

```
vidpilot/                          # This skill repo
├── config.json                    # Account configs (gitignored, user-specific)
├── config.example.json            # Template config
├── engine/                        # Remotion rendering engine
│   ├── src/
│   │   ├── Root.tsx               # Dynamic composition registration
│   │   ├── accounts.ts            # Config-driven account loader
│   │   ├── types.ts               # All type definitions
│   │   ├── components/            # 5 scene components
│   │   └── data/
│   │       ├── registry.ts        # Data file registry (auto-updated)
│   │       └── {accountId}/       # Per-account data files
│   └── public/                    # Assets (images, sfx)
├── scripts/
│   ├── config_loader.py           # Shared Python config reader
│   ├── generate-audio-chattts.py  # Dialogue TTS
│   ├── generate-audio-slides.py   # Slides TTS
│   ├── generate-audio-ranking.py  # Ranking TTS
│   ├── generate-audio-code.py     # Code demo TTS
│   └── generate-audio-narration.py # Narration TTS
└── install.sh
```

---

## Account System

All accounts are configured in `config.json`. The skill reads this file at runtime.

**Step 0: Identify Account**

Read `config.json` to get the account list. Match account by user intent:
- If unclear, list all accounts and ask user to choose.
- Once confirmed, use `ACCOUNT={accountId}` for all subsequent commands.

---

## Output Directory

```
{account.outputDir}/YYYY-MM-DD/
```
Stores: video files, scripts, README.md

---

## Pipeline

### Step 1: Collect Hot Topics

Use WebSearch or custom scripts defined in `config.json` account's `hotspot` field.

---

### Step 2: Topic Selection + Format Detection

Pick the best topic for the account. Auto-detect format:

| Topic Pattern | Format | Example |
|---------------|--------|---------|
| Controversy, humor, emotional | **dialogue** | AI drama, industry gossip |
| Quick explainer, data comparison | **slides** | Salary rankings, tool comparison |
| Rankings, benchmarks, TOP-N | **ranking** | AI tool TOP5, benchmark scores |
| Code tutorial, API demo | **code** | Installation guide, code tricks |
| News report, visual storytelling | **narration** | Product launch, event timeline |
| Deep tutorial, detailed guide | **article** | Full tutorial, deep comparison |

**Priority**: ranking > code > dialogue > slides > narration > article

> Only select formats allowed by the account's `formats` config.

---

### Step 3: Deep Research

WebSearch for core data, hot discussions, different viewpoints on the topic.

---

### Step 4: Generate Script

Write data files to `engine/src/data/{accountId}/`. Then update `engine/src/data/registry.ts` to import the new data.

**Data file conventions:**

| Format | Filename | Exports | Import types from |
|--------|----------|---------|-------------------|
| dialogue | `ai-dialogue.ts` | `dialogue` | `../../types` |
| slides | `ai-slides.ts` | `slides`, `theme` | `../../types` |
| ranking | `ai-ranking.ts` | `rankSlides`, `theme` | `../../types` |
| code | `ai-code.ts` | `codeSteps`, `theme` | `../../types` |
| narration | `ai-narration.ts` | `segments`, `theme` | `../../types` |

**Character names come from config.json** (not hardcoded in data files).

#### 4A: Dialogue Script

- 60-90s, 12-18 rounds, 200-350 chars total
- Per line: 10-22 chars, duration = chars x 7 (frames), min 60, max 200
- Expressions: `default` `smile` `laugh` `smug` `shocked` `angry` `cry` `speechless` `confused` `contempt` `shy` `excited` `despair` `evil`

```typescript
import { DialogueLine } from "../../types";
export const dialogue: DialogueLine[] = [
  { speaker: "left", text: "...", duration: 120, expression: "excited", listenerExpression: "smile" },
];
```

#### 4B: Slides Script

- Layouts: `cover` `content` `data` `quote` `split` `end`
- Themes: `"dark"` `"tech"` `"warm"`
- 30-80 chars narration per slide, 6-10 slides

#### 4C: Ranking Script

- 5-8 items per slide, 1-3 slides
- Values must have real data sources

#### 4D: Code Demo Script

- 3-6 steps, 5-20 lines of code each
- Code must be real and runnable

#### 4E: Narration Script

- 4-8 segments, text <= 30 chars
- Effects: `kenburns` `fadeIn` `zoomIn`

#### 4F: Article

- 800-2000 chars, 3-6 sections. Save to `/tmp/vidpilot_article.txt`.

---

### Step 5: Review + Fact Check

GitHub is the primary verification source. Check each claim per format guidelines.

---

### Step 6: Generate Audio + Render Video

```bash
VIDPILOT_DIR=~/.claude/skills/vidpilot  # or wherever installed
cd $VIDPILOT_DIR
source .venv/bin/activate

# Generate TTS audio
ACCOUNT={accountId} python scripts/generate-audio-{format}.py

# Render video
cd engine
npx remotion render {accountId}-{format} ../out/{accountId}-{format}.mp4 --codec h264

# Merge audio + video
ffmpeg -y -i ../out/{accountId}-{format}.mp4 -i ../out/{audioFile} \
  -filter_complex "[0:a][1:a]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[aout]" \
  -map 0:v:0 -map "[aout]" -c:v copy -c:a aac -b:a 128k -shortest \
  ../out/{accountId}-{format}-final.mp4
```

**Format -> TTS script -> Audio file mapping:**

| Format | TTS Script | Audio File |
|--------|-----------|------------|
| dialogue | generate-audio-chattts.py | dialogue-audio.wav |
| slides | generate-audio-slides.py | slides-audio.wav |
| ranking | generate-audio-ranking.py | ranking-audio.wav |
| code | generate-audio-code.py | code-audio.wav |
| narration | generate-audio-narration.py | narration-audio.wav |

---

### Step 7: Title, Tags, Summary

Generate 3 title candidates (15-20 chars, hook in first 5 chars).
3-5 hashtags. 80-120 char description.

---

### Step 8: Archive

```
{account.outputDir}/YYYY-MM-DD/
  ├── [video-title].mp4
  ├── [data-file].ts
  └── README.md
```

---

## Data Registry Update

After writing data files, update `engine/src/data/registry.ts`:

```typescript
// Add import for the new account data
import { dialogue as myDialogue } from "./{accountId}/ai-dialogue";

// Add to registry object
export const registry = {
  // ... existing entries ...
  {accountId}: {
    dialogue: {
      data: myDialogue,
      totalFrames: sumFrames(myDialogue),
    },
  },
};
```

---

## Isolation Rules

- Each account's data files in: `engine/src/data/{accountId}/`
- Composition IDs: `{accountId}-{format}`
- TTS routing: `ACCOUNT={accountId}` env var
- Never mix data between accounts
