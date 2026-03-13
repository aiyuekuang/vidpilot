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
> ├── images/           # 用户自有素材图片（产品图、实拍图等，可选）
> ├── text/             # 知识库文档（产品资料、行业术语等，可选）
> ├── video/            # 用户自有视频素材（产品视频等，可选）
> └── music/            # BGM 音乐文件（可选）
> ```
>
> - `output/{accountId}/images/` — per-video images (narration format, generated/fetched assets)
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
> | narration | Optional per-segment images | `output/{accountId}/images/` (add before each video) |
>
> **How it works:**
> 1. Put character images in `accounts/{accountId}/characters/` (one-time setup)
> 2. Tell me "make a video" and I'll find hot topics, write scripts, generate audio, and render video
> 3. For narration videos, images are fetched/placed in `output/{accountId}/images/` before rendering
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
   - `output/{accountId}/images/`
   - `output/{accountId}/`
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
> - Images are fetched/placed in `output/{accountId}/images/` before generating narration videos
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
ls {CWD}/output/{accountId}/images/
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

1. Check if referenced images exist in `output/{accountId}/images/`
2. If missing, tell user:

> This narration script references images that aren't in `output/{accountId}/images/` yet:
> - `{filename1}` — for segment "{segment text}"
> - `{filename2}` — for segment "{segment text}"
>
> Options:
> 1. Add the images to `output/{accountId}/images/` and tell me when ready
> 2. I can generate the script without images (text-only narration, still looks good)
> 3. I can use AI to generate placeholder images (requires image generation tool)

### 0.6 Adding a New Account to Existing Project

If the user says "add a new account" or "create another channel":

1. Ask for account ID, display name, and content domain (same as 0.2.1)
2. Read existing `vidpilot.json`, add the new account to the `accounts` object
3. Run `setup-accounts.mjs` to create all subdirectories and regenerate registry
4. Tell user which subdirectories were created and what to put in each

### 0.7 Asset Naming Audit (MUST DO before every video)

Before proceeding to the pipeline, scan ALL asset files in `accounts/{accountId}/` and check if filenames are **descriptive Chinese names** (not hash strings, UUIDs, or generic names like `IMG_001.jpg`).

**Why:** Descriptive filenames enable smart image matching in Step 4 — the script generator uses filenames to pick the right image for each segment.

**Detection rules — a file needs renaming if:**
- Filename is a hash/UUID pattern: `/^[0-9a-f]{6,}/i` (e.g., `8001a3f2b4.jpg`)
- Filename is generic: `IMG_`, `DSC_`, `photo_`, `image_`, `screenshot_`, numbered sequences
- Filename has no Chinese characters and no semantic English description

**Audit procedure:**

```bash
ls {CWD}/accounts/{accountId}/images/
ls {CWD}/accounts/{accountId}/video/
# Also check text/, music/ if they exist
```

**If files need renaming:**

1. **Images**: Use Claude's visual recognition — read each image file directly, describe the content in Chinese, generate a semantic filename:
   - Format: `{中文描述}-{序号}.{ext}` (e.g., `等离子喷嘴工作中-01.jpg`, `达因笔测试.jpg`)
   - Keep names concise (2-8 Chinese chars + optional sequence number)
   - Avoid generic descriptions ("图片"/"照片"), be specific about content

2. **Videos**: Extract a keyframe with ffmpeg, then visually identify:
   ```bash
   ffmpeg -i {video_path} -vf "select=eq(n\,30)" -frames:v 1 -f image2 /tmp/vp-frame-{name}.jpg
   ```
   Read the extracted frame, describe the content, rename accordingly.

3. **Text files**: Read first few lines, name by content topic.

4. **Music files**: Name by mood/genre if identifiable from filename or metadata.

**After renaming, report to user:**

> 素材命名检查完成：
>
> | 原文件名 | 新文件名 | 内容描述 |
> |---------|---------|---------|
> | `8001a3f2.jpg` | `等离子喷嘴工作中-01.jpg` | 等离子喷嘴发出紫色光芒 |
> | ... | ... | ... |
>
> 已重命名 {N} 个文件。如需调整请告诉我。

**If ALL files already have descriptive names** -> skip and proceed.

**IMPORTANT:** If any image/video references in existing data files (`.ts`) use old filenames, update those references too.

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
├── accounts/                      # User-provided static assets (persistent)
│   └── {accountId}/
│       ├── characters/            # Character images (one-time, dialogue format)
│       ├── backgrounds/           # Background images (one-time, dialogue format)
│       ├── images/                # User's own images (product photos, etc.)
│       ├── text/                  # Knowledge base (product docs, terminology)
│       ├── video/                 # User's own video assets
│       └── music/                 # BGM music files
└── output/
    └── {accountId}/               # Per-account output & working files
        ├── images/                # Per-video images (narration format, fetched/generated)
        └── YYYY-MM-DD/            # Archived videos
```

