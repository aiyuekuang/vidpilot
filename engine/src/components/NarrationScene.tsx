import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Img,
  Audio,
  Sequence,
  staticFile,
} from "remotion";
import { NarrationSegment, NarrationProps } from "../types";

const THEMES = {
  dark: {
    bg: "#0d0d0d",
    overlay: "linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.7) 60%, rgba(0,0,0,0.95) 100%)",
    accent: "#7c3aed",
    title: "#ffffff",
    body: "rgba(255,255,255,0.9)",
    muted: "rgba(255,255,255,0.5)",
  },
  tech: {
    bg: "#0f172a",
    overlay: "linear-gradient(180deg, rgba(15,23,42,0.1) 0%, rgba(15,23,42,0.7) 60%, rgba(15,23,42,0.95) 100%)",
    accent: "#06b6d4",
    title: "#ffffff",
    body: "rgba(255,255,255,0.9)",
    muted: "rgba(255,255,255,0.5)",
  },
  warm: {
    bg: "#1c1410",
    overlay: "linear-gradient(180deg, rgba(28,20,16,0.1) 0%, rgba(28,20,16,0.7) 60%, rgba(28,20,16,0.95) 100%)",
    accent: "#f59e0b",
    title: "#ffffff",
    body: "rgba(255,255,255,0.9)",
    muted: "rgba(255,255,255,0.5)",
  },
};

// ── 单段图文渲染 ────────────────────────────────────────────
interface SingleSegmentProps {
  segment: NarrationSegment;
  localFrame: number;
  theme: typeof THEMES["dark"];
  isPortrait: boolean;
  width: number;
  height: number;
}

const SingleSegment: React.FC<SingleSegmentProps> = ({
  segment,
  localFrame,
  theme,
  isPortrait,
  width,
  height,
}) => {
  const fs = isPortrait ? 1 : 0.7;
  const fontFamily = "PingFang SC, Noto Sans SC, Microsoft YaHei, sans-serif";
  const effect = segment.effect || "kenburns";

  // 入场淡入
  const enterOpacity = interpolate(localFrame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Ken Burns 效果参数
  const progress = localFrame / Math.max(segment.duration, 1);
  let imgTransform = "";
  if (effect === "kenburns") {
    const scale = interpolate(progress, [0, 1], [1.0, 1.15]);
    const tx = interpolate(progress, [0, 1], [0, -2]);
    const ty = interpolate(progress, [0, 1], [0, -1]);
    imgTransform = `scale(${scale}) translate(${tx}%, ${ty}%)`;
  } else if (effect === "zoomIn") {
    const scale = interpolate(progress, [0, 1], [1.2, 1.0]);
    imgTransform = `scale(${scale})`;
  }

  // 文字逐字显示
  const textChars = segment.text.split("");
  const charsPerFrame = textChars.length / Math.max(segment.duration * 0.3, 10);
  const visibleChars = Math.min(
    textChars.length,
    Math.floor(localFrame * charsPerFrame)
  );

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        opacity: enterOpacity,
      }}
    >
      {/* 背景图 */}
      {segment.image ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
          }}
        >
          <Img
            src={staticFile(segment.image)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: imgTransform,
            }}
          />
        </div>
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: theme.bg,
          }}
        />
      )}

      {/* 渐变遮罩 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: segment.image ? theme.overlay : "transparent",
        }}
      />

      {/* 文字内容区 */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: isPortrait ? "0 48px 120px" : "0 60px 80px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* 主文字 */}
        <div
          style={{
            fontSize: fs * (segment.image ? 36 : 44),
            fontWeight: 800,
            color: theme.title,
            fontFamily,
            lineHeight: 1.5,
            textShadow: segment.image ? "0 2px 20px rgba(0,0,0,0.8)" : "none",
          }}
        >
          {textChars.slice(0, visibleChars).join("")}
          {visibleChars < textChars.length && (
            <span
              style={{
                display: "inline-block",
                width: 3,
                height: fs * 36,
                background: theme.accent,
                marginLeft: 2,
                verticalAlign: "middle",
                opacity: Math.sin(localFrame * 0.3) > 0 ? 1 : 0,
              }}
            />
          )}
        </div>

        {/* 副标题/来源 */}
        {segment.subtitle && visibleChars >= textChars.length && (
          <div
            style={{
              fontSize: fs * 20,
              color: theme.muted,
              fontFamily,
              opacity: interpolate(
                localFrame,
                [segment.duration * 0.4, segment.duration * 0.5],
                [0, 1],
                { extrapolateRight: "clamp", extrapolateLeft: "clamp" }
              ),
            }}
          >
            {segment.subtitle}
          </div>
        )}
      </div>

      {/* 左侧竖线装饰 */}
      {!segment.image && (
        <div
          style={{
            position: "absolute",
            left: isPortrait ? 32 : 44,
            top: "30%",
            bottom: "30%",
            width: 4,
            background: `linear-gradient(180deg, transparent, ${theme.accent}, transparent)`,
            borderRadius: 2,
          }}
        />
      )}
    </div>
  );
};

// ── 主组件 ────────────────────────────────────────────────────
export const NarrationScene: React.FC<NarrationProps> = ({
  segments = [],
  theme: themeName = "dark",
  title,
}) => {
  if (segments.length === 0) return null;
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const isPortrait = height > width;
  const theme = THEMES[themeName] || THEMES.dark;

  const timings = segments.reduce<{ start: number; duration: number }[]>(
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
  const currentSegment = currentIdx >= 0 ? segments[currentIdx] : null;
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

      {/* 顶部水印 */}
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

      {/* 内容区 */}
      <div style={{ position: "absolute", inset: 0 }}>
        {currentSegment && (
          <SingleSegment
            segment={currentSegment}
            localFrame={localFrame}
            theme={theme}
            isPortrait={isPortrait}
            width={width}
            height={height}
          />
        )}
      </div>

      {/* 页码指示器 */}
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
        {segments.map((_, i) => (
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

      {/* 进度条 */}
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
