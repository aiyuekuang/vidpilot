#!/usr/bin/env node
/**
 * 处理角色 PNG：去灰色背景 → 透明、裁切、统一高度、复制到 public/
 */
import sharp from "sharp";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { mkdirSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC_DIR = join(ROOT, "..", "a股", "素材", "人物");
const DST_DIR = join(ROOT, "public");

const TARGET_HEIGHT = 800; // 统一高度
const BG_THRESHOLD = 40; // 灰色背景容差

mkdirSync(DST_DIR, { recursive: true });

async function removeGrayBg(inputPath, outputPath) {
  const img = sharp(inputPath);
  const { width, height, channels } = await img.metadata();

  // 读取原始像素
  const raw = await img.ensureAlpha().raw().toBuffer();

  // 采样四角获取背景色
  const corners = [
    [0, 0], [width - 1, 0],
    [0, height - 1], [width - 1, height - 1],
  ];
  let bgR = 0, bgG = 0, bgB = 0;
  for (const [x, y] of corners) {
    const idx = (y * width + x) * 4;
    bgR += raw[idx]; bgG += raw[idx + 1]; bgB += raw[idx + 2];
  }
  bgR = Math.round(bgR / 4);
  bgG = Math.round(bgG / 4);
  bgB = Math.round(bgB / 4);
  console.log(`  背景色: rgb(${bgR}, ${bgG}, ${bgB})`);

  // 将相似背景色像素设为透明
  const output = Buffer.from(raw);
  for (let i = 0; i < output.length; i += 4) {
    const r = output[i], g = output[i + 1], b = output[i + 2];
    const dist = Math.sqrt(
      (r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2
    );
    if (dist < BG_THRESHOLD) {
      output[i + 3] = 0; // 设为透明
    }
  }

  // 写入透明背景图
  const transparent = await sharp(output, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();

  // 裁切（去掉透明边缘）+ 调整高度
  const trimmed = await sharp(transparent)
    .trim()
    .toBuffer();

  const trimMeta = await sharp(trimmed).metadata();
  console.log(`  裁切后: ${trimMeta.width}x${trimMeta.height}`);

  // 等比缩放到目标高度
  await sharp(trimmed)
    .resize({ height: TARGET_HEIGHT, fit: "inside" })
    .png()
    .toFile(outputPath);

  const finalMeta = await sharp(outputPath).metadata();
  console.log(`  输出: ${finalMeta.width}x${finalMeta.height} -> ${outputPath}`);
}

const characters = [
  { src: "韭菜.png", dst: "char-韭菜.png" },
  { src: "主力.png", dst: "char-主力.png" },
];

for (const ch of characters) {
  console.log(`\n处理: ${ch.src}`);
  await removeGrayBg(
    join(SRC_DIR, ch.src),
    join(DST_DIR, ch.dst),
  );
}

console.log("\n完成！角色图片已处理到 public/ 目录");