**Asset subdirectory roles:**

| Directory | Used By | Frequency | Description |
|-----------|---------|-----------|-------------|
| `accounts/{id}/characters/` | dialogue | One-time setup | Left/right character PNGs, transparent bg recommended |
| `accounts/{id}/backgrounds/` | dialogue | One-time setup | 1080x1920 vertical background |
| `accounts/{id}/images/` | all | User-provided | Product photos, brand images (user's own, persistent) |
| `accounts/{id}/text/` | all | User-provided | Knowledge base docs, terminology, product descriptions |
| `accounts/{id}/video/` | all | User-provided | Product videos, reference clips |
| `accounts/{id}/music/` | all | User-provided | BGM music files |
| `output/{id}/images/` | narration | Per-video | Topic images fetched/generated for narration `segment.image` |
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
| Rankings, benchmarks, TOP-N | **ranking** | AI tool TOP5, benchmark scores |
| Code tutorial, API demo | **code** | Installation guide, code tricks |
| News report, events, product launch, data story | **narration** | 重磅发布、政策影响、行业事件 |
| Quick explainer, data comparison, how-to | **slides** | 工资对比、工具评测、技巧总结 |
| Controversy, humor, emotional banter | **dialogue** | AI drama, industry gossip |
| Deep tutorial, detailed guide | **article** | Full tutorial, deep comparison |

**Priority**: ranking > code > narration > slides > dialogue > article

> narration 是图文主格式，凡有"事件感"（谁做了什么、发生了什么）的话题优先选 narration。
> Only select formats allowed by the account's `formats` config.

> Only select formats allowed by the account's `formats` config.

---

### Step 3: Deep Research

WebSearch for core data, hot discussions, different viewpoints on the topic.

---

### Step 3.5: Knowledge Base Reference (知识库参考)

生成脚本前，**必须**检查并加载当前账号的知识库，确保脚本中的产品/服务描述准确专业。

**加载知识库：**

```bash
ls {CWD}/accounts/{accountId}/text/
```

如果 `text/` 目录存在且有文件，读取所有文档：

```bash
# 读取所有知识库文件
cat {CWD}/accounts/{accountId}/text/*.md
cat {CWD}/accounts/{accountId}/text/*.txt
```

**知识库内容类型：**

| 文件类型 | 典型内容 | 用途 |
|---------|---------|------|
| 产品介绍 | 核心产品名称、型号、功能、参数 | 脚本中提到产品时必须准确 |
| 服务说明 | 服务流程、解决方案、应用场景 | 确保场景描述真实可信 |
| 行业术语 | 专业名词、缩写、标准解释 | 避免用错术语，保持专业性 |
| 品牌规范 | 品牌话术、禁用词、宣传口径 | 遵守品牌合规要求 |
| 客户案例 | 真实案例、数据、客户反馈 | 增强内容可信度和说服力 |
| FAQ | 常见问题与标准回答 | 回应用户可能的疑问 |

**使用原则：**

1. **准确优先**：知识库中的产品名称、参数、数据优先于网上搜索结果
2. **自然融入**：不要生硬堆砌产品信息，要结合话题自然引出
3. **不过度营销**：遵守 vidpilot.json 中 `style.taboos` 的禁忌规则
4. **场景化表达**：用知识库中的真实案例/场景替代空泛描述
5. **术语一致**：全脚本使用统一的专业术语，不混用

**示例 — plasmalab 账号：**

```
知识库: text/产品手册.md 中提到 "PlasmaLab 等离子体处理指示卡，型号 PL-100"
话题: "等离子清洗效果怎么检测"

✗ 错误: "用一种卡片就能检测" （模糊、不专业）
✓ 正确: "PlasmaLab 等离子体处理指示卡，往上面一放，颜色变了就知道处理到位没" （准确+口语化）
```

**如果 text/ 目录为空或不存在** → 跳过此步，仅依赖 Step 3 的网络调研。

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

**Narration image references**: When generating narration scripts with images, the `segment.image` field should reference filenames in `output/{accountId}/images/` or `accounts/{accountId}/images/`. Use `fetch-images.mjs --account {accountId}` to fetch images, or place them manually. Run `setup-accounts.mjs` after to sync them to `engine/public/`.

**Smart Image Matching (narration + slides 格式):**

生成脚本时，根据图片的**描述性文件名**自动匹配最合适的图片插入每个 segment。

1. **列出可用图片**：扫描两个来源的图片：
   - `accounts/{accountId}/images/` — 用户自有素材（产品图、实拍图等）
   - `output/{accountId}/images/` — 每期获取的主题图片
   ```bash
   ls {CWD}/accounts/{accountId}/images/
   ls {CWD}/output/{accountId}/images/
   ```

2. **建立图片语义索引**：从文件名提取关键词（这就是 Step 0.7 命名审计的价值）
   ```
   等离子喷嘴工作中-01.jpg  → 关键词: 等离子, 喷嘴, 工作
   达因笔测试.jpg           → 关键词: 达因笔, 测试
   contact-angle-test.jpg   → 关键词: 接触角, 测试
   产品全家福.png           → 关键词: 产品, 全家福
   ```

3. **匹配规则**（按优先级）：
   - **精确匹配**: segment 文案中包含图片文件名的核心关键词 → 直接使用
   - **语义匹配**: segment 话题与图片描述有语义关联 → 选最相关的
   - **补充获取**: 无匹配图片且话题需要配图 → 用 `fetch-images.mjs` 抓取
   - **留空**: 该 segment 不需要配图（纯文字效果也很好）→ 不设 image 字段

4. **分配原则**：
   - 每张图只用一次（避免重复）
   - 优先把最有视觉冲击力的图分配给 Hook 和 Climax 段
   - 用户自有素材（accounts/）优先于抓取素材（output/）
   - 如果可用图片不足，部分 segment 可以不配图

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

图文解说是主打格式，重点优化完播率和收藏率。算法看：完播率 > 点赞 > 评论 > 转发。

**Format specs:**
- **5-7 segments**（超过7个掉播率明显上升）
- text <= 30 chars（屏幕显示文字，配合画面）
- narration 旁白每段 <= 50 字，每句推进信息，无废话
- Effects: `kenburns`（照片首选）`zoomIn`（强调/震惊）`fadeIn`（平缓过渡）
- `image` field 可选：引用 `output/{accountId}/images/` 中的文件名
- 没有图片时，纯文字动态背景渲染，依然可用
- 结尾**不加**"关注XXX/点赞收藏"等引导段，内容本身就是最好的留存

---

**HOOK 框架（前3秒决定80%留存率）**

第一段必须是强钩子，选一种：

| 类型 | 公式 | 示例 |
|------|------|------|
| 悬念型 | "XX竟然/居然..." | "这个模型，让OpenAI慌了" |
| 数据炸弹 | 颠覆认知的数字 | "用了3天，省了30万" |
| 好奇缺口 | "你不知道的XX" | "大家都错了，真相是..." |
| 痛点直击 | 说出目标用户的痛 | "程序员最怕的事，发生了" |
| 反常识 | 打破固有认知 | "越努力，越穷？有人验证了" |

---

**黄金结构：H-T-C-R（Hook→Tension→Climax→Resolution）**

```
Seg 1 [Hook]      强钩子 — 悬念/数据炸弹/反常识，前3秒留住人
Seg 2 [Tension]   放大痛点或背景张力，"为什么你应该在意这件事"
Seg 3-4 [Content] 核心内容逐步展开，每段埋一个小钩（让人看下一段）
Seg 5 [Climax]    最大信息点 / 数据炸弹 / 转折，用 zoomIn 强调
Seg 6 [Resolution]结论或行动意义，"所以这意味着什么"
Seg 7 [槽点/留白] 埋一个引发评论的问题或争议，让人想发表意见（可选）
```

**节奏规则：每2-3段更新一次注意力**，用数字、转折词（"但是"、"没想到"、"关键来了"）或悬念续接（"而这只是开始..."）拉住观众。

---

**旁白写作规则：**

- 每句话都要推进，没有铺垫废话
- 开头禁用："今天给大家介绍..." / "首先我们来看..."
- 用短句，不超过15字/句，语速快的地方用2-5字短句
- 数字要具体：不说"很多"，说"87%"；不说"很快"，说"3天"
- 在第2-3段嵌入**留存钩**："最关键的在后面" / "但你可能不知道的是..."
- 槽点设置：留一个有争议或开放性的结论，引发"我有不同看法"型评论

**Effect 选择逻辑：**
- `kenburns` → 普通照片、人物、场景（给静图加动感）
- `zoomIn` → 数据出现、关键转折、震惊时刻
- `fadeIn` → 内容切换、段落过渡、结尾收束

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

### Step 6.5: Video Quality Spot-Check (渲染后质量抽查)

渲染完成后，**必须**从最终视频中抽取关键帧进行视觉检查，确认无明显问题后再进入归档流程。

**抽帧策略：**

从视频中均匀抽取 5 帧（开头、1/4、1/2、3/4、结尾），覆盖整个时间线：

```bash
# 获取视频总时长
duration=$(ffprobe -v error -show_entries format=duration -of csv=p=0 {video_path})

# 抽取 5 个关键帧（开头3s、25%、50%、75%、结尾前3s）
ffmpeg -ss 3 -i {video_path} -frames:v 1 -f image2 /tmp/vp-qc-01.jpg
ffmpeg -ss $(echo "$duration * 0.25" | bc) -i {video_path} -frames:v 1 -f image2 /tmp/vp-qc-02.jpg
ffmpeg -ss $(echo "$duration * 0.50" | bc) -i {video_path} -frames:v 1 -f image2 /tmp/vp-qc-03.jpg
ffmpeg -ss $(echo "$duration * 0.75" | bc) -i {video_path} -frames:v 1 -f image2 /tmp/vp-qc-04.jpg
ffmpeg -ss $(echo "$duration - 3" | bc) -i {video_path} -frames:v 1 -f image2 /tmp/vp-qc-05.jpg
```

**检查清单（逐帧视觉检查）：**

| 检查项 | 通过标准 | 常见问题 |
|--------|---------|---------|
| 文字渲染 | 文字清晰可读，无溢出/截断 | 文案超长导致文字出框 |
| 图片显示 | 图片完整显示，无拉伸/变形 | 图片比例不对，黑边 |
| 角色形象 | 角色正常显示，表情匹配 | 透明背景未处理，角色缺失 |
| 背景 | 背景完整覆盖画面 | 背景图尺寸不匹配 |
| 布局 | 元素不重叠，间距合理 | 多个元素堆叠在一起 |
| 动画/转场 | 帧间有变化，不是静止画面 | 渲染卡住导致静帧 |
| 整体观感 | 画面干净专业 | 调试信息残留、颜色异常 |

**读取帧图片进行视觉检查：**

用 Read 工具直接读取抽取的 jpg 文件，Claude 会自动进行视觉分析。逐帧检查上述清单。

**检查结果处理：**

- **全部通过** → 删除临时帧文件，输出 "质量检查通过 ✓"，继续 Step 7
- **发现问题** → 向用户报告：

> 视频质量检查发现以下问题：
>
> | 帧位置 | 问题 | 严重程度 |
> |--------|------|---------|
> | 25% (第15秒) | 文字超出画面边界 | 高 |
> | 50% (第30秒) | 图片显示为黑色 | 高 |
> | 75% (第45秒) | 角色表情与文案不匹配 | 低 |
>
> 建议：
> 1. [具体修复建议]
> 2. 修复后重新渲染
>
> 是否需要我修复并重新渲染？

**清理临时文件：**
```bash
rm -f /tmp/vp-qc-*.jpg
```

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

### Step 8: Generate Cover + Archive

**8.1 生成封面（必须）**

选定标题后，**必须**生成封面图再归档。封面用于发布时的视频封面。

```bash
cd {skillDir}
source .venv/bin/activate
python scripts/generate-thumbnail.py "{标题}" {projectDir}/output/{accountId}/YYYY-MM-DD/{video-title}/{video-title}_cover.png
```

**8.2 归档**

Each video gets its own subdirectory under the date folder, named by video title:

```
{projectDir}/output/{accountId}/YYYY-MM-DD/
  └── [video-title]/
      ├── [video-title].mp4
      ├── [video-title]_cover.png    ← 封面图（Step 8.1 生成）
      ├── [data-file].ts
      └── meta.txt          # title, tags, description
```

**8.3 发布（用户确认后执行）**

归档完成后询问用户是否发布。发布时**必须带封面**：

```bash
python scripts/publish-douyin.py \
  --video {video-path} \
  --title "{标题}" \
  --tags "{tag1},{tag2},..." \
  --thumbnail {cover-path}
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
- Static assets: `accounts/{id}/` in **project** directory (characters, backgrounds, images, text, video, music)
- Per-episode assets: `output/{id}/images/` in **project** directory
- Output: `output/{name}/` in **project** directory
- Never mix data between accounts
