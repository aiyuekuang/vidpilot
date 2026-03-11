import React from "react";
import {
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from "remotion";

interface SpeechBubbleProps {
  text: string;
  side: "left" | "right";
  startFrame: number;
  duration: number;
  speakerName: string;
  isPortrait?: boolean;
}

export const SpeechBubble: React.FC<SpeechBubbleProps> = ({
  text,
  side,
  startFrame,
  duration,
  speakerName,
  isPortrait = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const localFrame = frame - startFrame;

  if (localFrame < 0 || localFrame > duration) return null;

  const popIn = spring({
    frame: localFrame,
    fps,
    config: { damping: 10, stiffness: 150, mass: 0.8 },
  });

  // Fade out in last 10 frames
  const fadeOut =
    localFrame > duration - 10
      ? interpolate(localFrame, [duration - 10, duration], [1, 0])
      : 1;

  // Typewriter effect
  const charsToShow = Math.min(
    text.length,
    Math.floor(
      interpolate(localFrame, [0, duration * 0.6], [0, text.length], {
        extrapolateRight: "clamp",
      })
    )
  );
  const displayText = text.slice(0, charsToShow);

  const isLeft = side === "left";
  const fontSize = isPortrait ? 36 : 26;
  const padding = isPortrait ? "24px 30px" : "14px 20px";
  const margin = isPortrait ? 50 : 30;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: isLeft ? margin : undefined,
        right: isLeft ? undefined : margin,
        maxWidth: isPortrait ? 850 : 600,
        minWidth: isPortrait ? 300 : 200,
        transform: `scale(${popIn})`,
        opacity: fadeOut,
        transformOrigin: isLeft ? "top left" : "top right",
      }}
    >
      <div
        style={{
          background: isLeft
            ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
            : "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
          borderRadius: isPortrait ? 28 : 18,
          padding,
          color: "white",
          fontSize,
          fontFamily: "PingFang SC, Microsoft YaHei, sans-serif",
          fontWeight: 600,
          lineHeight: 1.6,
          boxShadow: "0 12px 40px rgba(0,0,0,0.3)",
          position: "relative",
        }}
      >
        <div
          style={{
            fontSize: isPortrait ? 22 : 14,
            opacity: 0.75,
            marginBottom: isPortrait ? 10 : 4,
            fontWeight: 500,
            letterSpacing: 1,
          }}
        >
          {speakerName}
        </div>
        {displayText}
        {charsToShow < text.length && (
          <span
            style={{
              opacity: Math.sin(frame * 0.3) > 0 ? 1 : 0,
              marginLeft: 2,
            }}
          >
            |
          </span>
        )}
      </div>
      {/* Bubble tail */}
      <div
        style={{
          width: 0,
          height: 0,
          borderLeft: "16px solid transparent",
          borderRight: "16px solid transparent",
          borderTop: `18px solid ${isLeft ? "#764ba2" : "#f5576c"}`,
          position: "absolute",
          bottom: -16,
          left: isLeft ? 40 : undefined,
          right: isLeft ? undefined : 40,
        }}
      />
    </div>
  );
};
