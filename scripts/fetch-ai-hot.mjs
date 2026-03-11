#!/usr/bin/env node
/**
 * 抓取 AI/科技 热点新闻，按热度排序，排除已发布话题。
 *
 * 数据源：
 *   1. 36kr 热榜
 *   2. IT之家热榜
 *   3. 抖音热榜（科技相关）
 *
 * 用法：
 *   node scripts/fetch-ai-hot.mjs                # 输出候选列表
 *   node scripts/fetch-ai-hot.mjs --pick          # 自动选最佳话题
 *   node scripts/fetch-ai-hot.mjs --check-today   # 仅检查今天是否已出内容
 *
 * 环境变量：
 *   VIDPILOT_PROJECT  项目目录（默认 CWD）
 *   ACCOUNT           账号 ID（默认 laodong）
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = process.env.VIDPILOT_PROJECT || path.join(__dirname, "..");
const ACCOUNT_ID = process.env.ACCOUNT || "laodong";

// === 适合做视频的关键词（命中越多分越高）===
const HOT_KEYWORDS = [
  // AI 核心
  "AI", "人工智能", "大模型", "GPT", "Claude", "Gemini", "DeepSeek",
  "ChatGPT", "Copilot", "Sora", "AGI", "OpenAI", "Anthropic", "Google",
  // AI 应用
  "AI编程", "AI写代码", "AI替代", "Cursor", "Trae", "Claude Code",
  "Midjourney", "Stable Diffusion", "AI绘画", "AI视频", "AI Agent",
  "豆包", "文心", "通义", "Kimi", "智谱", "DeepSeek",
  // 程序员相关
  "程序员", "开发者", "码农", "35岁", "裁员", "失业", "涨薪", "跳槽",
  "面试", "内卷", "加班", "996", "远程办公",
  // 技术热点
  "开源", "GitHub", "芯片", "算力", "云计算", "量子计算",
  "机器人", "自动驾驶", "具身智能",
  // 公司/产品
  "苹果", "微软", "谷歌", "Meta", "字节", "腾讯", "阿里", "华为",
  "特斯拉", "英伟达", "台积电", "小米",
  // 情绪词
  "颠覆", "暴增", "疯狂", "炸裂", "离谱", "震惊", "突破", "史上",
  "免费", "开源", "泄露", "封杀", "禁令",
];

// === 不适合的关键词 ===
const SKIP_KEYWORDS = [
  "融资", "估值", "IPO", "上市", "财报", "营收",
  "招聘", "HR", "简历",
  "广告", "推广", "优惠", "折扣",
];

function scoreTitle(title) {
  let score = 0;
  for (const kw of HOT_KEYWORDS) {
    if (title.includes(kw)) score += 3;
  }
  for (const kw of SKIP_KEYWORDS) {
    if (title.includes(kw)) score -= 10;
  }
  if (/\d+%/.test(title)) score += 2;
  if (/\d+倍|\d+x/i.test(title)) score += 2;
  if (/[！!？?]/.test(title)) score += 1;
  if (title.length < 8) score -= 2;
  if (title.length > 80) score -= 2;
  return score;
}

// ── 数据源 ──

async function fetchHotList(name) {
  // api.pearktrue.cn 聚合热榜（稳定）
  try {
    const res = await fetch(`https://api.pearktrue.cn/api/dailyhot/?title=${name}`, {
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();
    if (data.code !== 200) return [];
    return (data.data || []).map((item) => ({
      title: item.title || "",
      url: item.url || item.mobileUrl || "",
      source: name,
    }));
  } catch (e) {
    console.error(`[warn] ${name} hot list failed:`, e.message);
    return [];
  }
}

async function fetchDouyinHot() {
  try {
    const res = await fetch(
      "https://aweme.snssdk.com/aweme/v1/hot/search/list/?device_platform=webapp&aid=6383",
      {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(10000),
      }
    );
    const data = await res.json();
    const wordList = data?.data?.word_list || [];
    return wordList.map((item) => ({
      title: item.word || "",
      hotValue: item.hot_value || 0,
      source: "douyin",
    }));
  } catch (e) {
    console.error("[warn] douyin hot fetch failed:", e.message);
    return [];
  }
}

// ── 已发布检查 ──

function getTodayDir() {
  const today = new Date().toISOString().slice(0, 10);
  return path.join(PROJECT_DIR, "output", ACCOUNT_ID, today);
}

function getPublishedTitles() {
  const titles = [];
  const outputDir = path.join(PROJECT_DIR, "output", ACCOUNT_ID);
  if (!fs.existsSync(outputDir)) return titles;

  // Scan all date dirs for .txt files (title files)
  for (const dateDir of fs.readdirSync(outputDir)) {
    const datePath = path.join(outputDir, dateDir);
    if (!fs.statSync(datePath).isDirectory()) continue;
    for (const file of fs.readdirSync(datePath)) {
      if (file.endsWith(".txt")) {
        try {
          const content = fs.readFileSync(path.join(datePath, file), "utf-8");
          const firstLine = content.trim().split("\n")[0];
          if (firstLine) titles.push({ title: firstLine, date: dateDir });
        } catch {}
      }
    }
  }
  return titles;
}

function isTodayDone() {
  const dir = getTodayDir();
  if (!fs.existsSync(dir)) return false;
  const files = fs.readdirSync(dir);
  return files.some((f) => f.endsWith(".mp4"));
}

function isDuplicate(title, publishedTitles) {
  const clean = (s) => s.replace(/[，。！？、：""（）《》\s#]/g, "");
  const titleClean = clean(title);
  for (const pub of publishedTitles) {
    const pubClean = clean(pub.title);
    if (titleClean.includes(pubClean) || pubClean.includes(titleClean)) return true;
    // Bigram overlap
    const bigrams = (s) => new Set(s.match(/.{2}/g) || []);
    const a = bigrams(titleClean);
    const b = bigrams(pubClean);
    const overlap = [...a].filter((w) => b.has(w)).length;
    const similarity = overlap / Math.max(a.size, b.size, 1);
    if (similarity > 0.5) return true;
  }
  return false;
}

// ── Main ──

async function main() {
  const args = process.argv.slice(2);

  // --check-today: 仅检查今天是否已出内容
  if (args.includes("--check-today")) {
    const done = isTodayDone();
    console.log(JSON.stringify({ today: new Date().toISOString().slice(0, 10), done }));
    process.exit(done ? 1 : 0);
  }

  // Check today
  if (isTodayDone() && !args.includes("--force")) {
    console.error(`[info] 今天已出过内容: ${getTodayDir()}`);
    console.error("[info] 使用 --force 强制重新选题");
    process.exit(1);
  }

  const publishedTitles = getPublishedTitles();

  // Fetch from all sources in parallel
  const [kr36, ithome, douyin, juejin, weibo, zhihu] = await Promise.all([
    fetchHotList("36kr"),
    fetchHotList("ithome"),
    fetchDouyinHot(),
    fetchHotList("juejin"),
    fetchHotList("weibo"),
    fetchHotList("zhihu"),
  ]);

  // Merge & deduplicate
  const seen = new Set();
  const all = [];
  for (const item of [...kr36, ...ithome, ...juejin, ...weibo, ...zhihu, ...douyin]) {
    const t = item.title.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    all.push({ ...item, title: t });
  }

  // Score & filter
  // 抖音热榜为主：但必须命中科技关键词才给热度加分
  const scored = all
    .map((item) => {
      const baseScore = scoreTitle(item.title);
      let score = baseScore;
      if (item.source === "douyin") {
        // 只有命中了至少一个科技关键词（baseScore >= 3）才给抖音热度加分
        if (baseScore >= 3 && item.hotValue) {
          score += Math.min(item.hotValue / 500000, 15);
        }
      }
      return { ...item, score, isDuplicate: isDuplicate(item.title, publishedTitles) };
    })
    .filter((item) => item.score > 0 && !item.isDuplicate)
    .sort((a, b) => b.score - a.score);

  const pickMode = args.includes("--pick");

  if (pickMode) {
    if (scored.length === 0) {
      console.error("[warn] 没有找到合适的新话题");
      process.exit(1);
    }
    const pick = scored[0];
    console.log(JSON.stringify({
      title: pick.title,
      score: pick.score,
      url: pick.url || null,
      source: pick.source,
    }));
  } else {
    console.log(JSON.stringify({
      today: new Date().toISOString().slice(0, 10),
      todayDone: isTodayDone(),
      candidates: scored.slice(0, 20),
      totalFetched: all.length,
      filtered: scored.length,
      publishedCount: publishedTitles.length,
      sources: {
        "36kr": kr36.length,
        ithome: ithome.length,
        juejin: juejin.length,
        weibo: weibo.length,
        zhihu: zhihu.length,
        douyin: douyin.length,
      },
    }, null, 2));
  }
}

main().catch((e) => {
  console.error("[error]", e.message);
  process.exit(1);
});
