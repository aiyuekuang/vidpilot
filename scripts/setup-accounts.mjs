#!/usr/bin/env node
/**
 * Read vidpilot.json from project directory, create account directories,
 * sync assets, and generate registry.ts in the skill engine.
 *
 * Config schema v1:
 *   - accounts is an array: [{ id, name, ... }]
 *   - outputDir derived from account ID: output/{id}/
 *   - filenames use convention: {format}.ts
 *   - character images in accounts/{id}/characters/
 *   - background images in accounts/{id}/backgrounds/
 *   - per-episode images in output/{id}/images/ (generated assets)
 *
 * Usage:
 *   node scripts/setup-accounts.mjs /path/to/project
 *   # or with VIDPILOT_PROJECT env var
 *   VIDPILOT_PROJECT=/path/to/project node scripts/setup-accounts.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = join(__dirname, "..");
const ENGINE_DATA = join(SKILL_DIR, "engine", "src", "data");
const ENGINE_PUBLIC = join(SKILL_DIR, "engine", "public");

// Resolve project directory
const PROJECT_DIR = process.argv[2]
  || process.env.VIDPILOT_PROJECT
  || process.cwd();

const configPath = join(PROJECT_DIR, "vidpilot.json");
if (!existsSync(configPath)) {
  console.log(`[skip] vidpilot.json not found in ${PROJECT_DIR}`);
  console.log("  Copy config.example.json from the skill repo to your project as vidpilot.json");
  process.exit(0);
}

const config = JSON.parse(readFileSync(configPath, "utf-8"));
const accountList = config.accounts || [];
const accounts = accountList.filter((a) => a.id !== "example");

if (accounts.length === 0) {
  console.log("[skip] No custom accounts in vidpilot.json.");
  process.exit(0);
}

// Asset subdirectories under accounts/{id}/ (user-provided static assets only)
const ASSET_SUBDIRS = ["characters", "backgrounds"];

// Convention-based format → filename
const FORMAT_FILENAME = (format) => `${format}.ts`;

// Create directories for each account
for (const acct of accounts) {
  const id = acct.id;

  // Assets: {project}/accounts/{id}/ with subdirectories
  const assetsDir = join(PROJECT_DIR, "accounts", id);
  for (const sub of ASSET_SUBDIRS) {
    const subDir = join(assetsDir, sub);
    if (!existsSync(subDir)) {
      mkdirSync(subDir, { recursive: true });
      console.log(`[ok] Created: accounts/${id}/${sub}/`);
    }
  }

  // Output: {project}/output/{id}/
  const outputDir = join(PROJECT_DIR, "output", id);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
    console.log(`[ok] Created: output/${id}/`);
  }

  // Data: {skill}/engine/src/data/{id}/
  const dataDir = join(ENGINE_DATA, id);
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
    console.log(`[ok] Created: engine/src/data/${id}/ (in skill)`);
  }

  // Sync images from account subdirectories → {skill}/engine/public/
  const syncMap = [];
  if (acct.characters?.left?.image) {
    syncMap.push({ filename: acct.characters.left.image, subdir: "characters", purpose: "left character" });
  }
  if (acct.characters?.right?.image) {
    syncMap.push({ filename: acct.characters.right.image, subdir: "characters", purpose: "right character" });
  }
  if (acct.background) {
    syncMap.push({ filename: acct.background, subdir: "backgrounds", purpose: "background" });
  }

  for (const { filename, subdir, purpose } of syncMap) {
    const src = join(assetsDir, subdir, filename);
    const dest = join(ENGINE_PUBLIC, filename);
    if (existsSync(src)) {
      copyFileSync(src, dest);
      console.log(`[ok] Synced: accounts/${id}/${subdir}/${filename} → engine/public/`);
    } else if (!existsSync(dest)) {
      console.log(`[warn] Missing ${purpose}: accounts/${id}/${subdir}/${filename}`);
    }
  }

  // Sync user-provided images from accounts/{id}/images/ (product photos, etc.)
  const userImagesDir = join(assetsDir, "images");
  if (existsSync(userImagesDir)) {
    const userImageFiles = readdirSync(userImagesDir).filter(f =>
      /\.(png|jpe?g|webp|gif|svg)$/i.test(f)
    );
    for (const img of userImageFiles) {
      copyFileSync(join(userImagesDir, img), join(ENGINE_PUBLIC, img));
    }
    if (userImageFiles.length > 0) {
      console.log(`[ok] Synced: accounts/${id}/images/ (${userImageFiles.length} files) → engine/public/`);
    }
  }

  // Sync per-episode images from output/{id}/images/ (generated/fetched assets)
  const imagesDir = join(PROJECT_DIR, "output", id, "images");
  if (existsSync(imagesDir)) {
    const imageFiles = readdirSync(imagesDir).filter(f =>
      /\.(png|jpe?g|webp|gif|svg)$/i.test(f)
    );
    for (const img of imageFiles) {
      const src = join(imagesDir, img);
      const dest = join(ENGINE_PUBLIC, img);
      copyFileSync(src, dest);
    }
    if (imageFiles.length > 0) {
      console.log(`[ok] Synced: output/${id}/images/ (${imageFiles.length} files) → engine/public/`);
    }
  }

  // Sync video files from accounts/{id}/video/ → engine/public/
  const videoDir = join(assetsDir, "video");
  if (existsSync(videoDir)) {
    const videoFiles = readdirSync(videoDir).filter(f =>
      /\.(mp4|mov|webm)$/i.test(f)
    );
    for (const v of videoFiles) {
      copyFileSync(join(videoDir, v), join(ENGINE_PUBLIC, v));
    }
    if (videoFiles.length > 0) {
      console.log(`[ok] Synced: accounts/${id}/video/ (${videoFiles.length} files) → engine/public/`);
    }
  }

  // Sync music files from music/ subdirectory (for BGM)
  const musicDir = join(assetsDir, "music");
  if (existsSync(musicDir)) {
    const musicDest = join(ENGINE_PUBLIC, "music");
    if (!existsSync(musicDest)) mkdirSync(musicDest, { recursive: true });
    const musicFiles = readdirSync(musicDir).filter(f =>
      /\.(wav|mp3|ogg|m4a|aac)$/i.test(f)
    );
    for (const m of musicFiles) {
      copyFileSync(join(musicDir, m), join(musicDest, m));
    }
    if (musicFiles.length > 0) {
      console.log(`[ok] Synced: accounts/${id}/music/ (${musicFiles.length} files) → engine/public/music/`);
    }
  }
}

// ── Generate registry.ts ──

const imports = [];
const entries = [];

// Example account (always included)
imports.push(`// ── example ──`);
imports.push(`import { dialogue as exampleDialogue } from "./example/dialogue.example";`);
imports.push(`import { slides as exampleSlides, theme as exampleSlidesTheme } from "./example/slides.example";`);
imports.push(`import { rankSlides as exampleRankSlides, theme as exampleRankTheme } from "./example/ranking.example";`);
imports.push(`import { codeSteps as exampleCodeSteps, theme as exampleCodeTheme } from "./example/code.example";`);
imports.push(`import { segments as exampleSegments, theme as exampleNarrationTheme } from "./example/narration.example";`);

entries.push(`  example: {
    dialogue: { data: exampleDialogue, totalFrames: sumFrames(exampleDialogue) },
    slides: { data: exampleSlides, totalFrames: sumFrames(exampleSlides), theme: exampleSlidesTheme },
    ranking: { data: exampleRankSlides, totalFrames: sumFrames(exampleRankSlides), theme: exampleRankTheme },
    code: { data: exampleCodeSteps, totalFrames: sumFrames(exampleCodeSteps), theme: exampleCodeTheme },
    narration: { data: exampleSegments, totalFrames: sumFrames(exampleSegments), theme: exampleNarrationTheme },
  }`);

// Format metadata for registry generation
const formatMeta = {
  dialogue:  { imp: "dialogue",   var: "Dialogue" },
  slides:    { imp: "slides, theme", var: "Slides",     theme: "SlidesTheme" },
  ranking:   { imp: "rankSlides, theme", var: "RankSlides", theme: "RankTheme" },
  code:      { imp: "codeSteps, theme", var: "CodeSteps",  theme: "CodeTheme" },
  narration: { imp: "segments, theme", var: "Segments",   theme: "NarrationTheme" },
};

const accountIds = [];

for (const acct of accounts) {
  const id = acct.id;
  accountIds.push(id);
  const formats = acct.formats || [];
  const prefix = id.replace(/-/g, "_");
  const accountEntries = [];

  imports.push(`\n// ── ${id} ──`);

  for (const [format, meta] of Object.entries(formatMeta)) {
    if (!formats.includes(format)) continue;

    const filename = FORMAT_FILENAME(format);
    if (!existsSync(join(ENGINE_DATA, id, filename))) continue;

    const mod = filename.replace(/\.ts$/, "");
    const v = `${prefix}${meta.var}`;

    if (!meta.theme) {
      imports.push(`import { ${meta.imp} as ${v} } from "./${id}/${mod}";`);
      accountEntries.push(`    ${format}: { data: ${v}, totalFrames: sumFrames(${v}) }`);
    } else {
      const t = `${prefix}${meta.theme}`;
      imports.push(`import { ${meta.imp.split(", ")[0]} as ${v}, theme as ${t} } from "./${id}/${mod}";`);
      accountEntries.push(`    ${format}: { data: ${v}, totalFrames: sumFrames(${v}), theme: ${t} }`);
    }
  }

  if (accountEntries.length > 0) {
    entries.push(`  ${id}: {\n${accountEntries.join(",\n")},\n  }`);
  }
}

const content = `/**
 * Auto-generated by setup-accounts.mjs — DO NOT EDIT MANUALLY.
 * Re-run: node scripts/setup-accounts.mjs /path/to/project
 */

