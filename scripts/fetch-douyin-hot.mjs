#!/usr/bin/env node
/**
 * 抓取抖音热榜中与财经/股市相关的话题，存入 topics 表。
 *
 * 用法：node scripts/fetch-douyin-hot.mjs
 * 输出：JSON { added, skipped, total }
 */

import { execSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { getDb } from "../server/db.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = join(__dirname, "..");
const DOUYIN_SCRIPT = join(process.env.HOME, ".claude/skills/douyin-hot/scripts/douyin-hot.mjs");

// 财经相关关键词
const FINANCE_KEYWORDS = [
  "A股", "股市", "股票", "基金", "涨停", "跌停", "暴涨", "暴跌",
  "牛市", "熊市", "散户", "韭菜", "套牢", "割肉", "梭哈",
  "茅台", "比亚迪", "宁德", "中石油",
  "芯片", "新能源", "光伏", "锂电", "白酒", "军工",
  "美联储", "降息", "降准", "关税", "贸易战",
  "房价", "楼市", "经济", "GDP", "通胀", "就业",
  "数字货币", "比特币", "币圈",
  "财经", "金融", "银行", "保险", "证券",
  "IPO", "退市", "ST", "爆雷", "财务造假",
  "北向资金", "外资", "融资", "融券",
];

function isFinanceRelated(title) {
  for (const kw of FINANCE_KEYWORDS) {
    if (title.includes(kw)) return true;
  }
  return false;
}

async function main() {
  // 调用 douyin-hot skill 获取热榜
  let output;
  try {
    output = execSync(`node "${DOUYIN_SCRIPT}" hot --board all --count 50 --output json`, {
      encoding: "utf-8",
      timeout: 30000,
    });
  } catch (e) {
    console.error("[error] 抖音热榜抓取失败:", e.message);
    process.exit(1);
  }

  let items;
  try {
    const data = JSON.parse(output);
    items = data.items || data.data || data;
    if (!Array.isArray(items)) items = [];
  } catch {
    console.error("[error] 解析抖音热榜数据失败");
    process.exit(1);
  }

  // 过滤财经相关
  const financeItems = items.filter(item => {
    const title = item.title || item.word || item.name || "";
    return isFinanceRelated(title);
  });

  const db = getDb();
  let added = 0;
  let skipped = 0;

  for (const item of financeItems) {
    const title = item.title || item.word || item.name || "";
    if (!title) continue;

    // 去重
    const exists = db.prepare("SELECT id FROM topics WHERE title = ?").get(title);
    if (exists) {
      skipped++;
      continue;
    }

    db.prepare(
      "INSERT INTO topics (title, url, source, score, video_type) VALUES (?, ?, 'douyin', ?, 'douyin_hot')"
    ).run(title, item.url || null, item.hot_value || item.hotValue || 0);
    added++;
  }

  console.log(JSON.stringify({ added, skipped, total: financeItems.length }));
}

main().catch(e => {
  console.error("[error]", e.message);
  process.exit(1);
});
