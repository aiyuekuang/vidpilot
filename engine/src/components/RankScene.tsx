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
import { RankSlide, RankingProps } from "../types";

const THEMES = {
  dark: {
    bg: "linear-gradient(135deg, #0d0d0d 0%, #1a1a2e 100%)",
    accent: "#7c3aed",
    accentGlow: "rgba(124,58,237,0.3)",
    title: "#ffffff",
    body: "rgba(255,255,255,0.85)",
    muted: "rgba(255,255,255,0.45)",
    card: "rgba(255,255,255,0.06)",
    border: "rgba(255,255,255,0.12)",
    barColors: ["#7c3aed", "#a855f7", "#c084fc", "#d8b4fe", "#e9d5ff"],
  },
  tech: {
    bg: "linear-gradient(135deg, #0f172a 0%, #0c1a3a 100%)",
    accent: "#06b6d4",
    accentGlow: "rgba(6,182,212,0.25)",
    title: "#ffffff",
    body: "rgba(255,255,255,0.85)",
    muted: "rgba(255,255,255,0.45)",
    card: "rgba(255,255,255,0.05)",
    border: "rgba(6,182,212,0.2)",
    barColors: ["#06b6d4", "#22d3ee", "#67e8f9", "#a5f3fc", "#cffafe"],
  },
  warm: {
    bg: "linear-gradient(135deg, #1c1410 0%, #2d1f0e 100%)",
    accent: "#f59e0b",
    accentGlow: "rgba(245,158,11,0.25)",
    title: "#ffffff",
    body: "rgba(255,255,255,0.85)",
    muted: "rgba(255,255,255,0.45)",
    card: "rgba(255,255,255,0.06)",
    border: "rgba(245,158,11,0.2)",
    barColors: ["#f59e0b", "#fbbf24", "#fcd34d", "#fde68a", "#fef3c7"],
  },
};

// ── 单页排行榜渲染 ──────────────────────────────────────────
interface SingleRankProps {
  slide: RankSlide;
  localFrame: number;
  theme: typeof THEMES["dark"];
  isPortrait: boolean;
}

const SingleRank: React.FC<SingleRankProps> = ({
  slide,
  localFrame,
  theme,
  isPortrait,
}) => {
  const fs = isPortrait ? 1 : 0.7;
  const fontFamily = "PingFang SC, Noto Sans SC, Microsoft YaHei, sans-serif";
  const maxVal = slide.maxValue || Math.max(...slide.items.map((i) => i.value));

  // 页面入场
  const enterOpacity = interpolate(localFrame, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
  });
  const enterY = interpolate(
    spring({ frame: localFrame, fps: 30, config: { damping: 18, stiffness: 120 }, durationInFrames: 20 }),
    [0, 1], [30, 0]
  );

  return (
    <div
      style={{
        opacity: enterOpacity,
        transform: `translateY(${enterY}px)`,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: isPortrait ? "40px 48px" : "30px 60px",
      }}
    >
      {/* 标题 */}
      <div
        style={{
          fontSize: fs * 38,
          fontWeight: 800,
          color: theme.title,
          fontFamily,
          marginBottom: 8,
          lineHeight: 1.3,
        }}
      >
        {slide.title}
      </div>
      <div
        style={{
          width: 48,
          height: 4,
          background: theme.accent,
          borderRadius: 2,
          marginBottom: 32,
        }}
      />

      {/* 排行条目 */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: isPortrait ? 20 : 14,
          justifyContent: "center",
        }}
      >
        {slide.items.map((item, i) => {
          // 每条延迟入场
          const itemDelay = 8 + i * 6;
          const barProgress = spring({
            frame: Math.max(0, localFrame - itemDelay),
            fps: 30,
            config: { damping: 16, stiffness: 80 },
            durationInFrames: 25,
          });
          const barWidth = interpolate(barProgress, [0, 1], [0, (item.value / maxVal) * 100]);
          const itemOpacity = interpolate(localFrame, [itemDelay, itemDelay + 8], [0, 1], {
            extrapolateRight: "clamp",
            extrapolateLeft: "clamp",
          });
          const barColor = item.color || theme.barColors[i % theme.barColors.length];

          return (
            <div key={i} style={{ opacity: itemOpacity }}>
              {/* 标签行 */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 6,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      fontSize: fs * 20,
                      fontWeight: 800,
                      color: i < 3 ? barColor : theme.muted,
                      fontFamily,
                      width: fs * 28,
                    }}
                  >
                    {i + 1}
                  </span>
                  {item.icon && (
                    <span style={{ fontSize: fs * 22 }}>{item.icon}</span>
                  )}
                  <span
                    style={{
                      fontSize: fs * 24,
                      fontWeight: 700,
                      color: theme.body,
                      fontFamily,
                    }}
                  >
                    {item.label}
                  </span>
                  {item.note && (
                    <span
                      style={{
                        fontSize: fs * 16,
                        color: theme.muted,
                        fontFamily,
                      }}
                    >
                      {item.note}
                    </span>
                  )}
                </div>
                <span
                  style={{
                    fontSize: fs * 22,
                    fontWeight: 800,
                    color: barColor,
                    fontFamily,
                  }}
                >
                  {item.value}
                  {item.unit || ""}
                </span>
              </div>
              {/* 柱状条 */}
              <div
                style={{
                  height: isPortrait ? 28 : 20,
                  background: theme.card,
                  borderRadius: 6,
                  overflow: "hidden",
                  border: `1px solid ${theme.border}`,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${barWidth}%`,
                    background: `linear-gradient(90deg, ${barColor}, ${barColor}cc)`,
                    borderRadius: 6,
                    boxShadow: `0 0 12px ${barColor}40`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── 主组件 ────────────────────────────────────────────────────
export const RankScene: React.FC<RankingProps> = ({
  slides = [],
  theme: themeName = "dark",
  title,
}) => {
  if (slides.length === 0) return null;
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const isPortrait = height > width;
  const theme = THEMES[themeName] || THEMES.dark;

  const timings = slides.reduce<{ start: number; duration: number }[]>(
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
  const currentSlide = currentIdx >= 0 ? slides[currentIdx] : null;
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
      {/* 切页音效 */}
      {pageTurnFrames.map((f, i) => (
        <Sequence key={i} from={f} durationInFrames={15}>
          <Audio src={staticFile("sfx/ding.wav")} volume={0.2} />
        </Sequence>
      ))}

      {/* 背景网格 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.04,
          backgroundImage: `radial-gradient(circle, ${theme.accent} 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />

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

      {/* 排行榜内容 */}
      <div
        style={{
          position: "absolute",
          top: title ? (isPortrait ? 100 : 60) : 0,
          left: 0,
          right: 0,
          bottom: isPortrait ? 80 : 50,
        }}
      >
        {currentSlide && (
          <SingleRank
            slide={currentSlide}
            localFrame={localFrame}
            theme={theme}
            isPortrait={isPortrait}
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
        {slides.map((_, i) => (
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
