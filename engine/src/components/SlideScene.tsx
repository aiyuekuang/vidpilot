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
import { Slide, SlideshowProps } from "../types";

// ── 主题颜色 ──────────────────────────────────────────────────
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
    bullet: "#7c3aed",
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
    bullet: "#06b6d4",
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
    bullet: "#f59e0b",
  },
};

// ── 单张幻灯片渲染 ────────────────────────────────────────────
interface SingleSlideProps {
  slide: Slide;
  globalFrame: number; // 当前幻灯片内的帧（0 开始）
  theme: typeof THEMES["dark"];
  isPortrait: boolean;
  width: number;
  height: number;
}

const SingleSlide: React.FC<SingleSlideProps> = ({
  slide,
  globalFrame,
  theme,
  isPortrait,
  width,
  height,
}) => {
  const accent = slide.accent || theme.accent;
  const fs = isPortrait ? 1 : 0.7; // font scale

  // 入场动画：前 20 帧淡入+上移
  const enterProgress = spring({
    frame: globalFrame,
    fps: 30,
    config: { damping: 18, stiffness: 120, mass: 0.8 },
    durationInFrames: 20,
  });
  const opacity = interpolate(globalFrame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const translateY = interpolate(enterProgress, [0, 1], [40, 0]);

  const animStyle: React.CSSProperties = {
    opacity,
    transform: `translateY(${translateY}px)`,
  };

  const fontFamily = "PingFang SC, Noto Sans SC, Microsoft YaHei, sans-serif";

  // ── COVER ─────────────────────────────────────────────────
  if (slide.layout === "cover") {
    return (
      <div style={{ ...animStyle, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: "0 80px", textAlign: "center" }}>
        {slide.emoji && (
          <div style={{ fontSize: fs * 80, marginBottom: 24, lineHeight: 1 }}>{slide.emoji}</div>
        )}
        <div style={{ fontSize: fs * 52, fontWeight: 800, color: theme.title, fontFamily, lineHeight: 1.3, marginBottom: 20 }}>
          {slide.title}
        </div>
        {slide.subtitle && (
          <div style={{ fontSize: fs * 28, color: theme.body, fontFamily, lineHeight: 1.6, marginTop: 16, padding: "12px 32px", background: theme.card, borderRadius: 16, border: `1px solid ${theme.border}` }}>
            {slide.subtitle}
          </div>
        )}
        <div style={{ marginTop: 48, width: 60, height: 4, background: accent, borderRadius: 2 }} />
      </div>
    );
  }

  // ── DATA ──────────────────────────────────────────────────
  if (slide.layout === "data") {
    const statProgress = spring({ frame: Math.max(0, globalFrame - 10), fps: 30, config: { damping: 14, stiffness: 100 }, durationInFrames: 25 });
    const statScale = interpolate(statProgress, [0, 1], [0.4, 1]);
    return (
      <div style={{ ...animStyle, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: "0 60px", textAlign: "center" }}>
        <div style={{ fontSize: fs * 32, fontWeight: 700, color: theme.body, fontFamily, marginBottom: 40 }}>{slide.title}</div>
        <div style={{ transform: `scale(${statScale})`, display: "inline-block" }}>
          <div style={{ fontSize: fs * 120, fontWeight: 900, color: accent, fontFamily, lineHeight: 1, textShadow: `0 0 60px ${slide.accent || theme.accentGlow}` }}>
            {slide.stat}
          </div>
        </div>
        {slide.statLabel && (
          <div style={{ fontSize: fs * 26, color: theme.muted, fontFamily, marginTop: 20, lineHeight: 1.5 }}>{slide.statLabel}</div>
        )}
        {slide.points && slide.points.length > 0 && (
          <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 700 }}>
            {slide.points.map((p, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12, background: theme.card, borderRadius: 12, padding: "14px 20px", border: `1px solid ${theme.border}`, textAlign: "left" }}>
                <span style={{ color: accent, fontSize: fs * 20, marginTop: 2 }}>•</span>
                <span style={{ color: theme.body, fontSize: fs * 22, fontFamily, lineHeight: 1.5 }}>{p}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── QUOTE ─────────────────────────────────────────────────
  if (slide.layout === "quote") {
    return (
      <div style={{ ...animStyle, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: "0 80px" }}>
        <div style={{ fontSize: fs * 100, color: accent, fontFamily: "Georgia, serif", lineHeight: 0.5, marginBottom: 20, opacity: 0.6 }}>"</div>
        <div style={{ fontSize: fs * 34, color: theme.title, fontFamily, lineHeight: 1.8, textAlign: "center", fontStyle: "italic" }}>
          {slide.quote || slide.title}
        </div>
        <div style={{ fontSize: fs * 100, color: accent, fontFamily: "Georgia, serif", lineHeight: 0.5, marginTop: 20, opacity: 0.6, alignSelf: "flex-end" }}>"</div>
        {slide.subtitle && (
          <div style={{ marginTop: 32, fontSize: fs * 22, color: theme.muted, fontFamily }}>—— {slide.subtitle}</div>
        )}
      </div>
    );
  }

  // ── END ───────────────────────────────────────────────────
  if (slide.layout === "end") {
    return (
      <div style={{ ...animStyle, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: "0 80px", textAlign: "center" }}>
        {slide.emoji && <div style={{ fontSize: fs * 72, marginBottom: 24 }}>{slide.emoji}</div>}
        <div style={{ fontSize: fs * 44, fontWeight: 800, color: theme.title, fontFamily, lineHeight: 1.4, marginBottom: 24 }}>
          {slide.title}
        </div>
        {slide.subtitle && (
          <div style={{ fontSize: fs * 28, color: accent, fontFamily, fontWeight: 600, marginBottom: 40, padding: "16px 40px", border: `2px solid ${accent}`, borderRadius: 50 }}>
            {slide.subtitle}
          </div>
        )}
        <div style={{ fontSize: fs * 22, color: theme.muted, fontFamily }}>
          @程序员老东 · 关注不迷路
        </div>
      </div>
    );
  }

  // ── SPLIT ─────────────────────────────────────────────────
  if (slide.layout === "split") {
    return (
      <div style={{ ...animStyle, display: "flex", flexDirection: "column", height: "100%", padding: isPortrait ? "60px 40px" : "40px 60px" }}>
        <div style={{ fontSize: fs * 36, fontWeight: 800, color: theme.title, fontFamily, marginBottom: 32, lineHeight: 1.3 }}>
          {slide.emoji ? `${slide.emoji} ${slide.title}` : slide.title}
        </div>
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {(slide.points || []).map((p, i) => (
            <div key={i} style={{ background: theme.card, borderRadius: 16, padding: "24px 20px", border: `1px solid ${theme.border}`, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ color: accent, fontSize: fs * 28, fontWeight: 700, marginBottom: 8, fontFamily }}>0{i + 1}</div>
              <div style={{ color: theme.body, fontSize: fs * 22, fontFamily, lineHeight: 1.6 }}>{p}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── CONTENT (default) ─────────────────────────────────────
  return (
    <div style={{ ...animStyle, display: "flex", flexDirection: "column", height: "100%", padding: isPortrait ? "60px 48px" : "40px 60px" }}>
      <div style={{ fontSize: fs * 38, fontWeight: 800, color: theme.title, fontFamily, marginBottom: 8, lineHeight: 1.3 }}>
        {slide.emoji ? `${slide.emoji} ${slide.title}` : slide.title}
      </div>
      {slide.subtitle && (
        <div style={{ fontSize: fs * 22, color: theme.muted, fontFamily, marginBottom: 28 }}>{slide.subtitle}</div>
      )}
      <div style={{ width: 48, height: 4, background: accent, borderRadius: 2, marginBottom: 36 }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 18, justifyContent: "center" }}>
        {(slide.points || []).map((point, i) => {
          const pointDelay = 10 + i * 8;
          const pointOpacity = interpolate(globalFrame, [pointDelay, pointDelay + 10], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
          const pointX = interpolate(globalFrame, [pointDelay, pointDelay + 10], [-20, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
          return (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 16, opacity: pointOpacity, transform: `translateX(${pointX}px)` }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: accent, flexShrink: 0, marginTop: fs * 14, boxShadow: `0 0 8px ${accent}` }} />
              <div style={{ fontSize: fs * 26, color: theme.body, fontFamily, lineHeight: 1.65 }}>{point}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── 主组件 ────────────────────────────────────────────────────
export const SlideScene: React.FC<SlideshowProps> = ({
  slides = [],
  theme: themeName = "dark",
  title,
}) => {
  if (slides.length === 0) return null;
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const isPortrait = height > width;
  const theme = THEMES[themeName] || THEMES.dark;

  // 计算每张 slide 的累计起始帧
  const timings = slides.reduce<{ start: number; duration: number }[]>(
    (acc, s, i) => {
      const start = i === 0 ? 0 : acc[i - 1].start + acc[i - 1].duration;
      return [...acc, { start, duration: s.duration }];
    },
    []
  );

  const totalDuration = timings[timings.length - 1].start + timings[timings.length - 1].duration;

  // 当前显示的 slide
  const currentIdx = timings.findIndex((t) => frame >= t.start && frame < t.start + t.duration);
  const currentSlide = currentIdx >= 0 ? slides[currentIdx] : null;
  const localFrame = currentIdx >= 0 ? frame - timings[currentIdx].start : 0;

  // 切页音效
  const pageTurnFrames = timings.slice(1).map((t) => t.start);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", overflow: "hidden", background: theme.bg }}>

      {/* 页面切换音效 */}
      {pageTurnFrames.map((f, i) => (
        <Sequence key={i} from={f} durationInFrames={15}>
          <Audio src={staticFile("sfx/ding.wav")} volume={0.2} />
        </Sequence>
      ))}

      {/* 背景装饰粒子（简单圆点网格） */}
      <div style={{ position: "absolute", inset: 0, opacity: 0.04, backgroundImage: `radial-gradient(circle, ${theme.accent} 1px, transparent 1px)`, backgroundSize: "48px 48px" }} />

      {/* 顶部水印 */}
      {title && (
        <div style={{ position: "absolute", top: isPortrait ? 40 : 20, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 10 }}>
          <span style={{ background: "rgba(0,0,0,0.5)", padding: "8px 28px", borderRadius: 20, color: "rgba(255,255,255,0.7)", fontSize: isPortrait ? 24 : 16, fontFamily: "PingFang SC, Microsoft YaHei, sans-serif", fontWeight: 600, letterSpacing: 2 }}>
            {title}
          </span>
        </div>
      )}

      {/* 幻灯片内容区 */}
      <div style={{ position: "absolute", top: title ? (isPortrait ? 100 : 60) : 0, left: 0, right: 0, bottom: isPortrait ? 80 : 50 }}>
        {currentSlide && (
          <SingleSlide
            slide={currentSlide}
            globalFrame={localFrame}
            theme={theme}
            isPortrait={isPortrait}
            width={width}
            height={height}
          />
        )}
      </div>

      {/* 页码指示器 */}
      <div style={{ position: "absolute", bottom: isPortrait ? 28 : 14, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 8, zIndex: 20 }}>
        {slides.map((_, i) => (
          <div key={i} style={{ width: i === currentIdx ? (isPortrait ? 28 : 20) : (isPortrait ? 8 : 6), height: isPortrait ? 8 : 6, borderRadius: 4, background: i === currentIdx ? theme.accent : "rgba(255,255,255,0.25)", transition: "width 0.3s" }} />
        ))}
      </div>

      {/* 进度条 */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 4, background: "rgba(255,255,255,0.08)" }}>
        <div style={{ height: "100%", width: `${(frame / totalDuration) * 100}%`, background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent}cc)`, borderRadius: "0 2px 2px 0" }} />
      </div>
    </div>
  );
};
