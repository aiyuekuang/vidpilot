import asyncio
from pathlib import Path

from conf import BASE_DIR
from uploader.douyin_article_uploader.main import douyin_setup, DouYinArticle


TITLE = "OpenClaw vs Claude CLI：两款 AI 编程助手深度对比"

CONTENT = """程序员们，你们还在用传统 IDE 写代码？2025 年了，AI 编程助手已经进化到可以直接在终端帮你干活了。今天来聊聊两款最火的 AI CLI 工具：OpenClaw 和 Claude CLI（即 Claude Code）。

【它们是什么？】

Claude CLI 是 Anthropic 官方出品的命令行工具，也就是我们熟知的 Claude Code。你可以直接在终端里让 Claude 读代码、改 Bug、写功能，就像一个真人程序员坐在你旁边帮你干活。

OpenClaw 则是社区基于 Claude API 打造的开源替代品，它模仿了 Claude Code 的交互体验，但提供了更高的自定义空间和更低的使用成本，支持接入多种 AI 后端。

【核心功能对比】

✅ 代码理解能力
两款工具都能读懂整个项目结构，但 Claude CLI 背靠 Anthropic 官方模型，理解复杂业务逻辑的准确率略胜一筹。OpenClaw 支持切换不同模型，灵活性更高。

✅ 多文件编辑
Claude CLI 可以同时修改多个文件，自动处理跨文件的依赖关系。OpenClaw 同样支持，但部分操作需要手动确认，更安全但也更慢。

✅ 终端命令执行
Claude CLI 可以直接运行 bash 命令、跑测试、安装依赖。OpenClaw 的权限控制更细，默认需要确认，适合对安全性要求高的场景。

✅ 上下文窗口
Claude CLI 支持 200K token 的超大上下文，可以把整个大型项目塞进去分析。OpenClaw 上下文大小取决于你接入的模型。

【使用成本】

Claude CLI：按 API 用量计费，重度使用每月大概 $20-100 不等，也有 Pro 订阅版本。

OpenClaw：开源免费，但你需要自己准备 API Key（支持 Claude、GPT-4 等多种模型）。如果用的是免费或便宜的模型，成本可以大幅降低。

【适合谁用？】

👨‍💻 选 Claude CLI（Claude Code）如果你：
- 想要开箱即用，不想折腾配置
- 对代码质量要求极高
- 是专业开发者，愿意为最好的体验付费

🛠️ 选 OpenClaw 如果你：
- 热爱开源和自定义
- 想灵活切换不同 AI 模型
- 对成本敏感，或想在本地部署
- 喜欢研究 AI 工具的底层原理

【结语】

两款工具都代表了 AI 编程助手的未来方向。Claude CLI 更像是"买了即用的豪华轿车"，而 OpenClaw 是"可以随便改装的越野车"。没有最好的，只有最适合你的。

你更喜欢哪一款？评论区告诉我！

#AI编程 #Claude #程序员 #开发工具 #人工智能
"""

TAGS = ["AI编程", "Claude", "程序员", "开发工具"]


if __name__ == '__main__':
    account_file = Path(BASE_DIR / "cookies" / "douyin_uploader" / "account.json")

    cookie_setup = asyncio.run(douyin_setup(account_file, handle=True))
    if not cookie_setup:
        print("登录失败，请重试")
        exit(1)

    app = DouYinArticle(
        title=TITLE,
        content=CONTENT,
        tags=TAGS,
        summary='OpenClaw与Claude CLI深度对比，帮你选对AI编程助手',
        publish_date=0,
        account_file=account_file,
        auto_publish=False,  # 测试阶段：填好内容后暂存，不自动发布
    )
    asyncio.run(app.main(), debug=False)
