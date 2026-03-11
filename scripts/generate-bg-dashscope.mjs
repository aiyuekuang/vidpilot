#!/usr/bin/env node
/**
 * 用通义万相 (DashScope) 生成沙雕对话风格的卡通场景背景图
 *
 * 环境变量:
 *   DASHSCOPE_API_KEY=你的密钥
 *
 * 用法:
 *   node scripts/generate-bg-dashscope.mjs --scene "证券交易所大厅" --title "三桶油集体涨停"
 *   node scripts/generate-bg-dashscope.mjs --scene "医院病房" --title "医药股暴涨"
 *
 * 输出: public/bg-today.png
 */

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
    output: join(ROOT, "public", "bg-today.png"),
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--scene" && args[i + 1]) result.scene = args[++i];
    else if (args[i] === "--title" && args[i + 1]) result.title = args[++i];
    else if (args[i] === "--output" && args[i + 1]) result.output = args[++i];
  }
  return result;
}

function buildPrompt(scene, title) {
  let prompt = `简约卡通风格2D场景插画，${scene}。`;
  prompt += `画面要求：简洁扁平卡通风格，类似中国网络沙雕动画的背景画风，`;
  prompt += `干净的纯色填充，手绘感线条，明亮鲜艳的配色，`;
  prompt += `包含场景中合适的家具装饰和环境细节，`;
  prompt += `画面底部40%留出空白地面区域（用于放置人物），`;
  prompt += `不要出现任何人物角色，只画空场景环境。`;
  prompt += `竖版构图，适合手机屏幕。`;

  if (title) {
    prompt += `画面主题和"${title}"相关，可以加入相关视觉元素暗示主题。`;
  }

  return prompt;
}

async function createTask(apiKey, prompt) {
  const resp = await fetch(
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
        parameters: {
          size: "768*1344",
          n: 1,
        },
      }),
    }
  );

  const data = await resp.json();

  if (data.code) {
    throw new Error(`创建任务失败: ${data.code} - ${data.message}`);
  }

  return data.output.task_id;
}

async function pollTask(apiKey, taskId) {
  const maxWait = 120000; // 2分钟
  const interval = 3000;
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    const resp = await fetch(
      `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
      }
    );
    const data = await resp.json();
    const status = data.output?.task_status;

    if (status === "SUCCEEDED") {
      const results = data.output?.results;
      if (results && results.length > 0 && results[0].url) {
        return results[0].url;
      }
      throw new Error("任务成功但没有返回图片URL");
    }

    if (status === "FAILED") {
      throw new Error(`任务失败: ${data.output?.message || JSON.stringify(data)}`);
    }

    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, interval));
  }

  throw new Error("超时：等待任务完成超过2分钟");
}

async function downloadImage(url, outputPath) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`下载失败: ${resp.status}`);
  const buffer = Buffer.from(await resp.arrayBuffer());
  writeFileSync(outputPath, buffer);
}

// === 主程序 ===
const config = parseArgs();
const apiKey = process.env.DASHSCOPE_API_KEY;

if (!apiKey) {
  console.error("❌ 请设置环境变量 DASHSCOPE_API_KEY");
  console.error("   export DASHSCOPE_API_KEY=你的密钥");
  console.error("\n   获取方式: https://dashscope.console.aliyun.com/apiKey");
  process.exit(1);
}

mkdirSync(join(ROOT, "public"), { recursive: true });

const prompt = buildPrompt(config.scene, config.title);
console.log(`🎨 通义万相背景图生成`);
console.log(`   场景: ${config.scene}`);
if (config.title) console.log(`   主题: ${config.title}`);
console.log(`\n📝 Prompt: ${prompt.slice(0, 100)}...`);

try {
  console.log("\n⏳ 创建生成任务...");
  const taskId = await createTask(apiKey, prompt);
  console.log(`   任务ID: ${taskId}`);

  process.stdout.write("⏳ 等待生成");
  const imageUrl = await pollTask(apiKey, taskId);
  console.log("\n📥 下载图片...");

  await downloadImage(imageUrl, config.output);
  console.log(`✅ 背景图已保存: ${config.output}`);
} catch (err) {
  console.error(`\n❌ ${err.message}`);
  console.log("\n💡 可能的原因:");
  console.log("   1. API Key 无效或过期");
  console.log("   2. 额度不足，去 dashscope.console.aliyun.com 检查");
  console.log("   3. 网络问题，请重试");
  process.exit(1);
}
