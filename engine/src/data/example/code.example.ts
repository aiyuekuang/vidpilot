import { CodeStep } from "../../types";

// [ai_code] 示例模板 -- 每次运行会被 skill 覆盖

export const codeSteps: CodeStep[] = [
  {
    title: "一行命令安装 Claude Code",
    code: `# 全局安装 Claude Code CLI
npm install -g @anthropic-ai/claude-code

# 进入你的项目目录
cd my-project

# 启动 Claude Code
claude`,
    language: "bash",
    highlight: [2],
    comment: "npm 全局安装，哪个目录都能用",
    narration: "第一步，安装非常简单，一行npm命令搞定。装好之后cd到你的项目目录，输入claude就启动了。",
    duration: 150,
  },
  {
    title: "让 AI 帮你写代码",
    code: `// 在 Claude Code 里直接说需求：
// "帮我写一个用户登录接口"

import express from "express";
import bcrypt from "bcrypt";

const router = express.Router();

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findByEmail(email);
  const valid = await bcrypt.compare(
    password, user.passwordHash
  );
  res.json({ token: generateJWT(user) });
});`,
    language: "typescript",
    highlight: [10, 11, 12, 13, 14],
    comment: "AI 自动生成完整的登录逻辑，包括密码校验",
    narration: "你只要用自然语言描述需求，它就能生成完整代码。比如说帮我写一个登录接口，它会自动处理密码哈希和JWT。",
    duration: 180,
  },
];

export const theme = "dark" as const;
