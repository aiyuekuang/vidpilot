#!/usr/bin/env node
/**
 * Read vidpilot.json from project directory, create account directories,
 * sync assets, and generate registry.ts in the skill engine.
 *
 * Usage:
 *   node scripts/setup-accounts.mjs /path/to/project
 *   # or with VIDPILOT_PROJECT env var
 *   VIDPILOT_PROJECT=/path/to/project node scripts/setup-accounts.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, readdirSync } from "fs";
import { join, dirname, resolve } from "path";
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
const accounts = config.accounts || {};
const accountIds = Object.keys(accounts).filter((id) => id !== "example");

if (accountIds.length === 0) {
  console.log("[skip] No custom accounts in vidpilot.json.");
  process.exit(0);
}

function resolveDir(dir) {
  if (!dir) return null;
  if (dir.startsWith("~/")) return join(process.env.HOME || "", dir.slice(2));
  if (dir.startsWith("/")) return dir;
  return join(PROJECT_DIR, dir);
}

// Asset subdirectories under accounts/{id}/
const ASSET_SUBDIRS = ["characters", "backgrounds", "images"];

// Create directories for each account
for (const id of accountIds) {
  const acct = accounts[id];

  // Assets: {project}/accounts/{id}/ with subdirectories
  const assetsDir = join(PROJECT_DIR, "accounts", id);
  for (const sub of ASSET_SUBDIRS) {
    const subDir = join(assetsDir, sub);
    if (!existsSync(subDir)) {
      mkdirSync(subDir, { recursive: true });
      console.log(`[ok] Created: accounts/${id}/${sub}/`);
    }
  }

  // Output: {project}/output/{name}/ — archived videos
  const outputDir = resolveDir(acct.outputDir);
  if (outputDir && !existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
    console.log(`[ok] Created: ${acct.outputDir}`);
  }

  // Data: {skill}/engine/src/data/{id}/ — skill writes content here (Remotion needs this)
  const dataDir = join(ENGINE_DATA, id);
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
    console.log(`[ok] Created: engine/src/data/${id}/ (in skill)`);
  }

  // Sync images from account subdirectories → {skill}/engine/public/
  // characters/ → character images referenced by vidpilot.json
  // backgrounds/ → background images referenced by vidpilot.json
  // images/ → narration segment images (referenced in data files at runtime)

  // Collect required files and their source subdirectories
  const syncMap = []; // { filename, subdir, purpose }
  if (acct.characters?.left?.image) {
    syncMap.push({ filename: acct.characters.left.image, subdir: "characters", purpose: "left character" });
  }
  if (acct.characters?.right?.image) {
    syncMap.push({ filename: acct.characters.right.image, subdir: "characters", purpose: "right character" });
  }
  if (acct.backgroundImage) {
    syncMap.push({ filename: acct.backgroundImage, subdir: "backgrounds", purpose: "background" });
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

  // Sync all images from images/ subdirectory (for narration segments)
  const imagesDir = join(assetsDir, "images");
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
      console.log(`[ok] Synced: accounts/${id}/images/ (${imageFiles.length} files) → engine/public/`);
    }
  }
}

// Generate registry.ts
const imports = [];
const entries = [];

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

for (const id of accountIds) {
  const acct = accounts[id];
  const files = acct.files || {};
  const prefix = id.replace(/-/g, "_");
  const accountEntries = [];

  imports.push(`\n// ── ${id} ──`);

  const formatMap = {
    dialogue:  { imp: "dialogue",   var: "Dialogue" },
    slides:    { imp: "slides, theme", var: "Slides",     theme: "SlidesTheme" },
    ranking:   { imp: "rankSlides, theme", var: "RankSlides", theme: "RankTheme" },
    code:      { imp: "codeSteps, theme", var: "CodeSteps",  theme: "CodeTheme" },
    narration: { imp: "segments, theme", var: "Segments",   theme: "NarrationTheme" },
  };

  for (const [format, meta] of Object.entries(formatMap)) {
    const filename = files[format];
    if (!filename) continue;
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
