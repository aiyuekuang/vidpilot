import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Img,
  OffthreadVideo,
  Audio,
  Sequence,
  staticFile,
} from "remotion";
import { NarrationSegment, NarrationProps } from "../types";

const THEMES = {
  dark: {
    bg: "#000000",
    accent: "#00d4ff",
    accent2: "#ff6b35",
    title: "#ffffff",
    body: "rgba(255,255,255,0.88)",
    muted: "rgba(255,255,255,0.45)",
    cardBg: "rgba(255,255,255,0.06)",
    cardBorder: "rgba(255,255,255,0.1)",
  },
  tech: {
    bg: "#000000",
    accent: "#06b6d4",
    accent2: "#a78bfa",
    title: "#ffffff",
    body: "rgba(255,255,255,0.88)",
    muted: "rgba(255,255,255,0.45)",
    cardBg: "rgba(6,182,212,0.06)",
    cardBorder: "rgba(6,182,212,0.15)",
  },
  warm: {
    bg: "#000000",
    accent: "#f59e0b",
    accent2: "#ef4444",
    title: "#ffffff",
    body: "rgba(255,255,255,0.88)",
    muted: "rgba(255,255,255,0.45)",
    cardBg: "rgba(245,158,11,0.06)",
    cardBorder: "rgba(245,158,11,0.15)",
  },
};

// Parse **keyword** markers into segments
function parseHighlight(
  text: string,
  accentColor: string
): { text: string; highlight: boolean }[] {
  const parts: { text: string; highlight: boolean }[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), highlight: false });
    }
    parts.push({ text: match[1], highlight: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), highlight: false });
  }
  return parts;
}

