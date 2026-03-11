#!/usr/bin/env node
/**
 * 根据热点新闻主题生成场景化背景图 (1080x1920)
 *
 * 用法:
 *   node scripts/generate-bg.mjs --title "三桶油集体涨停" --theme red
 *   node scripts/generate-bg.mjs --title "芯片板块暴跌" --theme blue --subtitle "半导体ETF单日跌幅超5%"
 *
 * 输出: public/bg-today.png
 */

import { createCanvas } from "@napi-rs/canvas";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");

// 中文字体（macOS 可用的）
const FONT_CN = '"Noto Sans CJK SC", "Hiragino Sans GB", "STHeiti", "PingFang SC", sans-serif';
const FONT_MONO = '"Menlo", "Noto Sans CJK SC", monospace';

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    title: "今日热点",
    subtitle: "",
    theme: "red",
    scene: "stock",
    output: join(ROOT, "public", "bg-today.png"),
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--title" && args[i + 1]) result.title = args[++i];
    else if (args[i] === "--subtitle" && args[i + 1]) result.subtitle = args[++i];
    else if (args[i] === "--theme" && args[i + 1]) result.theme = args[++i];
    else if (args[i] === "--scene" && args[i + 1]) result.scene = args[++i];
    else if (args[i] === "--output" && args[i + 1]) result.output = args[++i];
  }
  return result;
}

const THEMES = {
  red: {
    bg1: "#1a0505", bg2: "#4a0a0a", bg3: "#7a1515",
    accent: "#ff4444", accentLight: "#ff8888",
    wall: "#2a0808", floor: "#1a0404",
    glow: "rgba(255, 68, 68, 0.12)",
    furniture: "#3a1010",
  },
  green: {
    bg1: "#051a05", bg2: "#0a3a0a", bg3: "#156615",
    accent: "#00e676", accentLight: "#69f0ae",
    wall: "#082a08", floor: "#041a04",
    glow: "rgba(0, 230, 118, 0.12)",
    furniture: "#103a10",
  },
  blue: {
    bg1: "#050a1a", bg2: "#0a1a3a", bg3: "#152966",
    accent: "#448aff", accentLight: "#82b1ff",
    wall: "#081428", floor: "#040a1a",
    glow: "rgba(68, 138, 255, 0.12)",
    furniture: "#101a3a",
  },
  gold: {
    bg1: "#1a1205", bg2: "#3a280a", bg3: "#664815",
    accent: "#ffd740", accentLight: "#ffe082",
    wall: "#2a2008", floor: "#1a1204",
    glow: "rgba(255, 215, 64, 0.12)",
    furniture: "#3a2810",
  },
  purple: {
    bg1: "#0d051a", bg2: "#1a0a3a", bg3: "#330a66",
    accent: "#b388ff", accentLight: "#d1c4e9",
    wall: "#140828", floor: "#0a041a",
    glow: "rgba(179, 136, 255, 0.12)",
    furniture: "#1a103a",
  },
};

