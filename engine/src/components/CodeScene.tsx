import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Audio,
  Sequence,
  staticFile,
} from "remotion";
import { CodeStep, CodeDemoProps } from "../types";

const THEMES = {
  dark: {
    bg: "linear-gradient(135deg, #0d0d0d 0%, #1a1a2e 100%)",
    accent: "#7c3aed",
    editorBg: "rgba(13,13,13,0.95)",
    editorBorder: "rgba(255,255,255,0.08)",
    lineNum: "rgba(255,255,255,0.2)",
    codeFg: "rgba(255,255,255,0.85)",
    highlightBg: "rgba(124,58,237,0.15)",
    highlightBorder: "#7c3aed",
    commentBg: "rgba(124,58,237,0.9)",
    commentFg: "#ffffff",
    title: "#ffffff",
    muted: "rgba(255,255,255,0.45)",
    keyword: "#c084fc",
    string: "#86efac",
    number: "#fcd34d",
    comment: "#6b7280",
    func: "#67e8f9",
  },
  tech: {
    bg: "linear-gradient(135deg, #0f172a 0%, #0c1a3a 100%)",
    accent: "#06b6d4",
    editorBg: "rgba(15,23,42,0.95)",
    editorBorder: "rgba(6,182,212,0.15)",
    lineNum: "rgba(255,255,255,0.2)",
    codeFg: "rgba(255,255,255,0.85)",
    highlightBg: "rgba(6,182,212,0.12)",
    highlightBorder: "#06b6d4",
    commentBg: "rgba(6,182,212,0.9)",
    commentFg: "#ffffff",
    title: "#ffffff",
    muted: "rgba(255,255,255,0.45)",
    keyword: "#67e8f9",
    string: "#86efac",
    number: "#fcd34d",
    comment: "#6b7280",
    func: "#c084fc",
  },
};

