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
- `background` → should be in `accounts/{accountId}/backgrounds/`

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
{project}/.claude/skills/vidpilot/  # SKILL (git clone, project-level)
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
└── install.mjs

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

Use WebSearch or custom scripts defined in `vidpilot.json` account's `research` field.
- `research.script`: custom fetch script (optional)
- `research.sources`: preferred websites for research
- `research.keywords`: default search keywords

For fixed topics (e.g., morning brief, closing review), skip trend searching and go directly to Step 3 with the given topic. The rest of the pipeline is the same.

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
| dialogue | `dialogue.ts` | `dialogue` | `../../types` |
| slides | `slides.ts` | `slides`, `theme` | `../../types` |
| ranking | `ranking.ts` | `rankSlides`, `theme` | `../../types` |
| code | `code.ts` | `codeSteps`, `theme` | `../../types` |
| narration | `narration.ts` | `segments`, `theme` | `../../types` |

**Character names come from vidpilot.json** (not hardcoded in data files).

**Narration image references**: When generating narration scripts with images, the `segment.image` field should reference filenames that the user has placed in `accounts/{accountId}/images/`. Run `setup-accounts.mjs` after adding images to sync them to `engine/public/`.

---

#### 4.0: Universal Script Writing Principles (ALL FORMATS MUST FOLLOW)

These rules apply to EVERY format. Violating them produces boring, low-engagement content.

**Rule 1: Golden 3-Second Hook (黄金3秒)**

The first line MUST stop the scroll. Use one of these proven hook patterns:

| Hook Type | Template | Example |
|-----------|----------|---------|
| Shock value | "[Shocking fact/number]" | "英伟达一天蒸发1500亿美元" |
| Controversy | "Everyone says X. That's wrong." | "都说程序员要被AI替代，但真相是..." |
| Mystery | "Did you know...?" | "你知道Meta为什么背叛英伟达吗？" |
| Direct callout | "If you're [audience], stop!" | "搞AI的注意了，这条消息跟你有关" |
| FOMO | "Only 1% know this" | "99%的程序员不知道这个提效神器" |
| Cost/stakes | "This mistake cost $X" | "这个决定让扎克伯格砸了1350亿" |
| Before/after | "From X to Y" | "从日薪500到月入10万，他只做了一件事" |

**Rule 2: Information Density (大密度、信息点)**

- 30 seconds ~200 chars, 60 seconds ~400 chars
- ZERO filler words. Every sentence must deliver value or advance the story
- Cut all "大家好"/"今天我们来聊聊" style openings — dive straight into content
- Each line should either: deliver a fact, create tension, or trigger emotion

**Rule 3: Conversational Tone (口语化)**

- Write as if talking to a friend, NOT giving a lecture
- Use short sentences (10-20 chars per line ideal for TTS)
- Convert all numbers to Chinese (TTS handles Chinese better): "1350亿" → "一千三百五十亿"
- Use rhetorical questions to create engagement: "你猜怎么着？"
- Contractions and colloquialisms are GOOD: "不就是"/"搞毛"/"整活"

**Rule 4: Conflict + Reversal (冲突+反转)**

Every script needs at least ONE of these tension patterns:

| Pattern | Structure | Example |
|---------|-----------|---------|
| Setup → Reversal | Build expectation, then flip | "芯片强5倍 → 股价反而暴跌" |
| Problem → Escalate → Twist | Stack problems, surprise exit | "被裁员 → 找不到工作 → 反而年入百万" |
| Common belief → Debunk | Challenge what everyone thinks | "都说要学Python → 其实学Prompt更值钱" |
| Comparison → Unexpected winner | Pit two things, surprise result | "GPT-5 vs Claude 4 → 赢的竟然是..." |

**Rule 5: Emotional Arc (情绪曲线)**

Script must NOT be flat. Map emotions across the timeline:

```
Hook(shock/curiosity) → Build(interest) → Peak(wow/outrage) → Resolve(insight/laugh)
```

Every 3-4 lines should shift the emotional register. Use expressions and listener reactions to visually reinforce the emotion.

**Rule 6: End Strong, No Filler**

- Last line must be memorable: a punchline, a thought-provoking question, or a surprising conclusion
- NEVER end with "关注我"/"点赞收藏"/"下期再见" — these kill rewatch rates
- Leave the audience thinking or laughing