function generateBackground({ title, subtitle, theme: themeName, scene }) {
  const W = 1080;
  const H = 1920;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  const theme = THEMES[themeName] || THEMES.red;

  // 1. 渐变底色
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, theme.bg1);
  bgGrad.addColorStop(0.4, theme.bg2);
  bgGrad.addColorStop(1, theme.bg3);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // 2. 场景化元素（根据 scene 类型）
  drawScene(ctx, W, H, theme, scene);

  // 3. 光晕效果
  drawGlows(ctx, W, H, theme);

  // 4. 标题区
  drawTitle(ctx, W, H, theme, title, subtitle);

  // 5. 顶部日期
  const today = new Date();
  const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getDate()).padStart(2, "0")}`;
  ctx.font = `600 28px ${FONT_MONO}`;
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillText(dateStr, W - 40, 50);

  // 6. 底部角色区域变暗
  const bottomGrad = ctx.createLinearGradient(0, H * 0.5, 0, H);
  bottomGrad.addColorStop(0, "transparent");
  bottomGrad.addColorStop(0.4, "rgba(0,0,0,0.25)");
  bottomGrad.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, H * 0.5, W, H * 0.5);

  return canvas;
}

// === 场景绘制 ===
function drawScene(ctx, W, H, theme, scene) {
  switch (scene) {
    case "office":
      drawOfficeScene(ctx, W, H, theme);
      break;
    case "street":
      drawStreetScene(ctx, W, H, theme);
      break;
    case "stock":
    default:
      drawStockScene(ctx, W, H, theme);
      break;
  }
}

// 股市交易场景
function drawStockScene(ctx, W, H, theme) {
  // 墙面质感
  ctx.fillStyle = theme.wall;
  ctx.fillRect(0, 0, W, H * 0.7);

  // 地板
  const floorGrad = ctx.createLinearGradient(0, H * 0.65, 0, H);
  floorGrad.addColorStop(0, theme.floor);
  floorGrad.addColorStop(1, "rgba(0,0,0,0.8)");
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, H * 0.65, W, H * 0.35);

  // 地板分界线
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, H * 0.65);
  ctx.lineTo(W, H * 0.65);
  ctx.stroke();

  // 大屏幕（背景中的股票大屏）
  const screenX = 80, screenY = 120, screenW = W - 160, screenH = 340;
  // 屏幕外框
  ctx.fillStyle = "#111";
  roundRect(ctx, screenX - 8, screenY - 8, screenW + 16, screenH + 16, 12);
  ctx.fill();
  // 屏幕内容
  ctx.fillStyle = "#0a0a0a";
  roundRect(ctx, screenX, screenY, screenW, screenH, 8);
  ctx.fill();

  // K线在屏幕内
  drawKLines(ctx, screenX + 30, screenY + 40, screenW - 60, screenH - 80, theme, 0.6);

  // 屏幕反光
  ctx.fillStyle = "rgba(255,255,255,0.02)";
  roundRect(ctx, screenX, screenY, screenW, screenH / 2, 8);
  ctx.fill();

  // 侧面装饰 - 书架/柜子轮廓
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 2;
  // 左侧柜
  roundRect(ctx, 30, H * 0.52, 120, H * 0.12, 4);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(30, H * 0.52 + 40);
  ctx.lineTo(150, H * 0.52 + 40);
  ctx.stroke();
  // 右侧柜
  roundRect(ctx, W - 150, H * 0.52, 120, H * 0.12, 4);
  ctx.stroke();

  // 散落的文件/书
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  ctx.fillRect(40, H * 0.56, 50, 8);
  ctx.fillRect(60, H * 0.58, 40, 6);
  ctx.fillRect(W - 140, H * 0.55, 45, 7);
}

// 办公室场景
function drawOfficeScene(ctx, W, H, theme) {
  ctx.fillStyle = theme.wall;
  ctx.fillRect(0, 0, W, H * 0.7);

  // 窗户
  const winW = 280, winH = 320;
  const winX = (W - winW) / 2, winY = 100;
  ctx.fillStyle = "rgba(100,150,200,0.08)";
  roundRect(ctx, winX, winY, winW, winH, 6);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 3;
  roundRect(ctx, winX, winY, winW, winH, 6);
  ctx.stroke();
  // 窗格
  ctx.beginPath();
  ctx.moveTo(winX + winW / 2, winY);
  ctx.lineTo(winX + winW / 2, winY + winH);
  ctx.moveTo(winX, winY + winH / 2);
  ctx.lineTo(winX + winW, winY + winH / 2);
  ctx.stroke();

  // 地板
  const floorGrad = ctx.createLinearGradient(0, H * 0.65, 0, H);
  floorGrad.addColorStop(0, theme.floor);
  floorGrad.addColorStop(1, "rgba(0,0,0,0.8)");
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, H * 0.65, W, H * 0.35);

  // 桌子
  ctx.fillStyle = theme.furniture;
  roundRect(ctx, 100, H * 0.55, W - 200, 60, 8);
  ctx.fill();
  // 桌腿
  ctx.fillRect(130, H * 0.55 + 55, 20, 80);
  ctx.fillRect(W - 150, H * 0.55 + 55, 20, 80);

  // 电脑屏幕轮廓
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 2;
  roundRect(ctx, W / 2 - 80, H * 0.48, 160, 110, 6);
  ctx.stroke();
  // 屏幕支架
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.fillRect(W / 2 - 10, H * 0.55 - 5, 20, 20);
}

// 街头场景
function drawStreetScene(ctx, W, H, theme) {
  // 天空
  const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.4);
  skyGrad.addColorStop(0, theme.bg1);
  skyGrad.addColorStop(1, theme.bg2);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, H * 0.4);

  // 建筑群轮廓
  const buildings = [
    { x: 0, w: 160, h: 500 },
    { x: 140, w: 120, h: 600 },
    { x: 240, w: 180, h: 450 },
    { x: 400, w: 140, h: 550 },
    { x: 520, w: 200, h: 650 },
    { x: 700, w: 120, h: 480 },
    { x: 800, w: 160, h: 580 },
    { x: 940, w: 140, h: 420 },
  ];

  buildings.forEach(b => {
    const bY = H * 0.65 - b.h;
    ctx.fillStyle = theme.wall;
    ctx.fillRect(b.x, bY, b.w, b.h);
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    ctx.strokeRect(b.x, bY, b.w, b.h);

    // 窗户
    for (let wy = bY + 30; wy < H * 0.65 - 40; wy += 50) {
      for (let wx = b.x + 15; wx < b.x + b.w - 20; wx += 30) {
        ctx.fillStyle = Math.random() > 0.4
          ? `rgba(255, 220, 100, ${0.02 + Math.random() * 0.04})`
          : "rgba(0,0,0,0.3)";
        ctx.fillRect(wx, wy, 18, 22);
      }
    }
  });

  // 地面
  const groundGrad = ctx.createLinearGradient(0, H * 0.65, 0, H);
  groundGrad.addColorStop(0, theme.floor);
  groundGrad.addColorStop(1, "rgba(0,0,0,0.9)");
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, H * 0.65, W, H * 0.35);
}

// === K线图 ===
function drawKLines(ctx, x, y, w, h, theme, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;

  const barCount = 28;
  const barW = (w / barCount) * 0.55;
  const gap = w / barCount;

  let price = 50;
  const prices = [];
  for (let i = 0; i < barCount; i++) {
    const change = (Math.random() - 0.46) * 14;
    const open = price;
    price += change;
    prices.push({ open, close: price, high: Math.max(open, price) + Math.random() * 8, low: Math.min(open, price) - Math.random() * 8 });
  }

  const maxP = Math.max(...prices.map(p => p.high));
  const minP = Math.min(...prices.map(p => p.low));
  const range = maxP - minP || 1;

  prices.forEach((p, i) => {
    const bx = x + i * gap;
    const isUp = p.close >= p.open;
    const color = isUp ? "#ff4444" : "#00c853";

    ctx.fillStyle = color;
    ctx.strokeStyle = color;

    const bodyTop = y + h - ((Math.max(p.open, p.close) - minP) / range) * h;
    const bodyBot = y + h - ((Math.min(p.open, p.close) - minP) / range) * h;
    const bodyH = Math.max(bodyBot - bodyTop, 2);
    ctx.fillRect(bx, bodyTop, barW, bodyH);

    ctx.beginPath();
    ctx.moveTo(bx + barW / 2, y + h - ((p.high - minP) / range) * h);
    ctx.lineTo(bx + barW / 2, y + h - ((p.low - minP) / range) * h);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  // MA 均线
  ctx.beginPath();
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 2;
  ctx.globalAlpha = alpha * 0.5;
  let ma = prices[0].close;
  prices.forEach((p, i) => {
    ma = ma * 0.85 + p.close * 0.15;
    const px = x + i * gap + barW / 2;
    const py = y + h - ((ma - minP) / range) * h;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();

  ctx.restore();
}

// === 光晕 ===
function drawGlows(ctx, W, H, theme) {
  const positions = [
    [W * 0.2, H * 0.15, 300],
    [W * 0.8, H * 0.35, 250],
    [W * 0.5, H * 0.7, 350],
  ];
  positions.forEach(([x, y, r]) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, theme.glow);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  });
}

// === 标题 ===
function drawTitle(ctx, W, H, theme, title, subtitle) {
  const titleY = 520;

  // 标题背景条
  const boxGrad = ctx.createLinearGradient(0, titleY - 40, 0, titleY + 140);
  boxGrad.addColorStop(0, "rgba(0,0,0,0)");
  boxGrad.addColorStop(0.2, "rgba(0,0,0,0.5)");
  boxGrad.addColorStop(0.8, "rgba(0,0,0,0.5)");
  boxGrad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = boxGrad;
  ctx.fillRect(0, titleY - 40, W, 180);

  // 左侧装饰线
  ctx.fillStyle = theme.accent;
  ctx.fillRect(50, titleY - 5, 6, 60);

  // 标题文字
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.shadowColor = theme.accent;
  ctx.shadowBlur = 25;
  ctx.fillStyle = "white";
  ctx.font = `bold 68px ${FONT_CN}`;

  const lines = wrapText(ctx, title, W - 160);
  lines.forEach((line, i) => {
    ctx.fillText(line, 80, titleY + 25 + i * 80);
  });

  ctx.shadowBlur = 0;

  // 副标题
  if (subtitle) {
    ctx.font = `400 34px ${FONT_CN}`;
    ctx.fillStyle = theme.accentLight;
    ctx.fillText(subtitle, 80, titleY + 25 + lines.length * 80 + 15);
  }

  // 底部装饰线
  ctx.strokeStyle = theme.accent;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.moveTo(80, titleY + 25 + lines.length * 80 + (subtitle ? 50 : 25));
  ctx.lineTo(W - 80, titleY + 25 + lines.length * 80 + (subtitle ? 50 : 25));
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function wrapText(ctx, text, maxWidth) {
  const lines = [];
  let current = "";
  for (const char of text) {
    const test = current + char;
    if (ctx.measureText(test).width > maxWidth && current.length > 0) {
      lines.push(current);
      current = char;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// === 主程序 ===
const config = parseArgs();
mkdirSync(join(ROOT, "public"), { recursive: true });

console.log(`🎨 生成背景图...`);
console.log(`   标题: ${config.title}`);
console.log(`   主题: ${config.theme}`);
console.log(`   场景: ${config.scene}`);
if (config.subtitle) console.log(`   副标题: ${config.subtitle}`);

const canvas = generateBackground(config);
const buffer = canvas.toBuffer("image/png");
writeFileSync(config.output, buffer);

console.log(`✅ 背景图已保存: ${config.output}`);
console.log(`   尺寸: 1080x1920`);
