#!/usr/bin/env node
/**
 * Read config.json, create account directories, and generate registry.ts.
 * Run by install.sh or manually: node scripts/setup-accounts.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = join(__dirname, "..");
const ENGINE_DATA = join(PROJECT_DIR, "engine", "src", "data");
const ENGINE_PUBLIC = join(PROJECT_DIR, "engine", "public");

const configPath = join(PROJECT_DIR, "config.json");
if (!existsSync(configPath)) {
  console.log("[skip] config.json not found, using example account only.");
  process.exit(0);
}

const config = JSON.parse(readFileSync(configPath, "utf-8"));
const accounts = config.accounts || {};
const accountIds = Object.keys(accounts).filter((id) => id !== "example");

if (accountIds.length === 0) {
  console.log("[skip] No custom accounts in config.json.");
  process.exit(0);
}

// 1. Create data directories for each account
for (const id of accountIds) {
  const dataDir = join(ENGINE_DATA, id);
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
    console.log(`[ok] Created data directory: engine/src/data/${id}/`);
  }

  // Create assets directory per account for user to drop images
  const acct = accounts[id];
  const chars = acct.characters || {};
  const images = new Set();
  if (chars.left?.image) images.add(chars.left.image);
  if (chars.right?.image) images.add(chars.right.image);
  if (acct.backgroundImage) images.add(acct.backgroundImage);

  // Check if images exist in engine/public/
  for (const img of images) {
    const imgPath = join(ENGINE_PUBLIC, img);
    if (!existsSync(imgPath)) {
      console.log(`[warn] Missing image: engine/public/${img} (account: ${id})`);
    }
  }
}

// 2. Generate registry.ts
const imports = [];
const entries = [];

// Always include example
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

// Format -> { exportName, varPrefix suffix }
const FORMAT_MAP = {
  dialogue: { exports: "dialogue", varSuffix: "Dialogue" },
  slides: { exports: "slides, theme", varSuffix: "Slides", themeSuffix: "SlidesTheme" },
  ranking: { exports: "rankSlides, theme", varSuffix: "RankSlides", themeSuffix: "RankTheme" },
  code: { exports: "codeSteps, theme", varSuffix: "CodeSteps", themeSuffix: "CodeTheme" },
  narration: { exports: "segments, theme", varSuffix: "Segments", themeSuffix: "NarrationTheme" },
};

for (const id of accountIds) {
  const acct = accounts[id];
  const files = acct.files || {};
  const prefix = id.replace(/-/g, "_");
  const accountImports = [];
  const accountEntries = [];

  imports.push(`\n// ── ${id} ──`);

  for (const [format, meta] of Object.entries(FORMAT_MAP)) {
    const filename = files[format];
    if (!filename) continue;

    const dataFile = join(ENGINE_DATA, id, filename);
    if (!existsSync(dataFile)) {
      // Data file doesn't exist yet - skill will create it later
      continue;
    }

    const tsModule = filename.replace(/\.ts$/, "");

    if (format === "dialogue") {
      const varName = `${prefix}Dialogue`;
      imports.push(`import { dialogue as ${varName} } from "./${id}/${tsModule}";`);
      accountEntries.push(`    dialogue: { data: ${varName}, totalFrames: sumFrames(${varName}) }`);
    } else if (format === "slides") {
      const varData = `${prefix}Slides`;
      const varTheme = `${prefix}SlidesTheme`;
      imports.push(`import { slides as ${varData}, theme as ${varTheme} } from "./${id}/${tsModule}";`);
      accountEntries.push(`    slides: { data: ${varData}, totalFrames: sumFrames(${varData}), theme: ${varTheme} }`);
    } else if (format === "ranking") {
      const varData = `${prefix}RankSlides`;
      const varTheme = `${prefix}RankTheme`;
      imports.push(`import { rankSlides as ${varData}, theme as ${varTheme} } from "./${id}/${tsModule}";`);
      accountEntries.push(`    ranking: { data: ${varData}, totalFrames: sumFrames(${varData}), theme: ${varTheme} }`);
    } else if (format === "code") {
      const varData = `${prefix}CodeSteps`;
      const varTheme = `${prefix}CodeTheme`;
      imports.push(`import { codeSteps as ${varData}, theme as ${varTheme} } from "./${id}/${tsModule}";`);
      accountEntries.push(`    code: { data: ${varData}, totalFrames: sumFrames(${varData}), theme: ${varTheme} }`);
    } else if (format === "narration") {
      const varData = `${prefix}Segments`;
      const varTheme = `${prefix}NarrationTheme`;
      imports.push(`import { segments as ${varData}, theme as ${varTheme} } from "./${id}/${tsModule}";`);
      accountEntries.push(`    narration: { data: ${varData}, totalFrames: sumFrames(${varData}), theme: ${varTheme} }`);
    }
  }

  if (accountEntries.length > 0) {
    entries.push(`  ${id}: {\n${accountEntries.join(",\n")},\n  }`);
  }
}

const registryContent = `/**
 * Auto-generated by setup-accounts.mjs - DO NOT EDIT MANUALLY.
 * Re-run: node scripts/setup-accounts.mjs
 */

${imports.join("\n")}

interface FormatData {
  data: any[];
  totalFrames: number;
  theme?: string;
}

export interface AccountDataRegistry {
  dialogue?: FormatData;
  slides?: FormatData;
  ranking?: FormatData;
  code?: FormatData;
  narration?: FormatData;
}

function sumFrames(items: { duration: number }[]): number {
  return items.reduce((s, l) => s + l.duration, 0);
}

export const registry: Record<string, AccountDataRegistry> = {
${entries.join(",\n")},
};
`;

writeFileSync(join(ENGINE_DATA, "registry.ts"), registryContent);
console.log(`[ok] Generated registry.ts with accounts: example, ${accountIds.join(", ")}`);
