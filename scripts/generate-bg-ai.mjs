#!/usr/bin/env node
/**
 * 用 Gemini AI 生成沙雕对话风格的卡通场景背景图 (1080x1920)
 *
 * 环境变量:
 *   GEMINI_API_KEY=你的密钥
 *
 * 用法:
 *   node scripts/generate-bg-ai.mjs --scene "证券交易所大厅" --title "三桶油集体涨停"
 *   node scripts/generate-bg-ai.mjs --scene "医院病房" --title "医药股暴涨"
 *   node scripts/generate-bg-ai.mjs --scene "办公室" --title "互联网大裁员"
 *
 * 输出: public/bg-today.png
 */

import { GoogleGenAI } from "@google/genai";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    scene: "证券交易所交易大厅",
    title: "",
    style: "cartoon",
    output: join(ROOT, "public", "bg-today.png"),
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--scene" && args[i + 1]) result.scene = args[++i];
    else if (args[i] === "--title" && args[i + 1]) result.title = args[++i];
    else if (args[i] === "--style" && args[i + 1]) result.style = args[++i];
    else if (args[i] === "--output" && args[i + 1]) result.output = args[++i];
  }
  return result;
}

// 场景提示词模板
function buildPrompt(scene, title, style) {
  const basePrompt = `Generate a cartoon-style 2D background illustration. The scene is: ${scene}.

Style requirements:
- Simple flat cartoon style, like Chinese internet meme animation (沙雕动画) backgrounds
- Clean solid colors with gentle gradients, hand-drawn look
- Include furniture, decorations and environmental details appropriate for the scene
- Bright and colorful palette, NOT dark or gloomy
- NO characters or people in the scene - just the empty environment/room
- Vertical portrait orientation (taller than wide, like a phone screen)
- The bottom 40% of the image should be a clear floor/ground area (characters will be placed there)
- The top area should have interesting scene details (windows, screens, shelves, etc.)
- Simple black outlines on major objects
- Slightly exaggerated proportions for comedic effect`;

  if (title) {
    return `${basePrompt}\n\nThe background should visually relate to this topic: "${title}". Add relevant visual elements that hint at this theme.`;
  }

  return basePrompt;
}

async function generateWithGemini(prompt, outputPath) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ 请设置环境变量 GEMINI_API_KEY");
    console.error("   export GEMINI_API_KEY=你的密钥");
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey });

  console.log("🤖 调用 Gemini 生成图片...");

  // 按优先级尝试不同模型
  const imageModels = [
    "imagen-4.0-fast-generate-001",
    "imagen-4.0-generate-001",
  ];

  for (const model of imageModels) {
    try {
      console.log(`  尝试 ${model}...`);
      const response = await ai.models.generateImages({
        model,
        prompt,
        config: {
          numberOfImages: 1,
          aspectRatio: "9:16",
        },
      });

      if (response.generatedImages && response.generatedImages.length > 0) {
        const imageData = response.generatedImages[0].image;
        if (imageData.imageBytes) {
          const buffer = Buffer.from(imageData.imageBytes, "base64");
          writeFileSync(outputPath, buffer);
          console.log(`✅ 背景图已保存 (via ${model}): ${outputPath}`);
          return true;
        }
      }
    } catch (err) {
      console.log(`  ⚠️  ${model} 失败: ${err.message?.slice(0, 100)}`);
    }
  }

  // Fallback: Gemini Flash 内联图片生成
  const flashModels = [
    "gemini-2.0-flash-exp-image-generation",
    "gemini-2.5-flash-image",
  ];

  for (const model of flashModels) {
    try {
      console.log(`  尝试 ${model}...`);
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      });

      if (response.candidates && response.candidates[0]) {
        const parts = response.candidates[0].content.parts;
        for (const part of parts) {
          if (part.inlineData && part.inlineData.mimeType?.startsWith("image/")) {
            const buffer = Buffer.from(part.inlineData.data, "base64");
            writeFileSync(outputPath, buffer);
            console.log(`✅ 背景图已保存 (via ${model}): ${outputPath}`);
            return true;
          }
        }
      }
    } catch (err) {
      console.log(`  ⚠️  ${model} 失败: ${err.message?.slice(0, 100)}`);
    }
  }

  console.error("❌ 所有模型均失败");
  return false;
}

// === 主程序 ===
const config = parseArgs();
mkdirSync(join(ROOT, "public"), { recursive: true });

console.log(`🎨 AI 背景图生成`);
console.log(`   场景: ${config.scene}`);
if (config.title) console.log(`   主题: ${config.title}`);

const prompt = buildPrompt(config.scene, config.title, config.style);
console.log(`\n📝 Prompt:\n${prompt.slice(0, 200)}...\n`);

const success = await generateWithGemini(prompt, config.output);

if (!success) {
  console.log("\n💡 提示：如果 API 调用失败，可以：");
  console.log("   1. 检查 GEMINI_API_KEY 是否正确");
  console.log("   2. 确认 API 配额是否充足");
  console.log("   3. 使用 fallback: node scripts/generate-bg.mjs --title '标题' --theme red");
}
