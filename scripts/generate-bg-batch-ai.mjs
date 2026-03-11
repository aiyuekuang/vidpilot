#!/usr/bin/env node
/**
 * 批量生成高质量背景素材（支持 MiniMax / DashScope / Gemini / OpenRouter）
 *
 * 用法：
 *   export MINIMAX_API_KEY=你的密钥       # MiniMax（每日免费额度，推荐）
 *   export DASHSCOPE_API_KEY=你的密钥     # 通义万相
 *   export GEMINI_API_KEY=你的密钥        # Gemini
 *   export OPENROUTER_API_KEY=你的密钥    # OpenRouter
 *   node scripts/generate-bg-batch-ai.mjs           # 生成全部
 *   node scripts/generate-bg-batch-ai.mjs --list     # 列出场景
 *   node scripts/generate-bg-batch-ai.mjs --only 直播间  # 只生成指定场景
 *   node scripts/generate-bg-batch-ai.mjs --force    # 覆盖已有
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BG_DIR = join(ROOT, "..", "a股", "素材", "背景");

const SCENES = [
  {
    name: "证券交易所",
    zh: "简约卡通风格2D场景插画，证券交易所交易大厅内部，多个大型LED屏幕显示K线图和股票数据，红绿色调的电子屏，交易台。扁平卡通风格，明亮鲜艳配色，画面底部40%留空白地面区域，不要出现任何人物角色。竖版构图。",
    en: "Cartoon-style 2D scene illustration, stock exchange trading hall interior, multiple large LED screens showing K-line charts and stock data, red/green color theme, trading desks. Flat cartoon style, bright colorful palette, bottom 40% clear floor area, NO people. Vertical portrait orientation.",
  },
  {
    name: "办公室茶水间",
    zh: "简约卡通风格2D场景插画，公司茶水间休息区，有饮水机咖啡机白色小圆桌和椅子，墙上有股票走势海报，绿植盆栽。扁平卡通风格，明亮配色，画面底部40%留空白地面，不要出现人物。竖版构图。",
    en: "Cartoon-style 2D scene illustration, modern office break room/pantry, water cooler, coffee machine, white round tables with chairs, stock market posters on wall, potted plants. Flat cartoon style, bright cheerful colors, bottom 40% clear floor area, NO people. Vertical portrait.",
  },
  {
    name: "烧烤摊",
    zh: "简约卡通风格2D场景插画，中国路边烧烤摊夜景，红色帐篷串串架子啤酒瓶塑料凳，彩色灯泡串，烟雾缭绕。扁平卡通风格，暖色调，画面底部40%留空白地面，不要出现人物。竖版构图。",
    en: "Cartoon-style 2D scene illustration, Chinese street BBQ food stall at night, red tent/awning, BBQ grill with skewers, string lights, beer bottles, plastic stools, smoke rising. Flat cartoon style, warm cozy colors, bottom 40% clear ground area, NO people. Vertical portrait.",
  },
  {
    name: "天台夜景",
    zh: "简约卡通风格2D场景插画，城市高楼天台黄昏场景，远处城市天际线和晚霞，近处有栏杆和花盆，星星开始出现。扁平卡通风格，橙紫色调，画面底部40%留空白地面，不要出现人物。竖版构图。",
    en: "Cartoon-style 2D scene illustration, city rooftop at sunset/dusk, city skyline with skyscrapers in background, rooftop railing, potted plants, sunset glow, stars appearing. Flat cartoon style, purple-orange gradient sky, bottom 40% clear rooftop floor, NO people. Vertical portrait.",
  },
  {
    name: "网吧",
    zh: "简约卡通风格2D场景插画，中国网吧内部，一排排电脑桌椅，显示器亮着蓝光，零食和可乐，霓虹灯光。扁平卡通风格，蓝色调偏暗，画面底部40%留空白地面，不要出现人物。竖版构图。",
    en: "Cartoon-style 2D scene illustration, Chinese internet cafe interior, rows of computer desks and chairs, glowing monitors with blue light, snack bags and cola cans, neon lighting. Flat cartoon style, blue-tinted, bottom 40% clear floor area, NO people. Vertical portrait.",
  },
  {
    name: "公园长椅",
    zh: "简约卡通风格2D场景插画，城市公园里的长椅旁，绿树鲜花小湖，阳光明媚蓝天白云，路灯鸟儿。扁平卡通风格，绿色调明亮配色，画面底部40%留空白地面，不要出现人物。竖版构图。",
    en: "Cartoon-style 2D scene illustration, city park with bench, green trees and flowers, small lake, sunny sky with fluffy clouds, lamp posts, birds. Flat cartoon style, green bright colors, bottom 40% clear grass/path area, NO people. Vertical portrait.",
  },
  {
    name: "股票直播间",
    zh: "简约卡通风格2D场景插画，财经直播间内部，背景墙多个大屏幕显示股票K线和财经数据，桌子和麦克风，LIVE标志，红色主调。扁平卡通风格，画面底部40%留空白地面，不要出现人物。竖版构图。",
    en: "Cartoon-style 2D scene illustration, financial live streaming studio, multiple large screens showing stock K-line charts, LIVE indicator, broadcast desk with microphones, studio lighting, red accent colors. Flat cartoon style, bottom 40% clear floor area, NO people. Vertical portrait.",
  },
  {
    name: "奶茶店",
    zh: "简约卡通风格2D场景插画，网红奶茶店内部，吧台菜单牌彩色奶茶杯可爱装饰，粉色ins风，仙女灯串。扁平卡通风格，粉色暖色调，画面底部40%留空白地面，不要出现人物。竖版构图。",
    en: "Cartoon-style 2D scene illustration, trendy bubble tea shop interior, counter with menu board, colorful drink cups with straws, cute decorations, pink walls, fairy lights. Flat cartoon style, pink/pastel, bottom 40% clear floor area, NO people. Vertical portrait.",
  },
];

// === MiniMax (image-01, 每日免费额度) ===
async function minimaxGenerate(apiKey, prompt, outputPath) {
  const res = await fetch("https://api.minimaxi.com/v1/image_generation", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "image-01",
      prompt,
      aspect_ratio: "9:16",
      response_format: "base64",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MiniMax ${res.status}: ${err.slice(0, 150)}`);
  }

  const data = await res.json();
  const images = data.data?.image_base64;
  if (images && images.length > 0) {
    const buffer = Buffer.from(images[0], "base64");
    writeFileSync(outputPath, buffer);
    return { ok: true, provider: "MiniMax/image-01", size: buffer.length };
  }

  throw new Error("MiniMax 无图片返回");
}

// === DashScope 通义万相 ===
async function dashscopeGenerate(apiKey, prompt, outputPath) {
  // 创建任务
  const createResp = await fetch(
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-DashScope-Async": "enable",
      },
      body: JSON.stringify({
        model: "wanx2.1-t2i-turbo",
        input: { prompt },
        parameters: { size: "768*1344", n: 1 },
      }),
    }
  );
  const createData = await createResp.json();
  if (createData.code) throw new Error(createData.message || createData.code);
  const taskId = createData.output.task_id;

  // 轮询
  const maxWait = 180000;
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    await new Promise((r) => setTimeout(r, 3000));
    const pollResp = await fetch(
      `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    const pollData = await pollResp.json();
    const status = pollData.output?.task_status;
    if (status === "SUCCEEDED") {
      const url = pollData.output?.results?.[0]?.url;
      if (!url) throw new Error("没有返回图片URL");
      const imgResp = await fetch(url);
      const buffer = Buffer.from(await imgResp.arrayBuffer());
      writeFileSync(outputPath, buffer);
      return { ok: true, provider: "DashScope", size: buffer.length };
    }
    if (status === "FAILED")
      throw new Error(pollData.output?.message || "任务失败");
    process.stdout.write(".");
  }
  throw new Error("超时");
}

// === Gemini ===
async function geminiGenerate(apiKey, prompt, outputPath) {
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey });

  const models = [
    "imagen-4.0-fast-generate-001",
    "imagen-4.0-generate-001",
  ];
  for (const model of models) {
    try {
      const response = await ai.models.generateImages({
        model,
        prompt,
        config: { numberOfImages: 1, aspectRatio: "9:16" },
      });
      if (response.generatedImages?.[0]?.image?.imageBytes) {
        const buffer = Buffer.from(
          response.generatedImages[0].image.imageBytes,
          "base64"
        );
        writeFileSync(outputPath, buffer);
        return { ok: true, provider: `Gemini/${model}`, size: buffer.length };
      }
    } catch {}
  }

  const flashModels = [
    "gemini-2.0-flash-exp-image-generation",
    "gemini-2.5-flash-image",
  ];
  for (const model of flashModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { responseModalities: ["TEXT", "IMAGE"] },
      });
      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.mimeType?.startsWith("image/")) {
          const buffer = Buffer.from(part.inlineData.data, "base64");
          writeFileSync(outputPath, buffer);
          return {
            ok: true,
            provider: `Gemini/${model}`,
            size: buffer.length,
          };
        }
      }
    } catch {}
  }

  throw new Error("Gemini 所有模型均失败");
}

// === OpenRouter (google/gemini-2.5-flash-image) ===
async function openrouterGenerate(apiKey, prompt, outputPath) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [{ role: "user", content: `Generate an image: ${prompt}` }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${err.slice(0, 100)}`);
  }

  const data = await res.json();
  const message = data.choices?.[0]?.message;

  // 格式1: message.images[] (OpenRouter Gemini 图片模型返回格式)
  if (message?.images?.length > 0) {
    for (const img of message.images) {
      const url = img.image_url?.url || img.url;
      if (url?.startsWith("data:image/")) {
        const b64 = url.replace(/^data:image\/[^;]+;base64,/, "");
        const buffer = Buffer.from(b64, "base64");
        writeFileSync(outputPath, buffer);
        return { ok: true, provider: "OpenRouter/Gemini", size: buffer.length };
      }
    }
  }

  // 格式2: content 中包含 base64 数据
  const content = message?.content;
  if (content) {
    const match = content.match(/data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/);
    if (match) {
      const buffer = Buffer.from(match[1], "base64");
      writeFileSync(outputPath, buffer);
      return { ok: true, provider: "OpenRouter/Gemini", size: buffer.length };
    }

    const urlMatch = content.match(/https?:\/\/[^\s"']+\.(png|jpg|jpeg|webp)/i);
    if (urlMatch) {
      const imgRes = await fetch(urlMatch[0]);
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      writeFileSync(outputPath, buffer);
      return { ok: true, provider: "OpenRouter/Gemini", size: buffer.length };
    }
  }

  throw new Error("OpenRouter 无图片返回");
}

// === 主程序 ===
const args = process.argv.slice(2);

if (args.includes("--list")) {
  SCENES.forEach((s, i) => console.log(`  ${i + 1}. ${s.name}`));
  process.exit(0);
}

const minimaxKey = process.env.MINIMAX_API_KEY;
const dashKey = process.env.DASHSCOPE_API_KEY;
const geminiKey = process.env.GEMINI_API_KEY;
const openrouterKey = process.env.OPENROUTER_API_KEY;

if (!minimaxKey && !dashKey && !geminiKey && !openrouterKey) {
  console.error("请至少设置一个 API Key:");
  console.error("  export MINIMAX_API_KEY=你的密钥       (MiniMax，每日免费额度，推荐)");
  console.error("  export DASHSCOPE_API_KEY=你的密钥     (通义万相)");
  console.error("  export GEMINI_API_KEY=你的密钥        (Gemini)");
  console.error("  export OPENROUTER_API_KEY=你的密钥    (OpenRouter)");
  process.exit(1);
}

const providers = [minimaxKey && "MiniMax", dashKey && "DashScope", geminiKey && "Gemini", openrouterKey && "OpenRouter"].filter(Boolean);
console.log(`API: ${providers.join(" + ")}`);

mkdirSync(BG_DIR, { recursive: true });

const onlyIdx = args.indexOf("--only");
const onlyName = onlyIdx >= 0 ? args[onlyIdx + 1] : null;
const scenes = onlyName
  ? SCENES.filter((s) => s.name.includes(onlyName))
  : SCENES;

if (scenes.length === 0) {
  console.error(`找不到包含 "${onlyName}" 的场景`);
  process.exit(1);
}

console.log(`\n=== 批量生成背景 (${scenes.length} 张) ===\n`);

let done = 0;
let failed = 0;

for (const scene of scenes) {
  const outputPath = join(BG_DIR, `${scene.name}.png`);
  if (existsSync(outputPath) && !args.includes("--force")) {
    console.log(`  [跳过] ${scene.name}.png 已存在 (用 --force 覆盖)`);
    done++;
    continue;
  }

  process.stdout.write(`  [生成] ${scene.name}`);

  // 按优先级尝试: MiniMax -> DashScope -> Gemini -> OpenRouter
  const generators = [];
  if (minimaxKey) generators.push({ fn: () => minimaxGenerate(minimaxKey, scene.zh, outputPath), name: "MiniMax" });
  if (dashKey) generators.push({ fn: () => dashscopeGenerate(dashKey, scene.zh, outputPath), name: "DashScope" });
  if (geminiKey) generators.push({ fn: () => geminiGenerate(geminiKey, scene.en, outputPath), name: "Gemini" });
  if (openrouterKey) generators.push({ fn: () => openrouterGenerate(openrouterKey, scene.en, outputPath), name: "OpenRouter" });

  let ok = false;
  for (const gen of generators) {
    try {
      const result = await gen.fn();
      console.log(` -> ${result.provider}, ${(result.size / 1024).toFixed(0)} KB`);
      done++;
      ok = true;
      break;
    } catch (err) {
      process.stdout.write(` [${gen.name}失败]`);
    }
  }
  if (!ok) {
    console.log(` 全部失败`);
    failed++;
  }

  // 避免限流
  if (scenes.indexOf(scene) < scenes.length - 1) {
    await new Promise((r) => setTimeout(r, 3000));
  }
}

console.log(`\n=== 完成: ${done} 成功, ${failed} 失败 ===`);
