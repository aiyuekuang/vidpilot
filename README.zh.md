# VidPilot

[English](README.md) | 中文

AI 驱动的短视频自动化 Skill，支持 [Claude Code](https://docs.anthropic.com/en/docs/claude-code) 和 [OpenClaw](https://github.com/OpenClaw-AI/openclaw)。

将热门话题一键转化为精彩短视频，支持 5 种视频格式，全程本地渲染，无需云端 API。

## 视频格式

| 格式 | 说明 | 适合场景 |
|------|------|---------|
| **对话** | 双角色动画对话，支持表情与音效 | 热点评论、搞笑吐槽、争议话题 |
| **幻灯片** | PPT 风格演示加旁白 | 数据解读、对比分析 |
| **排行榜** | 动态柱状图排名动画 | TOP-N 榜单、性能基准 |
| **代码演示** | 语法高亮代码 + 打字机效果 | 编程教程、API 演示 |
| **图文解说** | 图片 + 文字叠加 + 肯伯恩斯效果 | 新闻、产品发布 |

另支持**长文章**格式用于长文本内容生成。

## 快速开始

```bash
# 1. 克隆并安装
git clone https://github.com/aiyuekuang/vidpilot.git
cd vidpilot
bash install.sh

# 2. 编辑配置（install.sh 会自动从模板创建）
vim config.json

# 3. 在浏览器中预览
cd engine && npx remotion studio src/index.ts
```

## 工作原理

VidPilot 是一个 Claude Code Skill。触发后，将执行以下流水线：

1. **收集**热门话题（WebSearch / 自定义脚本）
2. **选题**并自动判断最适合的视频格式
3. **调研**话题，深度挖掘内容
4. **生成**脚本（TypeScript 数据文件）
5. **核查**事实与数据准确性
6. **渲染**：TTS 语音（ChatTTS）+ 视频（Remotion）+ 合并（FFmpeg）
7. **打包**：标题、标签、简介一并输出

## 项目结构

```
vidpilot/
├── skill.md                 # Claude Code Skill 入口
├── config.json              # 你的账号配置（已 gitignore）
├── config.example.json      # 配置模板
├── install.sh               # 一键安装脚本
├── engine/                  # Remotion 视频渲染引擎
│   ├── src/
│   │   ├── components/      # 5 种场景组件
│   │   ├── data/            # 各账号内容数据文件
│   │   │   ├── registry.ts  # 数据文件注册表
│   │   │   └── example/     # 示例数据文件
│   │   ├── accounts.ts      # 配置驱动的账号加载器
│   │   ├── types.ts         # TypeScript 类型定义
│   │   └── Root.tsx         # Remotion 合成根节点
│   └── public/              # 图片、音效资源
└── scripts/                 # TTS 语音生成脚本（Python）
    ├── config_loader.py     # 公共配置读取器
    └── generate-audio-*.py  # 每种格式对应一个脚本
```

## 多账号支持

在 `config.json` 中配置多个账号，每个账号可独立设置：
- 自定义角色图片和名称
- 独立语音种子（ChatTTS）
- 各账号专属输出目录
- 格式限制（如 stock 账号仅支持对话格式）
- 人设配置，控制内容风格

```json
{
  "accounts": {
    "my-channel": {
      "name": "我的频道",
      "outputDir": "~/Videos/my-channel",
      "formats": ["dialogue", "slides"],
      "characters": { ... },
      "voiceSeeds": { "left": 42, "right": 2024, "narrator": 2024 }
    }
  }
}
```

完整配置格式请参见 [config.example.json](config.example.json)。

## 环境要求

- **Node.js** >= 18
- **Python** >= 3.10（用于 TTS）
- **FFmpeg**（用于音频后处理和视频合并）
- **Claude Code** 或 **OpenClaw**（作为 Skill 运行器）

## 添加新账号

1. 在 `config.json` 中添加账号配置
2. 将角色图片放入 `engine/public/`
3. 创建数据目录：`engine/src/data/{accountId}/`
4. Skill 会自动生成数据文件并更新 `registry.ts`

## 自定义角色图片

角色图片建议使用透明背景的 PNG，宽约 500-700px，高约 800px。在配置中设置 `faceCenter`，以正确定位表情叠加层。

## 开源协议

MIT
