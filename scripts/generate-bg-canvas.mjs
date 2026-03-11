#!/usr/bin/env node
/**
 * 用 Node canvas 编程生成多种股票沙雕对话背景图
 *
 * 用法：
 *   node scripts/generate-bg-canvas.mjs           # 生成全部背景到 a股/素材/背景/
 *   node scripts/generate-bg-canvas.mjs --list     # 列出所有场景
 */

import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BG_DIR = join(ROOT, "..", "a股", "素材", "背景");

// 加载中文字体
GlobalFonts.loadFontsFromDir("/Users/suconnect/Library/Fonts/");
const CN_FONT = "Noto Sans CJK SC";

const W = 1080;
const H = 1920;

// === 工具函数 ===

function linearGrad(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [offset, color] of stops) g.addColorStop(offset, color);
  return g;
}

function radialGrad(ctx, cx, cy, r, stops) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  for (const [offset, color] of stops) g.addColorStop(offset, color);
  return g;
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

function drawStars(ctx, count, color = "rgba(255,255,255,0.3)") {
  for (let i = 0; i < count; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H * 0.6;
    const r = Math.random() * 3 + 1;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawKLine(ctx, x, y, w, h, isUp) {
  const color = isUp ? "#FF4444" : "#00CC66";
  const bodyH = h * (0.3 + Math.random() * 0.4);
  const bodyY = y + (h - bodyH) * Math.random();
  // 影线
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w / 2, y + h);
  ctx.stroke();
  // 实体
  ctx.fillStyle = color;
  ctx.fillRect(x, bodyY, w, bodyH);
}

function drawGrid(ctx, color = "rgba(255,255,255,0.05)") {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
}

// === 场景生成器 ===

const scenes = [
  {
    name: "红色牛市",
    draw(ctx) {
      // 红色渐变背景
      ctx.fillStyle = linearGrad(ctx, 0, 0, 0, H, [
        [0, "#8B0000"],
        [0.4, "#CC2222"],
        [0.7, "#FF4444"],
        [1, "#FF6666"],
      ]);
      ctx.fillRect(0, 0, W, H);
      drawGrid(ctx, "rgba(255,255,255,0.06)");
      // K线组
      for (let i = 0; i < 20; i++) {
        drawKLine(ctx, 40 + i * 50, 200 + Math.sin(i * 0.5) * 100, 30, 80 + Math.random() * 60, Math.random() > 0.3);
      }
      // 上涨箭头
      ctx.fillStyle = "rgba(255,215,0,0.15)";
      ctx.beginPath();
      ctx.moveTo(W / 2, 100);
      ctx.lineTo(W / 2 + 200, 400);
      ctx.lineTo(W / 2 - 200, 400);
      ctx.closePath();
      ctx.fill();
      // 装饰文字
      ctx.font = `bold 120px ${CN_FONT}, sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.textAlign = "center";
      ctx.fillText("BULL", W / 2, H * 0.35);
      drawStars(ctx, 30, "rgba(255,215,0,0.2)");
    },
  },
  {
    name: "绿色熊市",
    draw(ctx) {
      ctx.fillStyle = linearGrad(ctx, 0, 0, 0, H, [
        [0, "#003300"],
        [0.4, "#005500"],
        [0.7, "#007700"],
        [1, "#009900"],
      ]);
      ctx.fillRect(0, 0, W, H);
      drawGrid(ctx, "rgba(0,255,0,0.04)");
      // 下跌K线
      for (let i = 0; i < 20; i++) {
        drawKLine(ctx, 40 + i * 50, 150 + i * 15, 30, 60 + Math.random() * 80, Math.random() > 0.7);
      }
      // 下跌箭头
      ctx.fillStyle = "rgba(0,255,0,0.1)";
      ctx.beginPath();
      ctx.moveTo(W / 2, 500);
      ctx.lineTo(W / 2 + 200, 200);
      ctx.lineTo(W / 2 - 200, 200);
      ctx.closePath();
      ctx.fill();
      ctx.font = `bold 120px ${CN_FONT}, sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.textAlign = "center";
      ctx.fillText("BEAR", W / 2, H * 0.35);
      drawStars(ctx, 20, "rgba(0,255,0,0.15)");
    },
  },
  {
    name: "交易所大厅",
    draw(ctx) {
      // 深蓝背景
      ctx.fillStyle = linearGrad(ctx, 0, 0, 0, H, [
        [0, "#0A0A2E"],
        [0.5, "#1A1A4E"],
        [1, "#2A2A5E"],
      ]);
      ctx.fillRect(0, 0, W, H);
      // 大屏幕
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const sx = 60 + col * 330;
          const sy = 80 + row * 180;
          ctx.fillStyle = "#001133";
          roundRect(ctx, sx, sy, 300, 150, 8);
          ctx.fill();
          ctx.strokeStyle = "#0066CC";
          ctx.lineWidth = 2;
          roundRect(ctx, sx, sy, 300, 150, 8);
          ctx.stroke();
          // 屏幕内K线
          for (let k = 0; k < 8; k++) {
            const isUp = Math.random() > 0.5;
            ctx.fillStyle = isUp ? "#FF3333" : "#33FF33";
            const bh = 20 + Math.random() * 60;
            ctx.fillRect(sx + 20 + k * 35, sy + 130 - bh, 20, bh);
          }
        }
      }
      // 地板
      ctx.fillStyle = linearGrad(ctx, 0, H * 0.65, 0, H, [
        [0, "#1A1A3E"],
        [1, "#0A0A1E"],
      ]);
      ctx.fillRect(0, H * 0.65, W, H * 0.35);
      // 地砖线
      ctx.strokeStyle = "rgba(100,100,200,0.1)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 12; i++) {
        ctx.beginPath();
        ctx.moveTo(0, H * 0.65 + i * 50);
        ctx.lineTo(W, H * 0.65 + i * 50);
        ctx.stroke();
      }
      drawStars(ctx, 15, "rgba(100,150,255,0.3)");
    },
  },
  {
    name: "夜景天台",
    draw(ctx) {
      // 紫橙渐变天空
      ctx.fillStyle = linearGrad(ctx, 0, 0, 0, H, [
        [0, "#0D0221"],
        [0.2, "#261447"],
        [0.4, "#6B2D5B"],
        [0.55, "#F0944D"],
        [0.65, "#F5C26B"],
        [0.7, "#2A2A3A"],
        [1, "#1A1A2A"],
      ]);
      ctx.fillRect(0, 0, W, H);
      drawStars(ctx, 60);
      // 城市天际线
      const buildings = [
        [50, 300], [120, 200], [200, 350], [300, 250], [380, 400],
        [460, 280], [550, 320], [640, 220], [720, 380], [800, 260],
        [880, 340], [960, 290],
      ];
      for (const [bx, bh] of buildings) {
        const by = H * 0.55 - bh;
        ctx.fillStyle = `rgba(20,20,40,0.8)`;
        ctx.fillRect(bx, by, 70, bh);
        // 窗户
        for (let wy = by + 15; wy < by + bh - 20; wy += 30) {
          for (let wx = bx + 10; wx < bx + 60; wx += 20) {
            ctx.fillStyle = Math.random() > 0.3 ? "rgba(255,200,50,0.6)" : "rgba(50,50,80,0.5)";
            ctx.fillRect(wx, wy, 12, 15);
          }
        }
      }
      // 天台栏杆
      ctx.fillStyle = "#333344";
      ctx.fillRect(0, H * 0.6, W, 8);
      for (let rx = 20; rx < W; rx += 40) {
        ctx.fillRect(rx, H * 0.55, 6, H * 0.05);
      }
      // 天台地面
      ctx.fillStyle = linearGrad(ctx, 0, H * 0.6, 0, H, [
        [0, "#2A2A3A"],
        [1, "#1A1A2A"],
      ]);
      ctx.fillRect(0, H * 0.6 + 8, W, H * 0.4);
    },
  },
  {
    name: "烧烤摊",
    draw(ctx) {
      // 暖色夜景
      ctx.fillStyle = linearGrad(ctx, 0, 0, 0, H, [
        [0, "#1A0A00"],
        [0.3, "#2A1500"],
        [0.6, "#3D2000"],
        [1, "#4A2800"],
      ]);
      ctx.fillRect(0, 0, W, H);
      // 灯泡串
      for (let i = 0; i < 15; i++) {
        const lx = 30 + i * 75;
        const ly = 150 + Math.sin(i * 0.8) * 30;
        // 线
        if (i > 0) {
          ctx.strokeStyle = "#333";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(lx - 75, 150 + Math.sin((i - 1) * 0.8) * 30);
          ctx.lineTo(lx, ly);
          ctx.stroke();
        }
        // 灯泡光晕
        ctx.fillStyle = radialGrad(ctx, lx, ly, 40, [
          [0, "rgba(255,200,50,0.4)"],
          [1, "rgba(255,200,50,0)"],
        ]);
        ctx.fillRect(lx - 40, ly - 40, 80, 80);
        // 灯泡
        ctx.fillStyle = ["#FF6633", "#FFCC00", "#FF3366", "#33FF66"][i % 4];
        ctx.beginPath();
        ctx.arc(lx, ly, 10, 0, Math.PI * 2);
        ctx.fill();
      }
      // 红色帐篷
      ctx.fillStyle = "#CC3333";
      ctx.beginPath();
      ctx.moveTo(100, 250);
      ctx.lineTo(540, 200);
      ctx.lineTo(980, 250);
      ctx.lineTo(980, 280);
      ctx.lineTo(100, 280);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#AA2222";
      ctx.fillRect(100, 280, 880, 10);
      // 烧烤架
      ctx.fillStyle = "#555";
      ctx.fillRect(300, 350, 400, 15);
      ctx.fillRect(320, 365, 10, 80);
      ctx.fillRect(680, 365, 10, 80);
      // 串串
      for (let s = 0; s < 10; s++) {
        ctx.fillStyle = "#8B4513";
        ctx.fillRect(340 + s * 35, 320, 4, 40);
        ctx.fillStyle = ["#FF6633", "#CC9933", "#FF3333"][s % 3];
        ctx.beginPath();
        ctx.arc(342 + s * 35, 325, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      // 地面
      ctx.fillStyle = linearGrad(ctx, 0, H * 0.55, 0, H, [
        [0, "#3D2000"],
        [1, "#2A1500"],
      ]);
      ctx.fillRect(0, H * 0.55, W, H * 0.45);
      // 啤酒瓶
      for (let b = 0; b < 5; b++) {
        const bx = 100 + b * 200 + Math.random() * 50;
        ctx.fillStyle = "#336633";
        ctx.fillRect(bx, H * 0.58, 16, 50);
        ctx.fillStyle = "#448844";
        roundRect(ctx, bx - 4, H * 0.55, 24, 30, 4);
        ctx.fill();
      }
      // 烟雾
      for (let i = 0; i < 20; i++) {
        const sx = 350 + Math.random() * 300;
        const sy = 200 + Math.random() * 150;
        const sr = 15 + Math.random() * 30;
        ctx.fillStyle = `rgba(200,200,200,${0.02 + Math.random() * 0.04})`;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  {
    name: "办公室",
    draw(ctx) {
      // 浅灰蓝背景
      ctx.fillStyle = linearGrad(ctx, 0, 0, 0, H, [
        [0, "#E8EDF2"],
        [0.5, "#D0D8E0"],
        [1, "#B8C4D0"],
      ]);
      ctx.fillRect(0, 0, W, H);
      // 窗户
      ctx.fillStyle = "#A0C8E8";
      roundRect(ctx, 150, 80, 780, 400, 8);
      ctx.fill();
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 8;
      roundRect(ctx, 150, 80, 780, 400, 8);
      ctx.stroke();
      // 窗框
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(538, 80, 4, 400);
      ctx.fillRect(150, 278, 780, 4);
      // 窗外蓝天白云
      ctx.fillStyle = linearGrad(ctx, 0, 80, 0, 480, [
        [0, "#4A9FE8"],
        [1, "#87CEEB"],
      ]);
      roundRect(ctx, 154, 84, 772, 392, 4);
      ctx.fill();
      // 云
      for (const [cx, cy] of [[250, 180], [600, 150], [800, 220]]) {
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.beginPath();
        ctx.arc(cx, cy, 30, 0, Math.PI * 2);
        ctx.arc(cx + 30, cy - 10, 35, 0, Math.PI * 2);
        ctx.arc(cx + 60, cy, 25, 0, Math.PI * 2);
        ctx.fill();
      }
      // 墙
      ctx.fillStyle = "#D8DFE6";
      ctx.fillRect(0, 480, W, H * 0.15);
      // 绿植
      ctx.fillStyle = "#8B6914";
      ctx.fillRect(80, 420, 40, 80);
      ctx.fillStyle = "#4CAF50";
      ctx.beginPath();
      ctx.arc(100, 380, 50, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#66BB6A";
      ctx.beginPath();
      ctx.arc(120, 360, 35, 0, Math.PI * 2);
      ctx.fill();
      // 办公桌
      ctx.fillStyle = "#A0704A";
      roundRect(ctx, 200, 550, 680, 20, 4);
      ctx.fill();
      ctx.fillRect(220, 570, 15, 100);
      ctx.fillRect(850, 570, 15, 100);
      // 显示器
      ctx.fillStyle = "#222";
      roundRect(ctx, 400, 430, 280, 120, 6);
      ctx.fill();
      ctx.fillStyle = "#0A1628";
      roundRect(ctx, 408, 438, 264, 104, 4);
      ctx.fill();
      // 显示器内容
      for (let k = 0; k < 6; k++) {
        const isUp = Math.random() > 0.5;
        ctx.fillStyle = isUp ? "#FF3333" : "#33FF33";
        const kh = 15 + Math.random() * 40;
        ctx.fillRect(420 + k * 40, 530 - kh, 25, kh);
      }
      ctx.fillStyle = "#333";
      ctx.fillRect(530, 550, 20, 10);
      ctx.fillRect(510, 558, 60, 6);
      // 地板
      ctx.fillStyle = linearGrad(ctx, 0, H * 0.55, 0, H, [
        [0, "#C8B896"],
        [1, "#B0A080"],
      ]);
      ctx.fillRect(0, H * 0.55, W, H * 0.45);
      // 木地板纹理
      ctx.strokeStyle = "rgba(160,130,90,0.3)";
      ctx.lineWidth = 1;
      for (let y = H * 0.55; y < H; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
    },
  },
  {
    name: "直播间",
    draw(ctx) {
      ctx.fillStyle = linearGrad(ctx, 0, 0, 0, H, [
        [0, "#1A0000"],
        [0.5, "#2A0A0A"],
        [1, "#3A1515"],
      ]);
      ctx.fillRect(0, 0, W, H);
      // 三个大屏
      for (let i = 0; i < 3; i++) {
        const sx = 50 + i * 340;
        ctx.fillStyle = "#000A1A";
        roundRect(ctx, sx, 60, 300, 200, 6);
        ctx.fill();
        ctx.strokeStyle = "#FF3333";
        ctx.lineWidth = 3;
        roundRect(ctx, sx, 60, 300, 200, 6);
        ctx.stroke();
        // 数据
        ctx.font = `bold 28px ${CN_FONT}, sans-serif`;
        ctx.fillStyle = i === 1 ? "#33FF33" : "#FF3333";
        ctx.textAlign = "center";
        ctx.fillText(
          i === 0 ? "上证 3288.56" : i === 1 ? "深证 10526.3" : "创业板 2105.8",
          sx + 150, 130
        );
        // 涨跌
        ctx.font = `bold 40px ${CN_FONT}, sans-serif`;
        ctx.fillText(
          i === 0 ? "+2.35%" : i === 1 ? "+1.87%" : "-0.56%",
          sx + 150, 200
        );
        // K线
        for (let k = 0; k < 8; k++) {
          const isUp = Math.random() > 0.4;
          ctx.fillStyle = isUp ? "#FF3333" : "#33FF33";
          const kh = 10 + Math.random() * 30;
          ctx.fillRect(sx + 30 + k * 32, 240 - kh, 18, kh);
        }
      }
      // LIVE标志
      ctx.fillStyle = "#FF0000";
      roundRect(ctx, 50, 300, 100, 40, 20);
      ctx.fill();
      ctx.font = `bold 24px ${CN_FONT}, sans-serif`;
      ctx.fillStyle = "#FFF";
      ctx.textAlign = "center";
      ctx.fillText("LIVE", 100, 328);
      // 桌子
      ctx.fillStyle = "#2A1A1A";
      roundRect(ctx, 100, 420, 880, 30, 6);
      ctx.fill();
      // 麦克风
      ctx.fillStyle = "#666";
      ctx.fillRect(530, 380, 8, 40);
      ctx.fillStyle = "#333";
      ctx.beginPath();
      ctx.arc(534, 375, 15, 0, Math.PI * 2);
      ctx.fill();
      // 红色光效
      ctx.fillStyle = radialGrad(ctx, W / 2, 0, H * 0.6, [
        [0, "rgba(255,0,0,0.08)"],
        [1, "rgba(255,0,0,0)"],
      ]);
      ctx.fillRect(0, 0, W, H);
      // 地面
      ctx.fillStyle = linearGrad(ctx, 0, H * 0.55, 0, H, [
        [0, "#2A1515"],
        [1, "#1A0A0A"],
      ]);
      ctx.fillRect(0, H * 0.55, W, H * 0.45);
    },
  },
  {
    name: "奶茶店",
    draw(ctx) {
      // 粉色暖色调
      ctx.fillStyle = linearGrad(ctx, 0, 0, 0, H, [
        [0, "#FFE4E1"],
        [0.4, "#FFCDD2"],
        [0.7, "#F8BBD0"],
        [1, "#F48FB1"],
      ]);
      ctx.fillRect(0, 0, W, H);
      // 菜单牌
      ctx.fillStyle = "#FFFFFF";
      roundRect(ctx, 200, 80, 680, 300, 16);
      ctx.fill();
      ctx.strokeStyle = "#FF8A80";
      ctx.lineWidth = 4;
      roundRect(ctx, 200, 80, 680, 300, 16);
      ctx.stroke();
      // 菜单文字
      ctx.font = `bold 36px ${CN_FONT}, sans-serif`;
      ctx.fillStyle = "#D32F2F";
      ctx.textAlign = "center";
      ctx.fillText("MENU", W / 2, 140);
      ctx.font = `24px ${CN_FONT}, sans-serif`;
      ctx.fillStyle = "#666";
      const items = ["珍珠奶茶 ¥18", "芋泥啵啵 ¥22", "杨枝甘露 ¥25", "生椰拿铁 ¥20"];
      items.forEach((item, i) => {
        ctx.fillText(item, W / 2, 190 + i * 40);
      });
      // 吧台
      ctx.fillStyle = "#FF8A65";
      roundRect(ctx, 100, 450, 880, 35, 8);
      ctx.fill();
      ctx.fillStyle = "#E65100";
      ctx.fillRect(100, 485, 880, 8);
      // 奶茶杯
      for (let c = 0; c < 4; c++) {
        const cx = 200 + c * 200;
        // 杯子
        ctx.fillStyle = ["#FFE0B2", "#E1BEE7", "#B2EBF2", "#C8E6C9"][c];
        roundRect(ctx, cx, 400, 50, 55, 8);
        ctx.fill();
        // 吸管
        ctx.fillStyle = ["#FF5722", "#9C27B0", "#00BCD4", "#4CAF50"][c];
        ctx.fillRect(cx + 20, 370, 6, 40);
        // 盖子
        ctx.fillStyle = "#FFF";
        roundRect(ctx, cx - 5, 395, 60, 10, 4);
        ctx.fill();
      }
      // 装饰：小星星和爱心
      for (let i = 0; i < 15; i++) {
        const sx = Math.random() * W;
        const sy = Math.random() * H * 0.3;
        ctx.fillStyle = `rgba(255,${150 + Math.random() * 100},${150 + Math.random() * 100},0.3)`;
        ctx.font = `20px ${CN_FONT}, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(Math.random() > 0.5 ? "★" : "♥", sx, sy);
      }
      // 地面
      ctx.fillStyle = linearGrad(ctx, 0, H * 0.55, 0, H, [
        [0, "#F8BBD0"],
        [1, "#F48FB1"],
      ]);
      ctx.fillRect(0, H * 0.55, W, H * 0.45);
      // 瓷砖
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 1;
      for (let y = H * 0.55; y < H; y += 80) {
        for (let x = 0; x < W; x += 80) {
          ctx.strokeRect(x, y, 80, 80);
        }
      }
    },
  },
];

// === 主程序 ===
const args = process.argv.slice(2);
if (args.includes("--list")) {
  scenes.forEach((s, i) => console.log(`  ${i + 1}. ${s.name}`));
  process.exit(0);
}

mkdirSync(BG_DIR, { recursive: true });

console.log(`生成 ${scenes.length} 张背景素材到 ${BG_DIR}`);

for (const scene of scenes) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  scene.draw(ctx);
  const outputPath = join(BG_DIR, `${scene.name}.png`);
  const buffer = canvas.toBuffer("image/png");
  writeFileSync(outputPath, buffer);
  console.log(`  [done] ${scene.name}.png (${(buffer.length / 1024).toFixed(0)} KB)`);
}

console.log(`\n全部完成！共 ${scenes.length} 张背景`);
