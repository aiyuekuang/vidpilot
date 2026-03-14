#!/usr/bin/env node
/**
 * 根据关键词从多个源抓取相关图片，供 narration 格式使用。
 *
 * 策略：
 *   1. 优先用新闻源自带的 cover 图（36kr, ithome 等）
 *   2. 补充用 Bing Image Search 抓取（无需 API key）
 *   3. 下载到 output/{accountId}/images/ 供脚本生成使用
 *
 * 用法（整体模式）：
 *   node scripts/fetch-images.mjs --keywords "谷歌 Gemini AI" --count 6 --account laodong
 *   node scripts/fetch-images.mjs --keywords "谷歌 Gemini AI" --count 6 --output /custom/path/
 *
 * 用法（per-segment 模式）：每段关键词用 | 分隔，每段搜一张图，文件名取第一个关键词
 *   node scripts/fetch-images.mjs --per-segment "新能源汽车电池|等离子清洗工艺|胶接失效原因|指示卡变色" --account plasmalab
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = path.join(__dirname, "..");

function resolveOutputDir(args) {
  const outputIdx = args.indexOf("--output");
  if (outputIdx >= 0) return args[outputIdx + 1];

  // Resolve from --account + VIDPILOT_PROJECT
  const accountIdx = args.indexOf("--account");
  const projectDir = process.env.VIDPILOT_PROJECT;
  if (accountIdx >= 0 && projectDir) {
    return path.join(projectDir, "output", args[accountIdx + 1], "images");
  }
  if (accountIdx >= 0) {
    // Fallback: output relative to project CWD
    return path.join(process.cwd(), "output", args[accountIdx + 1], "images");
  }
  // Last resort: engine/public (for backward compat)
  return path.join(SKILL_DIR, "engine", "public");
}

async function downloadImage(url, outputPath) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", Referer: url },
      signal: AbortSignal.timeout(15000),
      redirect: "follow",
    });
    if (!res.ok) return false;
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) return false;

    const ws = fs.createWriteStream(outputPath);
    await pipeline(Readable.fromWeb(res.body), ws);
    const stat = fs.statSync(outputPath);
    if (stat.size < 5000) {
      fs.unlinkSync(outputPath);
      return false;
    }
    return true;
  } catch (e) {
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    return false;
  }
}

// Fetch cover images from hot list APIs
async function fetchCoversFromHotList(keywords, count) {
  const images = [];
  const sources = ["36kr", "ithome", "juejin"];

  for (const src of sources) {
    try {
      const res = await fetch(
        `https://api.pearktrue.cn/api/dailyhot/?title=${src}`,
        { signal: AbortSignal.timeout(15000) }
      );
      const data = await res.json();
      if (data.code !== 200) continue;

      for (const item of data.data || []) {
        if (images.length >= count) break;
        const title = item.title || "";
        const cover = item.cover || "";
        if (!cover) continue;

        // Check if title relates to any keyword
        const related = keywords.some(
          (kw) => title.includes(kw) || kw.includes(title.slice(0, 4))
        );
        if (!related && keywords.length > 0) continue;

        images.push({
          url: cover,
          title: title.slice(0, 30),
          source: src,
        });
      }
    } catch {}
  }
  return images;
}

// Fetch from Bing image search (no API key)
async function fetchFromBing(query, count) {
  const images = [];
  try {
    const res = await fetch(
      `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&count=${count * 2}&mkt=zh-CN&form=HDRSC2`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          Accept: "text/html",
        },
        signal: AbortSignal.timeout(15000),
      }
    );
    const html = await res.text();

    // Extract image URLs from bing results
    const regex = /murl&quot;:&quot;(https?:\/\/[^&]+?)&quot;/g;
    let m;
    while ((m = regex.exec(html)) !== null && images.length < count) {
      const url = m[1];
      if (url.match(/\.(jpg|jpeg|png|webp)/i)) {
        images.push({ url, title: query, source: "bing" });
      }
    }
  } catch (e) {
    console.error("[warn] Bing image search failed:", e.message);
  }
  return images;
}

// Fetch one image for a single query, try hot lists first then Bing
async function fetchOneImage(query, outputDir, filenameBase) {
  const kws = query.split(/[\s,]+/).filter(Boolean);

  // Try hot list covers first
  const hotCovers = await fetchCoversFromHotList(kws, 3);
  let candidates = hotCovers;

  // Fall back to Bing
  if (candidates.length === 0) {
    candidates = await fetchFromBing(query, 5);
  }

  for (const img of candidates) {
    const ext = img.url.match(/\.(jpg|jpeg|png|webp)/i)?.[1] || "jpg";
    const filename = `${filenameBase}.${ext}`;
    const filepath = path.join(outputDir, filename);
    console.error(`[info] Downloading: ${img.url.slice(0, 60)}...`);
    const ok = await downloadImage(img.url, filepath);
    if (ok) {
      console.error(`  [+] Saved: ${filename}`);
      return { filename, title: img.title, source: img.source };
    }
  }
  console.error(`  [-] No image found for: ${query}`);
  return null;
}

// Convert a Chinese/English phrase to a safe filename slug
function toSlug(str) {
  return str.trim()
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
}

async function main() {
  const args = process.argv.slice(2);
  const outputDir = resolveOutputDir(args);
  fs.mkdirSync(outputDir, { recursive: true });

  // --per-segment mode: each segment keyword separated by |
  const psIdx = args.indexOf("--per-segment");
  if (psIdx >= 0) {
    const segments = args[psIdx + 1].split("|").map((s) => s.trim()).filter(Boolean);
    console.error(`[info] Per-segment mode: ${segments.length} segments`);
    const downloaded = [];
    for (let i = 0; i < segments.length; i++) {
      const query = segments[i];
      const slug = toSlug(query) || `seg-${i + 1}`;
      console.error(`[info] Segment ${i + 1}/${segments.length}: "${query}"`);
      const result = await fetchOneImage(query, outputDir, slug);
      if (result) downloaded.push({ segment: i + 1, query, ...result });
    }
    console.log(JSON.stringify({ count: downloaded.length, mode: "per-segment", images: downloaded }, null, 2));
    return;
  }

  // --keywords mode (original bulk mode)
  const countIdx = args.indexOf("--count");
  const count = countIdx >= 0 ? parseInt(args[countIdx + 1]) : 6;

  let keywords = [];
  const kwIdx = args.indexOf("--keywords");
  if (kwIdx >= 0) {
    keywords = args[kwIdx + 1].split(/[\s,]+/).filter(Boolean);
  }

  if (keywords.length === 0) {
    console.error("Usage:");
    console.error("  node fetch-images.mjs --keywords 'AI Gemini 谷歌' --count 6 --account laodong");
    console.error("  node fetch-images.mjs --per-segment '新能源汽车电池|等离子清洗工艺|胶接失效|指示卡变色' --account plasmalab");
    process.exit(1);
  }

  console.error(`[info] Bulk mode: fetching ${count} images for: ${keywords.join(", ")}`);

  // 1. Try covers from hot list (higher quality, related content)
  const hotCovers = await fetchCoversFromHotList(keywords, count);
  console.error(`[info] Found ${hotCovers.length} covers from hot lists`);

  // 2. Supplement with Bing if needed
  let bingImages = [];
  if (hotCovers.length < count) {
    bingImages = await fetchFromBing(keywords.join(" "), count - hotCovers.length);
    console.error(`[info] Found ${bingImages.length} images from Bing`);
  }

  const allCandidates = [...hotCovers, ...bingImages];
  const downloaded = [];

  for (let i = 0; i < allCandidates.length && downloaded.length < count; i++) {
    const img = allCandidates[i];
    const ext = img.url.match(/\.(jpg|jpeg|png|webp)/i)?.[1] || "jpg";
    const filename = `narration-${downloaded.length + 1}.${ext}`;
    const filepath = path.join(outputDir, filename);

    console.error(`[info] Downloading ${downloaded.length + 1}/${count}: ${img.url.slice(0, 60)}...`);
    const ok = await downloadImage(img.url, filepath);
    if (ok) {
      downloaded.push({ filename, title: img.title, source: img.source });
      console.error(`  [+] Saved: ${filename}`);
    } else {
      console.error(`  [-] Failed, skipping`);
    }
  }

  console.log(JSON.stringify({ count: downloaded.length, mode: "bulk", keywords, images: downloaded }, null, 2));
}

main().catch((e) => {
  console.error("[error]", e.message);
  process.exit(1);
});
