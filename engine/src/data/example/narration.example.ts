import { NarrationSegment } from "../../types";

// [ai_narration] 示例模板 -- 每次运行会被 skill 覆盖

export const segments: NarrationSegment[] = [
  {
    text: "AI 编程工具大爆发",
    subtitle: "2026年，编程方式正在被彻底改变",
    narration: "大家好，我是程序员老东。今年AI编程工具迎来了一波大爆发，整个行业都在变。",
    duration: 120,
    effect: "fadeIn",
  },
  {
    text: "Claude Code 横空出世\n一行命令，AI 帮你写完整项目",
    narration: "其中最让我惊艳的就是Claude Code，它不是简单的代码补全，而是真的能理解你整个项目，帮你从头到尾写代码。",
    duration: 150,
    effect: "kenburns",
  },
  {
    text: "你准备好了吗？",
    subtitle: "关注程序员老东，带你跟上AI时代",
    narration: "工具在进化，程序员也得进化。关注我，带你一起跟上AI编程的节奏。",
    duration: 120,
    effect: "zoomIn",
  },
];

export const theme = "dark" as const;