// Render text with highlighted keywords
const HighlightedText: React.FC<{
  text: string;
  accentColor: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  lineHeight?: number;
  fontWeight?: number;
  textAlign?: React.CSSProperties["textAlign"];
}> = ({ text, accentColor, fontSize, fontFamily, color, lineHeight = 1.5, fontWeight = 800, textAlign = "center" }) => {
  // Split by newlines first
  const lines = text.split("\n");
  return (
    <div style={{ fontSize, fontFamily, color, lineHeight, fontWeight, textAlign }}>
      {lines.map((line, li) => (
        <React.Fragment key={li}>
          {li > 0 && <br />}
          {parseHighlight(line, accentColor).map((part, pi) =>
            part.highlight ? (
              <span key={pi} style={{ color: accentColor }}>{part.text}</span>
            ) : (
              <span key={pi}>{part.text}</span>
            )
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

// -- Single segment renderer --
interface SingleSegmentProps {
  segment: NarrationSegment;
  localFrame: number;
  theme: typeof THEMES["dark"];
  isPortrait: boolean;
  width: number;
  height: number;
  fps: number;
  segmentIndex: number;
  totalSegments: number;
}

const SingleSegment: React.FC<SingleSegmentProps> = ({
  segment,
  localFrame,
  theme,
  isPortrait,
  width,
  height,
  fps,
  segmentIndex,
  totalSegments,
}) => {
  const fontFamily = "PingFang SC, Noto Sans SC, Microsoft YaHei, sans-serif";
  const hasVideo = !!segment.video;
  const hasMedia = hasVideo || !!segment.image;
  const isFirst = segmentIndex === 0;
  const isLast = segmentIndex === totalSegments - 1;

  // Title spring entrance (from bottom)
  const titleSpring = spring({
    frame: localFrame,
    fps,
    config: { damping: 14, stiffness: 120 },
    durationInFrames: 25,
  });
  const titleY = interpolate(titleSpring, [0, 1], [80, 0]);
  const titleOpacity = titleSpring;

  // Subtitle delayed entrance
  const subtitleSpring = spring({
    frame: Math.max(0, localFrame - 10),
    fps,
    config: { damping: 14, stiffness: 100 },
    durationInFrames: 25,
  });
  const subtitleOpacity = subtitleSpring;
  const subtitleY = interpolate(subtitleSpring, [0, 1], [40, 0]);

  // Narration caption - split into sentences, show one at a time
  // LEAD_FRAMES: silence at start of each segment for entrance animations
  const LEAD_FRAMES = 25;
  const sentences = (segment.narration || "")
    .split(/(?<=[。！？!?])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const sentenceCount = sentences.length || 1;
  // Speech starts after LEAD_FRAMES; allocate remaining frames by char count
  const speechFrames = Math.max(segment.duration - LEAD_FRAMES, 1);
  const totalChars = sentences.reduce((sum, s) => sum + s.length, 0) || 1;
  const sentenceFramesList = sentences.map(
    (s) => (s.length / totalChars) * speechFrames
  );
  const sentenceStarts = sentenceFramesList.reduce<number[]>(
    (acc, f, i) => [
      ...acc,
      LEAD_FRAMES + (i === 0 ? 0 : acc[i - 1] - LEAD_FRAMES + sentenceFramesList[i - 1]),
    ],
    []
  );
  const currentSentenceIdx =
    localFrame < LEAD_FRAMES
      ? 0
      : Math.min(
          sentenceStarts.findLastIndex((start) => localFrame >= start),
          sentenceCount - 1
        );
  const currentSentence = sentences[Math.max(0, currentSentenceIdx)] || "";
  // No fade-in: caption appears instantly to stay in sync with audio
  const captionOpacity = localFrame < LEAD_FRAMES ? 0 : 1;

  // Image entrance from bottom (delayed)
  const imageSpring = spring({
    frame: Math.max(0, localFrame - 18),
    fps,
    config: { damping: 16, stiffness: 90 },
    durationInFrames: 30,
  });
  const imageY = interpolate(imageSpring, [0, 1], [120, 0]);
  const imageOpacity = imageSpring;

  // Slow Ken Burns on the image card
  const progress = localFrame / Math.max(segment.duration, 1);
  const imgScale = interpolate(progress, [0, 1], [1.0, 1.08]);

  // Decorative accent line animation
  const lineWidth = interpolate(localFrame, [5, 25], [0, 120], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  // Number badge for non-first/last segments
  const showNumber = !isFirst && !isLast;
  const numberText = `0${segmentIndex}`;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        background: theme.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: hasMedia ? "flex-start" : "center",
        overflow: "hidden",
      }}
    >
      {/* Subtle gradient glow at top */}
      <div
        style={{
          position: "absolute",
          top: -200,
          left: "50%",
          transform: "translateX(-50%)",
          width: 600,
          height: 400,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${theme.accent}15 0%, transparent 70%)`,
          opacity: titleOpacity,
        }}
      />

      {/* Text content area */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: hasMedia
            ? isPortrait ? 140 : 80
            : isPortrait ? 400 : 250,
          paddingLeft: isPortrait ? 48 : 60,
          paddingRight: isPortrait ? 48 : 60,
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* Number badge */}
        {showNumber && (
          <div
            style={{
              opacity: titleOpacity,
              transform: `translateY(${titleY}px)`,
              marginBottom: 20,
              fontSize: isPortrait ? 28 : 20,
              fontWeight: 700,
              fontFamily,
              color: theme.accent,
              letterSpacing: 4,
            }}
          >
            {numberText}
          </div>
        )}

        {/* Main title */}
        <div
          style={{
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
          }}
        >
          <HighlightedText
            text={segment.text}
            accentColor={theme.accent}
            fontSize={isPortrait ? 60 : 44}
            fontFamily={fontFamily}
            color={theme.title}
            fontWeight={800}
            lineHeight={1.45}
          />
        </div>

        {/* Accent line under title */}
        <div
          style={{
            width: lineWidth,
            height: 4,
            background: `linear-gradient(90deg, transparent, ${theme.accent}, transparent)`,
            borderRadius: 2,
            marginTop: 28,
            marginBottom: 20,
            opacity: titleOpacity,
          }}
        />

        {/* Subtitle */}
        {segment.subtitle && (
          <div
            style={{
              opacity: subtitleOpacity,
              transform: `translateY(${subtitleY}px)`,
              fontSize: isPortrait ? 26 : 18,
              color: theme.muted,
              fontFamily,
              fontWeight: 400,
              textAlign: "center",
              lineHeight: 1.6,
              maxWidth: isPortrait ? 900 : 700,
            }}
          >
            {segment.subtitle}
          </div>
        )}
      </div>

      {/* Media card (middle area) - image or video */}
      {hasMedia && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(-50%, -50%) translateY(${isPortrait ? 60 : 40}px) translateY(${imageY}px)`,
            opacity: imageOpacity,
            width: isPortrait ? width - 96 : width - 120,
            height: isPortrait ? 480 : 320,
            borderRadius: 20,
            overflow: "hidden",
            border: `1px solid ${theme.cardBorder}`,
            boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 40px ${theme.accent}10`,
          }}
        >
          {hasVideo ? (
            <OffthreadVideo
              src={staticFile(segment.video!)}
              volume={0}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <Img
              src={staticFile(segment.image!)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: `scale(${imgScale})`,
              }}
            />
          )}
          {/* Subtle gradient overlay */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.3) 100%)`,
            }}
          />
        </div>
      )}

      {/* Narration caption (bottom) */}
      {segment.narration && (
        <div
          style={{
            position: "absolute",
            bottom: isPortrait ? 220 : 100,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            zIndex: 5,
            padding: isPortrait ? "0 40px" : "0 50px",
            opacity: captionOpacity,
          }}
        >
          <div
            style={{
              background: "rgba(0,0,0,0.7)",
              backdropFilter: "blur(8px)",
              padding: isPortrait ? "16px 28px" : "12px 24px",
              borderRadius: 14,
              maxWidth: isPortrait ? width - 80 : width - 100,
            }}
          >
            <span
              style={{
                fontSize: isPortrait ? 38 : 26,
                fontWeight: 500,
                color: "rgba(255,255,255,0.92)",
                fontFamily,
                lineHeight: 1.7,
                letterSpacing: 0.5,
              }}
            >
              {currentSentence}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// -- Main component --
export const NarrationScene: React.FC<NarrationProps> = ({
  segments = [],
  theme: themeName = "dark",
  title,
  bgm,
}) => {
  if (segments.length === 0) return null;
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
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
      {/* Page turn SFX */}
      {pageTurnFrames.map((f, i) => (
        <Sequence key={i} from={f} durationInFrames={15}>
          <Audio src={staticFile("sfx/ding.wav")} volume={0.15} />
        </Sequence>
      ))}

      {/* BGM */}
      {bgm && (
        <Audio src={staticFile(`music/${bgm}`)} volume={0.08} loop />
      )}

      {/* Watermark title */}
      {title && (
        <div
          style={{
            position: "absolute",
            top: isPortrait ? 50 : 20,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            zIndex: 10,
          }}
        >
          <span
            style={{
              background: "rgba(255,255,255,0.06)",
              backdropFilter: "blur(10px)",
              padding: "10px 32px",
              borderRadius: 24,
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.6)",
              fontSize: isPortrait ? 24 : 16,
              fontFamily: "PingFang SC, Microsoft YaHei, sans-serif",
              fontWeight: 600,
              letterSpacing: 3,
            }}
          >
            {title}
          </span>
        </div>
      )}

      {/* Content */}
      <div style={{ position: "absolute", inset: 0 }}>
        {currentSegment && (
          <SingleSegment
            segment={currentSegment}
            localFrame={localFrame}
            theme={theme}
            isPortrait={isPortrait}
            width={width}
            height={height}
            fps={fps}
            segmentIndex={currentIdx}
            totalSegments={segments.length}
          />
        )}
      </div>

      {/* Page indicators */}
      <div
        style={{
          position: "absolute",
          bottom: isPortrait ? 36 : 18,
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
              width: i === currentIdx ? 28 : 8,
              height: 8,
              borderRadius: 4,
              background:
                i === currentIdx ? theme.accent : "rgba(255,255,255,0.15)",
              transition: "width 0.3s",
            }}
          />
        ))}
      </div>

      {/* Progress bar */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 3,
          background: "rgba(255,255,255,0.05)",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${(frame / totalDuration) * 100}%`,
            background: `linear-gradient(90deg, ${theme.accent}, ${theme.accent}aa)`,
            borderRadius: "0 2px 2px 0",
          }}
        />
      </div>
    </div>
  );
};