---

#### 4A: Dialogue Script

**Format specs:**
- 60-90s, 14-18 rounds, 250-400 chars total
- Per line: 8-25 chars, duration = chars x 7 (frames), min 48, max 200
- Expressions: `default` `smile` `laugh` `smug` `shocked` `angry` `cry` `speechless` `confused` `contempt` `shy` `excited` `despair` `evil`

**Dialogue structure — "Comedian + Straight Man" (捧哏+逗哏):**

```
Act 1: Hook (lines 1-3)     — Left drops a bomb, Right reacts with key info
Act 2: Escalate (lines 4-8) — Conflict deepens, each line raises stakes
Act 3: Twist (lines 9-13)   — Unexpected angle, data surprises, "wait what?"
Act 4: Punchline (lines 14-16) — Deliver insight with humor, memorable ending
```

**Character dynamics (CRITICAL for engagement):**

| Role | Left (小李/提问者) | Right (老王/回答者) |
|------|-------------------|-------------------|
| Personality | Curious, anxious, reactive | Calm, insightful, dry humor |
| Function | Asks what audience is thinking | Delivers facts with attitude |
| Tone | "啊？真的假的？" "完蛋了！" | "你先别慌" "这有什么好慌的" |
| Expression | shocked, confused, cry, excited | smug, laugh, default, evil |

**Writing tricks for dialogue:**
- Left's questions should mirror what the audience would ask ("那我们是不是要失业了？")
- Right's answers must be concise facts + attitude, NOT lectures
- Create "ping-pong rhythm": short question → medium answer → short reaction → longer explanation
- Use listenerExpression to show the OTHER character's real-time reaction (adds comedy)
- Include at least 2 "escalation moments" where Left is increasingly shocked/confused
- Right should occasionally tease Left for comedy ("你这数学是体育老师教的吧")

**Anti-patterns (NEVER do these):**
- Both characters being calm and informative (boring)
- Left asking generic questions without emotion ("那后来呢？")
- Right giving textbook answers without personality ("根据数据显示...")
- Lines longer than 25 chars (TTS sounds unnatural)
- No conflict or surprise in the entire script

```typescript
import { DialogueLine } from "../../types";
export const dialogue: DialogueLine[] = [
  { speaker: "left", text: "...", duration: 120, expression: "excited", listenerExpression: "smile" },
];
```

#### 4B: Slides Script

**Format specs:**
- Layouts: `cover` `content` `data` `quote` `split` `end`
- Themes: `"dark"` `"tech"` `"warm"`
- 30-80 chars narration per slide, 6-10 slides

**Slide structure:**
```
Slide 1 (cover):  Hook — one shocking stat or provocative question
Slide 2-3 (content/data): Core facts — data-driven, each slide ONE key point
Slide 4-5 (data/split): Comparison — before/after, us/them, old/new
Slide 6-7 (content/quote): Insight — "what this really means"
Slide 8 (end): Punchline — memorable takeaway, NOT a generic summary
```

**Narration style:** Confident narrator voice, each slide's narration is self-contained (makes sense even without seeing previous slides). Use numbers and concrete comparisons instead of vague adjectives.

#### 4C: Ranking Script

**Format specs:**
- 5-8 items per slide, 1-3 slides
- Values must have real data sources

**Ranking structure:**
```
Opening narration: Set the frame — "Top N [things] that [surprising claim]"
Items: Countdown order (N to 1) to build anticipation
#1 reveal: Should be genuinely surprising or counterintuitive
Closing: One-line insight about what this ranking tells us
```

**Writing tricks:** Make #1 unexpected. If the audience can guess #1, the ranking is boring. Each item needs a one-line "why" that's memorable ("beats GPT-4 at half the cost").

#### 4D: Code Demo Script

**Format specs:**
- 3-6 steps, 5-20 lines of code each
- Code must be real and runnable

**Code demo structure:**
```
Step 1: "Here's the problem" — show the pain point in 1-2 sentences
Step 2: "Watch this" — show the simplest possible solution
Step 3-4: "But wait" — add real-world complexity, show the elegant fix
Step 5: "Result" — show it working, explain what just happened
```

**Narration style:** Tutorial tone but NOT boring. Start with "why you'd care" not "let me explain the syntax." Keep narrations under 30 chars — let the code speak.