${imports.join("\n")}

interface FormatData { data: any[]; totalFrames: number; theme?: string; }
export interface AccountDataRegistry {
  dialogue?: FormatData; slides?: FormatData; ranking?: FormatData;
  code?: FormatData; narration?: FormatData;
}
function sumFrames(items: { duration: number }[]): number {
  return items.reduce((s, l) => s + l.duration, 0);
}

export const registry: Record<string, AccountDataRegistry> = {
${entries.join(",\n")},
};
`;

writeFileSync(join(ENGINE_DATA, "registry.ts"), content);
console.log(`[ok] Generated registry.ts: example, ${accountIds.join(", ")}`);

// ── Generate accounts-generated.ts (static, no fs dependency for Remotion) ──

const accountEntryList = [];
for (const acct of accounts) {
  const id = acct.id;
  const chars = acct.characters || {};
  const left = chars.left || {};
  const right = chars.right || {};
  const leftSize = left.size || [0, 0];
  const leftFace = left.face || [0, 0, 0];
  const rightSize = right.size || [0, 0];
  const rightFace = right.face || [0, 0, 0];

  accountEntryList.push(`  "${id}": {
    id: "${id}",
    name: "${acct.name || id}",
    outputDir: "output/${id}",
    leftCharacter: { name: "${left.name || ""}", image: "${left.image || ""}", imageWidth: ${leftSize[0]}, imageHeight: ${leftSize[1]}, faceCenter: { x: ${leftFace[0]}, y: ${leftFace[1]}, radius: ${leftFace[2]} } },
    rightCharacter: { name: "${right.name || ""}", image: "${right.image || ""}", imageWidth: ${rightSize[0]}, imageHeight: ${rightSize[1]}, faceCenter: { x: ${rightFace[0]}, y: ${rightFace[1]}, radius: ${rightFace[2]} } },
    backgroundImage: "${acct.background || ""}",
    bgm: "${acct.bgm || ""}",
    defaultTheme: "${acct.theme || "dark"}",
    voiceSeeds: { left: ${acct.tts?.left ?? 42}, right: ${acct.tts?.right ?? 2024}, narrator: ${acct.tts?.narrator ?? 2024} },
    formats: ${JSON.stringify(acct.formats || [])},
  }`);
}

const videoConf = config.video || { fps: 30, width: 1080, height: 1920 };
const accountsGenContent = `/**
 * Auto-generated by setup-accounts.mjs — DO NOT EDIT MANUALLY.
 * Static account config for Remotion (no fs dependency).
 */
import { AccountConfig } from "./types";

export const globalConfig = { fps: ${videoConf.fps}, width: ${videoConf.width}, height: ${videoConf.height} };

export const accounts: Record<string, AccountConfig> = {
${accountEntryList.join(",\n")},
};

export function getAccount(id: string): AccountConfig {
  const account = accounts[id];
  if (!account) {
    throw new Error(\`Unknown account: "\${id}". Available: \${Object.keys(accounts).join(", ")}\`);
  }
  return account;
}
`;

writeFileSync(join(SKILL_DIR, "engine", "src", "accounts.ts"), accountsGenContent);
console.log(`[ok] Generated accounts.ts (static, ${accountIds.length} accounts)`);
