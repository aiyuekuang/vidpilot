---
name: vidpilot
description: "AI-powered short video automation. Triggers when user says 'make a video', 'generate content', 'run vidpilot', or references video/content creation for social media accounts. Supports 5 video formats (dialogue, slides, ranking, code demo, narration) + article. Multi-account support with config-driven characters, voice seeds, and personas. Full pipeline: hot topic collection, script generation, TTS audio (ChatTTS), Remotion video rendering, and FFmpeg merging."
---

# VidPilot - AI Short Video Automation Skill

Multi-account short video automation for Claude Code. Supports 5 video modes + article format.

---

## Step 0: Environment Check (MUST DO FIRST)

Every time the user triggers vidpilot, you MUST run through these checks **in order** before doing anything else. Do NOT skip any check. Do NOT assume anything exists.

### 0.1 Locate Project Directory

The project directory is the user's current working directory (CWD). Check if `vidpilot.json` exists there:

```bash
ls {CWD}/vidpilot.json
```

**If vidpilot.json exists** -> go to 0.3.

**If vidpilot.json does NOT exist** -> go to 0.2.

### 0.2 First-Time Setup: Guide User Through Initialization

This is a new project. Walk the user through setup interactively.

**0.2.1 Ask for account name**

Tell the user:

> VidPilot needs an account config. An "account" represents one content brand/channel (e.g., a TikTok account, a YouTube channel).
>
> Please tell me:
> 1. **Account ID** — a short English identifier, used as folder name (e.g., `laodong`, `stock`, `my-tech`)
> 2. **Display Name** — the channel/brand name shown in output (e.g., "程序员老东", "Tech Daily")
> 3. **Content domain** — what kind of content? (e.g., AI tech, stock market, coding tutorials)
>
> I'll create the config and directories for you.

**Wait for user response.** Do NOT proceed without their input.

**0.2.2 Confirm and explain what will be created**

After user provides account info, show them exactly what you will create and ask for confirmation:

> I'll set up VidPilot for account **"{displayName}"** (ID: `{accountId}`):
>
> **Files to create:**
> - `vidpilot.json` — master config with your account settings
> - `accounts/{accountId}/` — asset directories, organized by type:
>
> ```
> accounts/{accountId}/
> ├── characters/       # 角色形象 (dialogue format)
> │   ├── left.png      # Left character (PNG, ~500-800px, transparent bg recommended)
> │   └── right.png     # Right character
> ├── backgrounds/      # 背景图 (dialogue format)
> │   └── bg.png        # Default background (1080x1920 for vertical video)
> └── images/           # 每期配图 (narration format, add per-video)
> ```
>
> - `output/{displayName}/` — rendered videos will be archived here by date
>
> **Which formats need which assets:**
> | Format | Required Assets | Where to Put |
> |--------|----------------|--------------|
> | dialogue | 2 character PNGs + 1 background PNG | `characters/` + `backgrounds/` |
> | slides | None (auto-rendered with colors + emoji) | - |
> | ranking | None (auto-rendered with colors + emoji) | - |
> | code | None (auto-rendered code blocks) | - |
> | narration | Optional per-segment images | `images/` (add before each video) |
>
> **How it works:**
> 1. Put character images in `accounts/{accountId}/characters/` (one-time setup)
> 2. Tell me "make a video" and I'll find hot topics, write scripts, generate audio, and render video
> 3. For narration videos, add topic-related images to `accounts/{accountId}/images/` before rendering
> 4. Final videos appear in `output/{displayName}/YYYY-MM-DD/`
>
> Shall I proceed?

**Wait for user confirmation.** Do NOT create anything without "yes/ok/proceed" from user.

**0.2.3 Create config and directories**

Once confirmed:

