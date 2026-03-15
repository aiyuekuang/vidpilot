// Available expressions for panda characters
export type Expression =
  | "default"     // 默认微笑
  | "smile"       // 开心
  | "laugh"       // 大笑
  | "smug"        // 得意/邪笑
  | "shocked"     // 震惊
  | "angry"       // 愤怒
  | "cry"         // 哭泣
  | "speechless"  // 无语
  | "confused"    // 疑惑
  | "contempt"    // 鄙视
  | "shy"         // 害羞
  | "excited"     // 兴奋
  | "despair"     // 绝望
  | "evil"        // 坏笑

export interface DialogueLine {
  speaker: "left" | "right";
  text: string;
  duration: number; // in frames (30fps)
  expression?: Expression; // speaker's expression
  listenerExpression?: Expression; // other character's reaction
}

export interface CharacterConfig {
  name: string;
  image: string; // filename in public/ (e.g., "char-韭菜.png")
  imageWidth: number; // original image width
  imageHeight: number; // original image height
  faceCenter: { x: number; y: number; radius: number }; // face position in original pixels
}

export interface DialogueProps {
  dialogue: DialogueLine[];
  leftCharacter: CharacterConfig;
  rightCharacter: CharacterConfig;
  backgroundImage?: string;
}

// ── PPT 幻灯片系列 ──────────────────────────────────────────

export type SlideLayout =
  | "cover"    // 封面：大标题 + 副标题
  | "content"  // 内容：标题 + 要点列表
  | "data"     // 数据：标题 + 大数字 + 说明
  | "quote"    // 引用：大段引用文字
  | "split"    // 左右分栏：标题左 + 要点右
  | "end";     // 结尾：总结 + 互动引导

export interface Slide {
  layout: SlideLayout;
  title: string;
  subtitle?: string;          // cover / end 用
  points?: string[];          // content / split 用
  stat?: string;              // data 用，大数字，如 "12×"
  statLabel?: string;         // data 用，数字说明
  quote?: string;             // quote 用
  emoji?: string;             // 装饰 emoji
  accent?: string;            // 强调色，默认使用主题色
  narration: string;          // 旁白文本（TTS 朗读）
  duration: number;           // 帧数（音频生成后回写）
}

export interface SlideshowProps {
  slides?: Slide[];
  theme?: "dark" | "tech" | "warm";
  title?: string;             // 视频顶部水印标题
}

// ── 排行榜/数据对比系列 ──────────────────────────────────────

export interface RankItem {
  label: string;              // 名称，如 "GPT-4o"
  value: number;              // 数值，如 92.3
  unit?: string;              // 单位，如 "分" "%"
  icon?: string;              // emoji 图标
  color?: string;             // 柱状图颜色
  note?: string;              // 注释，如 "OpenAI"
}

export interface RankSlide {
  title: string;              // 该页标题
  items: RankItem[];          // 排行数据（按 value 降序）
  narration: string;          // 旁白文本
  duration: number;           // 帧数
  maxValue?: number;          // 柱状图最大值（默认自动）
}

export interface RankingProps {
  slides?: RankSlide[];
  theme?: "dark" | "tech" | "warm";
  title?: string;
}

// ── 代码演示系列 ─────────────────────────────────────────────

export interface CodeStep {
  code: string;               // 代码文本
  language: string;           // 语言，如 "typescript" "python"
  highlight?: number[];       // 高亮行号（从1开始）
  comment?: string;           // 右侧/下方注释气泡
  narration: string;          // 旁白文本
  duration: number;           // 帧数
  title?: string;             // 步骤标题
}

export interface CodeDemoProps {
  steps?: CodeStep[];
  theme?: "dark" | "tech";
  title?: string;
}

// ── 图文解说系列 ─────────────────────────────────────────────

export interface NarrationSegment {
  image?: string;             // 图片文件名（public/ 下），可选
  video?: string;             // 视频文件名（public/ 下），可选，优先于 image
  text: string;               // 画面文字，用 **关键词** 标记高亮
  subtitle?: string;          // 副标题/来源
  narration: string;          // 旁白文本
  duration: number;           // 帧数
  effect?: "kenburns" | "fadeIn" | "zoomIn";  // 图片/视频动效
}

export interface NarrationProps {
  segments?: NarrationSegment[];
  theme?: "dark" | "tech" | "warm";
  title?: string;
  bgm?: string;  // BGM filename in public/music/ (e.g., "tech-ambient.wav")
}

// ── 账号配置 ─────────────────────────────────────────────────

export type ThemeName = "dark" | "tech" | "warm";

export interface AccountConfig {
  id: string;                   // 唯一标识，如 "laodong" "stock"
  name: string;                 // 显示名称/水印，如 "程序员老东"
  outputDir: string;            // 归档根目录
  leftCharacter: CharacterConfig;
  rightCharacter: CharacterConfig;
  backgroundImage: string;      // 对话动画背景图
  bgm: string;                  // BGM 文件名（public/music/ 下），空字符串=无BGM
  defaultTheme: ThemeName;      // 默认主题
  voiceSeeds: {
    left: number;               // 左角色 ChatTTS seed
    right: number;              // 右角色 ChatTTS seed
    narrator: number;           // 旁白 seed（幻灯片/排行榜/代码/图文）
  };
  // 支持的视频格式（不配置则支持全部）
  formats?: Array<"dialogue" | "slides" | "ranking" | "code" | "narration" | "article">;
}