// 简易语法高亮（不依赖外部库）
function tokenize(
  code: string,
  theme: typeof THEMES["dark"]
): React.ReactNode[] {
  const keywords =
    /\b(const|let|var|function|return|if|else|for|while|import|export|from|class|new|async|await|def|print|self|True|False|None|try|except|raise)\b/g;
  const strings = /(["'`])(?:(?!\1|\\).|\\.)*?\1/g;
  const comments = /(\/\/.*$|#.*$)/gm;
  const numbers = /\b(\d+\.?\d*)\b/g;
  const funcs = /\b([a-zA-Z_]\w*)\s*(?=\()/g;

  type Token = { start: number; end: number; color: string; text: string };
  const tokens: Token[] = [];

  const addMatches = (regex: RegExp, color: string) => {
    let m: RegExpExecArray | null;
    const r = new RegExp(regex.source, regex.flags);
    while ((m = r.exec(code)) !== null) {
      tokens.push({ start: m.index, end: m.index + m[0].length, color, text: m[0] });
    }
  };

  addMatches(comments, theme.comment);
  addMatches(strings, theme.string);
  addMatches(keywords, theme.keyword);
  addMatches(numbers, theme.number);
  addMatches(funcs, theme.func);

  // 按 start 排序，去重（优先级：comment > string > keyword > number > func）
  tokens.sort((a, b) => a.start - b.start);
  const used: Token[] = [];
  let lastEnd = 0;
  for (const t of tokens) {
    if (t.start >= lastEnd) {
      used.push(t);
      lastEnd = t.end;
    }
  }

  const result: React.ReactNode[] = [];
  let pos = 0;
  for (const t of used) {
    if (t.start > pos) {
      result.push(code.slice(pos, t.start));
    }
    result.push(
      <span key={t.start} style={{ color: t.color }}>
        {t.text}
      </span>
    );
    pos = t.end;
  }
  if (pos < code.length) {
    result.push(code.slice(pos));
  }
  return result;
}

// ── 单步代码渲染 ────────────────────────────────────────────
interface SingleCodeProps {
  step: CodeStep;
  localFrame: number;
  theme: typeof THEMES["dark"];
  isPortrait: boolean;
}

const SingleCode: React.FC<SingleCodeProps> = ({
  step,
  localFrame,
  theme,
  isPortrait,
}) => {
  const fs = isPortrait ? 1 : 0.7;
  const fontFamily = "PingFang SC, Noto Sans SC, Microsoft YaHei, sans-serif";
  const codeFontFamily = "SF Mono, Menlo, Consolas, monospace";

  const enterOpacity = interpolate(localFrame, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
  });
  const enterY = interpolate(
    spring({
      frame: localFrame,
      fps: 30,
      config: { damping: 18, stiffness: 120 },
      durationInFrames: 20,
    }),
    [0, 1],
    [30, 0]
  );

  const lines = step.code.split("\n");
  const highlightSet = new Set(step.highlight || []);

  // 打字机效果：逐行显示
  const totalLines = lines.length;
  const linesPerFrame = totalLines / Math.max(step.duration * 0.4, 15);
  const visibleLines = Math.min(
    totalLines,
    Math.floor(6 + localFrame * linesPerFrame)
  );

  return (
    <div
      style={{
        opacity: enterOpacity,
        transform: `translateY(${enterY}px)`,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: isPortrait ? "30px 32px" : "20px 40px",
      }}
    >
      {/* 步骤标题 */}
      {step.title && (
        <div
          style={{
            fontSize: fs * 32,
            fontWeight: 800,
            color: theme.title,
            fontFamily,
            marginBottom: 20,
            lineHeight: 1.3,
          }}
        >
          {step.title}
        </div>
      )}

      {/* 编辑器窗口 */}
      <div
        style={{
          flex: 1,
          background: theme.editorBg,
          borderRadius: 16,
          border: `1px solid ${theme.editorBorder}`,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* 窗口标题栏 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 16px",
            borderBottom: `1px solid ${theme.editorBorder}`,
          }}
        >
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#ff5f57" }} />
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#febc2e" }} />
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#28c840" }} />
          <span
            style={{
              marginLeft: 12,
              fontSize: fs * 14,
              color: theme.muted,
              fontFamily: codeFontFamily,
            }}
          >
            {step.language}
          </span>
        </div>

        {/* 代码内容 */}
        <div
          style={{
            flex: 1,
            padding: isPortrait ? "16px 0" : "12px 0",
            overflow: "hidden",
          }}
        >
          {lines.slice(0, visibleLines).map((line, i) => {
            const lineNum = i + 1;
            const isHighlighted = highlightSet.has(lineNum);
            // 高亮行渐显
            const hlOpacity =
              isHighlighted && localFrame > 15
                ? interpolate(localFrame, [15, 25], [0, 1], {
                    extrapolateRight: "clamp",
                    extrapolateLeft: "clamp",
                  })
                : isHighlighted
                ? 0
                : 1;

            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "stretch",
                  background: isHighlighted
                    ? `${theme.highlightBg}`
                    : "transparent",
                  borderLeft: isHighlighted
                    ? `3px solid ${theme.highlightBorder}`
                    : "3px solid transparent",
                  opacity: isHighlighted ? hlOpacity : 1,
                  minHeight: fs * 30,
                }}
              >
                <span
                  style={{
                    width: fs * 48,
                    textAlign: "right",
                    paddingRight: 16,
                    fontSize: fs * 16,
                    color: isHighlighted ? theme.accent : theme.lineNum,
                    fontFamily: codeFontFamily,
                    lineHeight: `${fs * 30}px`,
                    userSelect: "none",
                    flexShrink: 0,
                  }}
                >
                  {lineNum}
                </span>
                <span
                  style={{
                    fontSize: fs * 18,
                    color: theme.codeFg,
                    fontFamily: codeFontFamily,
                    lineHeight: `${fs * 30}px`,
                    whiteSpace: "pre",
                    paddingRight: 16,
                  }}
                >
                  {tokenize(line, theme)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 注释气泡 */}
      {step.comment && (
        <div
          style={{
            marginTop: 20,
            opacity: interpolate(localFrame, [20, 30], [0, 1], {
              extrapolateRight: "clamp",
              extrapolateLeft: "clamp",
            }),
            transform: `translateY(${interpolate(localFrame, [20, 30], [10, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" })}px)`,
          }}
        >
          <div
            style={{
              background: theme.commentBg,
              padding: "16px 24px",
              borderRadius: 12,
              fontSize: fs * 22,
              color: theme.commentFg,
              fontFamily,
              lineHeight: 1.5,
              fontWeight: 600,
            }}
          >
            {step.comment}
          </div>
        </div>
      )}
    </div>
  );
};

// ── 主组件 ────────────────────────────────────────────────────
export const CodeScene: React.FC<CodeDemoProps> = ({
  steps = [],
  theme: themeName = "dark",
  title,
}) => {
  if (steps.length === 0) return null;
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const isPortrait = height > width;
  const theme = THEMES[themeName] || THEMES.dark;

  const timings = steps.reduce<{ start: number; duration: number }[]>(
    (acc, s, i) => {
      const start = i === 0 ? 0 : acc[i - 1].start + acc[i - 1].duration;
      return [...acc, { start, duration: s.duration }];
    },
    []
  );

  const totalDuration =
    timings[timings.length - 1].start + timings[timings.length - 1].duration;

  const currentIdx = timings.findIndex(
    (t) => frame >= t.start && frame < t.start + t.duration
  );
  const currentStep = currentIdx >= 0 ? steps[currentIdx] : null;
  const localFrame = currentIdx >= 0 ? frame - timings[currentIdx].start : 0;

  const pageTurnFrames = timings.slice(1).map((t) => t.start);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        background: theme.bg,
      }}
    >
      {pageTurnFrames.map((f, i) => (
        <Sequence key={i} from={f} durationInFrames={15}>
          <Audio src={staticFile("sfx/ding.wav")} volume={0.15} />
        </Sequence>
      ))}

      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.03,
          backgroundImage: `radial-gradient(circle, ${theme.accent} 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />

      {title && (
        <div
          style={{
            position: "absolute",
            top: isPortrait ? 40 : 20,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            zIndex: 10,
          }}
        >
          <span
            style={{
              background: "rgba(0,0,0,0.5)",
              padding: "8px 28px",
              borderRadius: 20,
              color: "rgba(255,255,255,0.7)",
              fontSize: isPortrait ? 24 : 16,
              fontFamily: "PingFang SC, Microsoft YaHei, sans-serif",
              fontWeight: 600,
              letterSpacing: 2,
            }}
          >
            {title}
          </span>
        </div>
      )}

      <div
        style={{
          position: "absolute",
          top: title ? (isPortrait ? 100 : 60) : 0,
          left: 0,
          right: 0,
          bottom: isPortrait ? 80 : 50,
        }}
      >
        {currentStep && (
          <SingleCode
            step={currentStep}
            localFrame={localFrame}
            theme={theme}
            isPortrait={isPortrait}
          />
        )}
      </div>

      {/* 步骤指示器 */}
      <div
        style={{
          position: "absolute",
          bottom: isPortrait ? 28 : 14,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: 8,
          zIndex: 20,
        }}
      >
        {steps.map((_, i) => (
          <div
            key={i}
            style={{
              width:
                i === currentIdx
                  ? isPortrait
                    ? 28
                    : 20
                  : isPortrait
                  ? 8
                  : 6,
              height: isPortrait ? 8 : 6,
              borderRadius: 4,
              background:
                i === currentIdx ? theme.accent : "rgba(255,255,255,0.25)",
            }}
          />
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 4,
          background: "rgba(255,255,255,0.08)",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${(frame / totalDuration) * 100}%`,
            background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent}cc)`,
            borderRadius: "0 2px 2px 0",
          }}
        />
      </div>
    </div>
  );
};