1. Create `vidpilot.json` with the account config (use config.example.json from skill dir as template, customize with user's info)
2. Run `node {skillDir}/scripts/setup-accounts.mjs {projectDir}` — this auto-creates:
   - `accounts/{accountId}/characters/`
   - `accounts/{accountId}/backgrounds/`
   - `accounts/{accountId}/images/`
   - `output/{displayName}/`
   - `engine/src/data/{accountId}/` (in skill dir)

Then tell user:

> Setup complete! Your asset directories are ready:
>
> **One-time setup** (do this once per account):
> 1. Put left character image in `accounts/{accountId}/characters/` — filename must match `vidpilot.json` config
> 2. Put right character image in `accounts/{accountId}/characters/`
> 3. Put background image in `accounts/{accountId}/backgrounds/`
> 4. Update `vidpilot.json` → `characters` section with correct filenames, image dimensions, and face center coordinates
>
> **Per-video setup** (only for narration format):
> - Add topic-related images to `accounts/{accountId}/images/` before generating narration videos
> - These images are referenced by filename in the narration script's `image` field
>
> **No images needed** for slides, ranking, and code formats — they render automatically!
>
> Want me to help you prepare character images now, or shall we make a video with the example characters first?

### 0.3 Load Account List

Read `vidpilot.json` and list all available accounts:

```bash
cat {CWD}/vidpilot.json
```

Parse the `accounts` object. If there are multiple accounts, present them to the user:

> Found {N} accounts:
> | # | ID | Name | Formats |
> |---|-----|------|---------|
> | 1 | {id1} | {name1} | dialogue, slides, ... |
> | 2 | {id2} | {name2} | dialogue |
>
> Which account should I use?

If there is only 1 account, auto-select it and confirm:

> Using account **"{name}"** (ID: `{id}`). Let me check the assets...

### 0.4 Verify Account Assets

For the selected account, check that required images exist in the correct subdirectories:

```bash
ls {CWD}/accounts/{accountId}/characters/
ls {CWD}/accounts/{accountId}/backgrounds/
ls {CWD}/accounts/{accountId}/images/
```

Check for files referenced in vidpilot.json:
- `characters.left.image` → should be in `accounts/{accountId}/characters/`
- `characters.right.image` → should be in `accounts/{accountId}/characters/`
- `backgroundImage` → should be in `accounts/{accountId}/backgrounds/`

**If all required images exist** -> Sync them to skill engine and proceed to Pipeline Step 1.

```bash
node {skillDir}/scripts/setup-accounts.mjs {CWD}
```

**If images are missing**, tell the user clearly which subdirectory needs what:

> Account **"{name}"** is missing these required assets:
>
> | Missing File | Put It In | Purpose |
> |-------------|-----------|---------|
> | `{filename}` | `accounts/{id}/characters/` | Left character for dialogue videos |
> | `{filename}` | `accounts/{id}/backgrounds/` | Background for dialogue videos |
>
> Image requirements:
> - **Character images**: PNG, ~500-800px wide, transparent background works best
> - **Background image**: PNG, 1080x1920 for vertical video
>
> Please add these files and tell me when ready.
> Alternatively, I can use example characters to make a test video first. Want to try that?

**Do NOT proceed with dialogue/narration video if critical assets are missing.** Slides, ranking, and code formats can proceed without any images.

### 0.5 Narration Format: Per-Video Image Check

When the selected format is **narration** and the script references images (`segment.image`):

1. Check if referenced images exist in `accounts/{accountId}/images/`
2. If missing, tell user:

> This narration script references images that aren't in `accounts/{accountId}/images/` yet:
> - `{filename1}` — for segment "{segment text}"
> - `{filename2}` — for segment "{segment text}"
>
> Options:
> 1. Add the images to `accounts/{accountId}/images/` and tell me when ready
> 2. I can generate the script without images (text-only narration, still looks good)
> 3. I can use AI to generate placeholder images (requires image generation tool)

### 0.6 Adding a New Account to Existing Project

If the user says "add a new account" or "create another channel":

1. Ask for account ID, display name, and content domain (same as 0.2.1)
2. Read existing `vidpilot.json`, add the new account to the `accounts` object
3. Run `setup-accounts.mjs` to create all subdirectories and regenerate registry
4. Tell user which subdirectories were created and what to put in each

---

## Architecture: Skill vs Project

VidPilot separates **skill** (code, reusable) from **project** (user data, unique per user).

```
~/.claude/skills/vidpilot/         # SKILL (git clone, shared code)
├── SKILL.md
├── config.example.json            # Template for users to copy
├── engine/                        # Remotion rendering engine
│   ├── src/
│   │   ├── Root.tsx               # Dynamic composition registration
│   │   ├── accounts.ts            # Reads vidpilot.json from project dir
│   │   ├── types.ts               # All type definitions
│   │   ├── components/            # 5 scene components
│   │   └── data/
│   │       ├── example/           # Example data (git-tracked)
│   │       ├── registry.ts        # Auto-generated (gitignored)
│   │       └── {accountId}/       # Generated per account (gitignored)
│   └── public/                    # Synced images + sfx
├── scripts/
│   ├── config_loader.py           # Reads vidpilot.json from project dir
│   ├── setup-accounts.mjs         # Creates dirs + generates registry.ts
│   ├── generate-audio-*.py        # TTS scripts
│   └── ...
└── install.sh

{CWD}/                             # PROJECT (user data, not in skill repo)
├── vidpilot.json                  # Account config (user creates/edits)
├── accounts/
│   └── {accountId}/
│       ├── characters/            # Character images (one-time, dialogue format)
│       ├── backgrounds/           # Background images (one-time, dialogue format)
│       └── images/                # Per-video images (narration format)
└── output/
    └── {displayName}/             # Archived videos per account
        └── YYYY-MM-DD/
```

**Asset subdirectory roles:**

| Directory | Used By | Frequency | Description |
|-----------|---------|-----------|-------------|
| `characters/` | dialogue | One-time setup | Left/right character PNGs, transparent bg recommended |
| `backgrounds/` | dialogue | One-time setup | 1080x1920 vertical background |
| `images/` | narration | Per-video | Topic images referenced in narration script's `segment.image` |
| _(none needed)_ | slides, ranking, code | - | Auto-rendered, no external images |

**Config resolution order:**
1. `VIDPILOT_CONFIG` env var (absolute path)
2. `VIDPILOT_PROJECT` env var + `/vidpilot.json`
3. `CWD/vidpilot.json` (run commands from project root)

---

## Pipeline (Steps 1-8)

> Only proceed here AFTER Step 0 passes all checks.

### Step 1: Collect Hot Topics

Use WebSearch or custom scripts defined in `vidpilot.json` account's `hotspot` field.

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

Write data files to `{skillDir}/engine/src/data/{accountId}/`. Then run `node scripts/setup-accounts.mjs {projectDir}` to regenerate registry.ts.

**Data file conventions:**

| Format | Filename | Exports | Import types from |
|--------|----------|---------|-------------------|
| dialogue | `ai-dialogue.ts` | `dialogue` | `../../types` |
| slides | `ai-slides.ts` | `slides`, `theme` | `../../types` |
| ranking | `ai-ranking.ts` | `rankSlides`, `theme` | `../../types` |
| code | `ai-code.ts` | `codeSteps`, `theme` | `../../types` |
| narration | `ai-narration.ts` | `segments`, `theme` | `../../types` |

**Character names come from vidpilot.json** (not hardcoded in data files).

**Narration image references**: When generating narration scripts with images, the `segment.image` field should reference filenames that the user has placed in `accounts/{accountId}/images/`. Run `setup-accounts.mjs` after adding images to sync them to `engine/public/`.

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
- `image` field is optional: references filename in `accounts/{accountId}/images/`
- Without images, narration renders with text-only animated backgrounds (still looks good)

#### 4F: Article

- 800-2000 chars, 3-6 sections. Save to `/tmp/vidpilot_article.txt`.

---

### Step 5: Review + Fact Check

GitHub is the primary verification source. Check each claim per format guidelines.

---

### Step 6: Generate Audio + Render Video

Before rendering, sync assets from project to skill engine:

```bash
node {skillDir}/scripts/setup-accounts.mjs {projectDir}
```

Then generate audio and render:

```bash
VIDPILOT_DIR=~/.claude/skills/vidpilot
cd $VIDPILOT_DIR
source .venv/bin/activate

# Generate TTS audio
VIDPILOT_PROJECT={projectDir} ACCOUNT={accountId} python scripts/generate-audio-{format}.py

# Render video
cd engine
VIDPILOT_PROJECT={projectDir} npx remotion render {accountId}-{format} ../out/{accountId}-{format}.mp4 --codec h264

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
{projectDir}/{account.outputDir}/YYYY-MM-DD/
  ├── [video-title].mp4
  ├── [data-file].ts
  └── README.md
```

---

## Data Registry Update

After writing data files, regenerate registry by running:

```bash
node scripts/setup-accounts.mjs {projectDir}
```

Or manually update `engine/src/data/registry.ts`:

```typescript
import { dialogue as myDialogue } from "./{accountId}/ai-dialogue";

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
- Config file: `vidpilot.json` in **project** directory (not skill directory)
- Assets: `accounts/{id}/` in **project** directory (subdivided by type)
- Output: `output/{name}/` in **project** directory
- Never mix data between accounts
