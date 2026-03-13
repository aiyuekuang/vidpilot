#!/usr/bin/env node
/**
 * 根据关键词从多个源抓取相关图片，供 narration 格式使用。
 *
 * 策略：
 *   1. 优先用新闻源自带的 cover 图（36kr, ithome 等）
 *   2. 补充用 Bing Image Search 抓取（无需 API key）
 *   3. 下载到 engine/public/ 供 Remotion 使用
 *
 * 用法：
 *   node scripts/fetch-images.mjs --keywords "谷歌 Gemini AI" --count 6 --account laodong
 *   node scripts/fetch-images.mjs --keywords "谷歌 Gemini AI" --count 6 --output /custom/path/
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

async function main() {
  const args = process.argv.slice(2);
  const countIdx = args.indexOf("--count");
  const count = countIdx >= 0 ? parseInt(args[countIdx + 1]) : 6;
  const outputDir = resolveOutputDir(args);

  let keywords = [];
  const kwIdx = args.indexOf("--keywords");
  if (kwIdx >= 0) {
    keywords = args[kwIdx + 1].split(/[\s,]+/).filter(Boolean);
  }

  if (keywords.length === 0) {
    console.error("Usage: node fetch-images.mjs --keywords 'AI Gemini 谷歌' --count 6");
    process.exit(1);
  }

  fs.mkdirSync(outputDir, { recursive: true });

  console.error(`[info] Fetching images for: ${keywords.join(", ")}`);

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

  // Output result as JSON
  console.log(
    JSON.stringify({
      count: downloaded.length,
      keywords,
      images: downloaded,
    }, null, 2)
  );
}

main().catch((e) => {
  console.error("[error]", e.message);
  process.exit(1);
});
