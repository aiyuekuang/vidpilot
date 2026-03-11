import { RankSlide } from "../../types";

// [ai_ranking] 示例模板 -- 每次运行会被 skill 覆盖

export const rankSlides: RankSlide[] = [
  {
    title: "AI 编程工具 TOP 5",
    items: [
      { label: "Claude Code", value: 95, unit: "分", icon: "🟣", note: "Anthropic" },
      { label: "Cursor", value: 88, unit: "分", icon: "🔵", note: "Anysphere" },
      { label: "GitHub Copilot", value: 82, unit: "分", icon: "⚫", note: "GitHub" },
      { label: "Windsurf", value: 78, unit: "分", icon: "🟢", note: "Codeium" },
      { label: "Cline", value: 72, unit: "分", icon: "🟡", note: "开源" },
    ],
    narration: "先看第一张榜单，AI编程工具实测排行。Claude Code凭借Agent模式拿下95分，Cursor紧随其后88分。",
    duration: 150,
  },
  {
    title: "综合评分对比",
    items: [
      { label: "代码质量", value: 92, unit: "分", icon: "📝" },
      { label: "上下文理解", value: 88, unit: "分", icon: "🧠" },
      { label: "速度", value: 75, unit: "分", icon: "⚡" },
      { label: "价格", value: 60, unit: "分", icon: "💰" },
    ],
    narration: "分项来看，代码质量和上下文理解是强项，速度还行，但价格嘛，你懂的。",
    duration: 120,
  },
];

export const theme = "tech" as const;
