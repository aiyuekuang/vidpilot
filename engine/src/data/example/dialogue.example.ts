import { DialogueLine } from "../../types";

// [小螃蟹融资近亿] 2026-03-11
// NoDesk AI 春节两周做出小螃蟹AI桌宠，融资近亿元（来源：36kr）

export const dialogue: DialogueLine[] = [
  { speaker: "left",  text: "老王！有家公司春节两周就融了近亿！",         duration: 115, expression: "shocked",    listenerExpression: "smug" },
  { speaker: "right", text: "就是那个爬在桌面上的小螃蟹AI桌宠吧。",       duration: 151, expression: "smug",       listenerExpression: "confused" },
  { speaker: "left",  text: "你早就知道了？！这是今天的抖音热榜！",        duration: 128, expression: "confused",   listenerExpression: "default" },
  { speaker: "right", text: "基于OpenClaw框架的，那个框架最近超火。",      duration: 124, expression: "default",    listenerExpression: "excited" },
  { speaker: "left",  text: "他们春节两周，从立项到上线融资全干完了！",    duration: 133, expression: "excited",    listenerExpression: "evil" },
  { speaker: "right", text: "你春节在干嘛？",                              duration: 56,  expression: "evil",       listenerExpression: "despair" },
  { speaker: "left",  text: "打游戏......但这不是重点！",                  duration: 87,  expression: "despair",    listenerExpression: "laugh" },
  { speaker: "right", text: "重点是你过年升段位，人家融了近亿。",          duration: 128, expression: "laugh",      listenerExpression: "angry" },
  { speaker: "left",  text: "那他们肯定有背景有资源，不是人人能做的！",    duration: 153, expression: "angry",      listenerExpression: "smug" },
  { speaker: "right", text: "CTO是原智谱AI的，团队60%都是00后。",          duration: 161, expression: "smug",       listenerExpression: "shocked" },
  { speaker: "left",  text: "00后！我才毕业没两年就被超车了？！",          duration: 111, expression: "shocked",    listenerExpression: "speechless" },
  { speaker: "right", text: "他们还把项目经理这个岗直接用AI替了。",        duration: 147, expression: "speechless", listenerExpression: "confused" },
  { speaker: "left",  text: "那我有优势！我本来就没有项目经理！",          duration: 125, expression: "confused",   listenerExpression: "contempt" },
  { speaker: "right", text: "因为你一个人身兼了开发和PM两个角色。",        duration: 156, expression: "contempt",   listenerExpression: "cry" },
  { speaker: "left",  text: "双倍工作量单倍工资......这才是我创业的理由！", duration: 141, expression: "cry",       listenerExpression: "evil" },
  { speaker: "right", text: "好，明年春节融到钱了记得叫我。",              duration: 102,  expression: "evil",       listenerExpression: "excited" },
  { speaker: "left",  text: "说定了！你来当我的CTO！",                     duration: 93,  expression: "excited",    listenerExpression: "smile" },
  { speaker: "right", text: "不去，我现在工资比你期权值钱多了。",          duration: 112,  expression: "smile",      listenerExpression: "despair" },
];
