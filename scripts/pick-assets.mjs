#!/usr/bin/env node
/**
 * 从固定素材库随机选取背景图，复制到 public/bg-today.png
 *
 * 用法：
 *   node scripts/pick-assets.mjs              # 随机选一张背景
 *   node scripts/pick-assets.mjs --bg 直播间   # 指定背景
 *   node scripts/pick-assets.mjs --list        # 列出可用素材
 */

import { readdirSync, copyFileSync, mkdirSync } from "fs";
import { join, dirname, extname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ASSETS_DIR = join(ROOT, "..", "a股", "素材");
const BG_DIR = join(ASSETS_DIR, "背景");
const PUBLIC_DIR = join(ROOT, "public");

function listImages(dir) {
  try {
    return readdirSync(dir).filter((f) =>
      [".png", ".jpg", ".jpeg", ".webp"].includes(extname(f).toLowerCase())
    );
  } catch {
    return [];
  }
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const args = process.argv.slice(2);

if (args.includes("--list")) {
  const bgs = listImages(BG_DIR);
  console.log(`背景素材 (${bgs.length} 张):`);
  bgs.forEach((f) => console.log(`  ${f}`));
  process.exit(0);
}

mkdirSync(PUBLIC_DIR, { recursive: true });

// 选背景
const bgIdx = args.indexOf("--bg");
const bgs = listImages(BG_DIR);

if (bgs.length === 0) {
  console.error("[error] 没有找到背景素材，请先运行 node scripts/generate-bg-canvas.mjs");
  process.exit(1);
}

let bgFile;
if (bgIdx >= 0 && args[bgIdx + 1]) {
  const name = args[bgIdx + 1];
  bgFile = bgs.find((f) => f.includes(name));
  if (!bgFile) {
    console.error(`[error] 找不到包含 "${name}" 的背景，可用: ${bgs.join(", ")}`);
    process.exit(1);
  }
} else {
  bgFile = pickRandom(bgs);
}

const bgSrc = join(BG_DIR, bgFile);
const bgDst = join(PUBLIC_DIR, "bg-today.png");
copyFileSync(bgSrc, bgDst);
console.log(`[bg] ${bgFile} -> public/bg-today.png`);
