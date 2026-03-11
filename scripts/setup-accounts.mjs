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
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "fs";
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

// Create directories for each account
for (const id of accountIds) {
  const acct = accounts[id];

  // Assets: {project}/accounts/{id}/ — user drops images here
  const assetsDir = join(PROJECT_DIR, "accounts", id);
  if (!existsSync(assetsDir)) {
    mkdirSync(assetsDir, { recursive: true });
    console.log(`[ok] Created: accounts/${id}/`);
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

  // Sync images: {project}/accounts/{id}/ → {skill}/engine/public/
  const imageFiles = new Set();
  if (acct.characters?.left?.image) imageFiles.add(acct.characters.left.image);
  if (acct.characters?.right?.image) imageFiles.add(acct.characters.right.image);
  if (acct.backgroundImage) imageFiles.add(acct.backgroundImage);

  for (const img of imageFiles) {
    const src = join(assetsDir, img);
    const dest = join(ENGINE_PUBLIC, img);
    if (existsSync(src) && !existsSync(dest)) {
      copyFileSync(src, dest);
      console.log(`[ok] Synced: accounts/${id}/${img} → engine/public/`);
    } else if (!existsSync(src) && !existsSync(dest)) {
      console.log(`[warn] Missing: accounts/${id}/${img} — add your image here`);
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
