#!/usr/bin/env node
/**
 * Scan existing assets and import into database
 */
import { getDb, PROJECT_DIR } from "../server/db.mjs";
import { readdirSync, statSync } from "fs";
import { join, basename, extname } from "path";

const db = getDb();
const stmt = db.prepare(`
  INSERT OR REPLACE INTO assets (type, name, filename, filepath, file_size)
  VALUES (?, ?, ?, ?, ?)
`);

let count = 0;

// Scan backgrounds
const bgDir = join(PROJECT_DIR, "public");
for (const f of readdirSync(bgDir)) {
  if (f.startsWith("bg-") && extname(f) === ".png") {
    const fp = join(bgDir, f);
    const size = statSync(fp).size;
    const name = basename(f, ".png").replace("bg-", "");
    stmt.run("background", name, f, `public/${f}`, size);
    count++;
    console.log(`  bg: ${name} (${(size / 1024).toFixed(0)}KB)`);
  }
}

// Scan AI backgrounds
const aiBgDir = join(PROJECT_DIR, "a股", "素材", "背景");
try {
  for (const f of readdirSync(aiBgDir)) {
    if ([".png", ".jpg", ".webp"].includes(extname(f).toLowerCase())) {
      const fp = join(aiBgDir, f);
      const size = statSync(fp).size;
      const name = basename(f, extname(f));
      stmt.run("background", name, f, `a股/素材/背景/${f}`, size);
      count++;
      console.log(`  ai-bg: ${name} (${(size / 1024).toFixed(0)}KB)`);
    }
  }
} catch {}

// Scan characters
for (const f of readdirSync(bgDir)) {
  if (f.startsWith("char-") && extname(f) === ".png") {
    const fp = join(bgDir, f);
    const size = statSync(fp).size;
    const name = basename(f, ".png").replace("char-", "");
    stmt.run("character", name, f, `public/${f}`, size);
    count++;
    console.log(`  char: ${name} (${(size / 1024).toFixed(0)}KB)`);
  }
}

console.log(`\nImported ${count} assets.`);
