#!/usr/bin/env node
/**
 * 抓取 A股热点并存入数据库。
 * 供 cron 定时任务和 Dashboard "抓取热点"按钮调用。
 *
 * 用法：node scripts/fetch-and-save-topics.mjs
 */

import { execSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { getDb } from "../server/db.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = join(__dirname, "..");

// 调用 fetch-stock-hot.mjs 获取候选话题
const output = execSync("node scripts/fetch-stock-hot.mjs", {
  encoding: "utf-8",
  cwd: PROJECT_DIR,
  timeout: 30000,
});

const data = JSON.parse(output);
const db = getDb();

let added = 0;
let skipped = 0;

for (const c of data.candidates) {
  // 按标题去重
  const exists = db.prepare("SELECT id FROM topics WHERE title = ?").get(c.title);
  if (exists) {
    skipped++;
    continue;
  }

  db.prepare(
    "INSERT INTO topics (title, url, source, score) VALUES (?, ?, ?, ?)"
  ).run(c.title, c.url || null, c.source || "sina", c.score || 0);
  added++;
}

console.log(JSON.stringify({ added, skipped, total: data.candidates.length }));
