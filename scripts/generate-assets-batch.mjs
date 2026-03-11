#!/usr/bin/env node
/**
 * 批量生成固定素材（背景 + 角色）
 *
 * 用法：
 *   export DASHSCOPE_API_KEY=你的密钥
 *   node scripts/generate-assets-batch.mjs               # 生成全部
 *   node scripts/generate-assets-batch.mjs --bg-only      # 只生成背景
 *   node scripts/generate-assets-batch.mjs --char-only    # 只生成角色
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ASSETS_DIR = join(ROOT, "..", "a股", "素材");
const BG_DIR = join(ASSETS_DIR, "背景");
const CHAR_DIR = join(ASSETS_DIR, "人物");

const apiKey = process.env.DASHSCOPE_API_KEY;
if (!apiKey) {
  console.error("请设置 DASHSCOPE_API_KEY 环境变量");
  process.exit(1);
}

// === 背景场景列表 ===
const BG_SCENES = [
  { name: "证券交易所", prompt: "简约卡通风格2D场景插画，证券交易所交易大厅内部，大屏幕显示K线和数字，红绿色调的电子屏。扁平卡通风格，明亮配色，画面底部40%留空白地面区域，不要出现人物。竖版构图，适合手机屏幕。" },
  { name: "办公室茶水间", prompt: "简约卡通风格2D场景插画，公司茶水间休息区，有饮水机、咖啡机、白色小圆桌和椅子，墙上有股票走势海报。扁平卡通风格，明亮配色，画面底部40%留空白地面，不要出现人物。竖版构图。" },
  { name: "烧烤摊", prompt: "简约卡通风格2D场景插画，中国路边烧烤摊夜景，有红色帐篷、串串架子、啤酒瓶、塑料凳。扁平卡通风格，暖色调，画面底部40%留空白地面，不要出现人物。竖版构图。" },
  { name: "天台", prompt: "简约卡通风格2D场景插画，城市高楼天台黄昏场景，远处有城市天际线和晚霞，近处有栏杆和花盆。扁平卡通风格，橙紫色调，画面底部40%留空白地面，不要出现人物。竖版构图。" },
  { name: "网吧", prompt: "简约卡通风格2D场景插画，中国网吧内部，一排排电脑桌椅，显示器亮着蓝光，有零食和可乐。扁平卡通风格，蓝色调偏暗，画面底部40%留空白地面，不要出现人物。竖版构图。" },
  { name: "公园长椅", prompt: "简约卡通风格2D场景插画，城市公园里的长椅旁，有绿树鲜花和小湖，阳光明媚。扁平卡通风格，绿色调明亮配色，画面底部40%留空白地面，不要出现人物。竖版构图。" },
  { name: "奶茶店", prompt: "简约卡通风格2D场景插画，网红奶茶店内部，有吧台菜单牌和可爱装饰，粉色ins风。扁平卡通风格，粉色暖色调，画面底部40%留空白地面，不要出现人物。竖版构图。" },
  { name: "股票直播间", prompt: "简约卡通风格2D场景插画，财经直播间内部，背景墙有多个大屏幕显示股票K线和财经数据，有桌子和麦克风。扁平卡通风格，红色主调，画面底部40%留空白地面，不要出现人物。竖版构图。" },
];

// === 角色列表 ===
const CHAR_SCENES = [
  { name: "小韭-兴奋", prompt: "沙雕表情包风格卡通角色，一个年轻散户男生，头发竖起像韭菜叶子，穿绿色T恤，表情兴奋激动，眼睛放光，张大嘴笑。大头小身Q版比例，白色背景，PNG透明底。全身像，正面朝前。" },
  { name: "小韭-崩溃", prompt: "沙雕表情包风格卡通角色，一个年轻散户男生，头发竖起像韭菜叶子，穿绿色T恤，表情崩溃哭泣，嘴巴大张哭嚎。大头小身Q版比例，白色背景，PNG透明底。全身像，正面朝前。" },
  { name: "小韭-得意", prompt: "沙雕表情包风格卡通角色，一个年轻散户男生，头发竖起像韭菜叶子，穿绿色T恤，表情得意洋洋，翘起嘴角，手叉腰。大头小身Q版比例，白色背景，PNG透明底。全身像，正面朝前。" },
  { name: "老庄-淡定", prompt: "沙雕表情包风格卡通角色，一个中年庄家男人，戴墨镜穿黑色西装，表情淡定冷漠，双手抱胸。大头小身Q版比例，白色背景，PNG透明底。全身像，正面朝前。" },
  { name: "老庄-坏笑", prompt: "沙雕表情包风格卡通角色，一个中年庄家男人，戴墨镜穿黑色西装，表情坏笑阴险，搓手。大头小身Q版比例，白色背景，PNG透明底。全身像，正面朝前。" },
  { name: "老庄-叹气", prompt: "沙雕表情包风格卡通角色，一个中年庄家男人，戴墨镜穿黑色西装，表情无奈叹气，摇头摆手。大头小身Q版比例，白色背景，PNG透明底。全身像，正面朝前。" },
];

async function createTask(prompt, size = "768*1344") {
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
        parameters: { size, n: 1 },
      }),
    }
  );
  const data = await resp.json();
  if (data.code) throw new Error(`创建任务失败: ${data.code} - ${data.message}`);
  return data.output.task_id;
}

async function pollTask(taskId) {
  const maxWait = 180000;
  const interval = 3000;
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    const resp = await fetch(
      `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    const data = await resp.json();
    const status = data.output?.task_status;
    if (status === "SUCCEEDED") {
      const url = data.output?.results?.[0]?.url;
      if (url) return url;
      throw new Error("没有返回图片URL");
    }
    if (status === "FAILED") throw new Error(`任务失败: ${data.output?.message}`);
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error("超时");
}

async function downloadImage(url, outputPath) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`下载失败: ${resp.status}`);
  const buffer = Buffer.from(await resp.arrayBuffer());
  writeFileSync(outputPath, buffer);
}

async function generateOne(name, prompt, outputDir, size) {
  const outputPath = join(outputDir, `${name}.png`);
  if (existsSync(outputPath)) {
    console.log(`  [跳过] ${name}.png 已存在`);
    return;
  }
  try {
    process.stdout.write(`  [生成] ${name}...`);
    const taskId = await createTask(prompt, size);
    const url = await pollTask(taskId);
    await downloadImage(url, outputPath);
    console.log(` 完成`);
  } catch (err) {
    console.log(` 失败: ${err.message}`);
  }
}

// === 主程序 ===
const args = process.argv.slice(2);
const bgOnly = args.includes("--bg-only");
const charOnly = args.includes("--char-only");

mkdirSync(BG_DIR, { recursive: true });
mkdirSync(CHAR_DIR, { recursive: true });

if (!charOnly) {
  console.log(`\n=== 生成背景素材 (${BG_SCENES.length} 张) ===`);
  for (const scene of BG_SCENES) {
    await generateOne(scene.name, scene.prompt, BG_DIR, "768*1344");
  }
}

if (!bgOnly) {
  console.log(`\n=== 生成角色素材 (${CHAR_SCENES.length} 张) ===`);
  for (const char of CHAR_SCENES) {
    await generateOne(char.name, char.prompt, CHAR_DIR, "768*1344");
  }
}

console.log("\n=== 全部完成 ===");