#### 4E: Narration Script

**Format specs:**
- 4-8 segments, text <= 30 chars
- Effects: `kenburns` `fadeIn` `zoomIn`
- `image` field is optional: references filename in `accounts/{accountId}/images/`
- Without images, narration renders with text-only animated backgrounds (still looks good)
- Do NOT add a closing/follow segment (e.g., "关注XXX" or "点赞收藏"). End with the last content segment.

**Narration structure:**
```
Seg 1: Hook — dramatic statement or question (text shown as title card)
Seg 2-3: Setup — context and background, build the story
Seg 4-5: Climax — key revelation, data bomb, or turning point
Seg 6-7: Impact — what this means for the audience
Seg 8: Takeaway — memorable one-liner conclusion
```

**Writing tricks:** Each segment narration should work like a "chapter title" — short, punchy, visual. The voiceover does the heavy lifting. Use `kenburns` for photos, `zoomIn` for dramatic reveals, `fadeIn` for transitions.

#### 4F: Article

- 800-2000 chars, 3-6 sections. Save to `/tmp/vidpilot_article.txt`.
- Structure: Hook paragraph → 3-4 body sections with subheadings → Takeaway
- Each section should be independently interesting (readers skim)

---

### Step 5: Review + Fact Check

GitHub is the primary verification source. Check each claim per format guidelines.

---

### Step 6: Generate Audio + Render Video

Before rendering, sync assets from project to skill engine:

```
node {skillDir}/scripts/setup-accounts.mjs {projectDir}
```

Then generate audio and render. The `{skillDir}` is the skill's install location (e.g., `{projectDir}/.claude/skills/vidpilot`).

**macOS/Linux:**
```
cd {skillDir}
source .venv/bin/activate
VIDPILOT_PROJECT={projectDir} ACCOUNT={accountId} python scripts/generate-audio-{format}.py
cd engine
VIDPILOT_PROJECT={projectDir} npx remotion render {accountId}-{format} ../out/{accountId}-{format}.mp4 --codec h264
```

**Windows (PowerShell):**
```
cd {skillDir}
.venv\Scripts\activate
$env:VIDPILOT_PROJECT="{projectDir}"; $env:ACCOUNT="{accountId}"; python scripts/generate-audio-{format}.py
cd engine
$env:VIDPILOT_PROJECT="{projectDir}"; npx remotion render {accountId}-{format} ../out/{accountId}-{format}.mp4 --codec h264
```

**Merge audio + video (cross-platform):**
```
ffmpeg -y -i {skillDir}/out/{accountId}-{format}.mp4 -i {skillDir}/out/{audioFile} -filter_complex "[0:a][1:a]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[aout]" -map 0:v:0 -map "[aout]" -c:v copy -c:a aac -b:a 128k -shortest {skillDir}/out/{accountId}-{format}-final.mp4
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

Generate 3 title candidates using these proven patterns:

| Pattern | Template | Example |
|---------|----------|---------|
| Number + shock | "[数字]+[反直觉结论]" | "1500亿蒸发，英伟达慌了" |
| Question hook | "[悬念问题]？" | "Meta为什么背叛英伟达？" |
| Conflict frame | "[A]vs[B]，[意外结果]" | "TPU叫板CUDA，老黄坐不住了" |
| FOMO/exclusive | "[人群]必看/不知道就亏了" | "搞AI的注意了，这消息改变格局" |

Title rules:
- 15-20 chars, hook in first 5 chars
- Must contain: a number, a conflict, OR a question
- NO generic words like "分享"/"解读"/"盘点"
- Test: if the title works without seeing the video, it's good

3-5 hashtags (mix broad + niche). 80-120 char description (expand on the hook, add 1-2 key facts).

---

### Step 8: Archive

Each video gets its own subdirectory under the date folder, named by video title:

```
{projectDir}/output/{accountId}/YYYY-MM-DD/
  └── [video-title]/
      ├── [video-title].mp4
      ├── [video-title]_cover.png
      ├── [data-file].ts
      └── meta.txt          # title, tags, description
```

---

## Data Registry Update

After writing data files, regenerate registry by running:

```bash
node scripts/setup-accounts.mjs {projectDir}
```

Or manually update `engine/src/data/registry.ts`:

```typescript
import { dialogue as myDialogue } from "./{accountId}/dialogue";

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
