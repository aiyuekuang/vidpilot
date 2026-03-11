import { Slide } from "../../types";

// [ai_slides] 示例模板 -- 每次运行会被 skill 覆盖

export const slides: Slide[] = [
  {
    layout: "cover",
    title: "AI 幻灯片示例",
    subtitle: "由程序员老东出品",
    emoji: "🤖",
    narration: "大家好，我是程序员老东，今天给大家聊一个有意思的话题。",
    duration: 90,
  },
  {
    layout: "end",
    title: "你学到了吗？",
    subtitle: "评论区告诉我",
    emoji: "💬",
    narration: "好了，今天就聊到这里，觉得有用的话记得点赞关注，评论区告诉我你的看法！",
    duration: 120,
  },
];

export const theme = "dark" as const;
