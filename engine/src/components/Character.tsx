import React from "react";
import {
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
  Img,
  staticFile,
} from "remotion";
import { CharacterConfig, Expression } from "../types";
import { PandaFace } from "./PandaExpressions";

interface CharacterProps {
  config: CharacterConfig;
  isSpeaking: boolean;
  side: "left" | "right";
  expression: Expression;
}

const DISPLAY_HEIGHT = 400;

export const Character: React.FC<CharacterProps> = ({
  config,
  isSpeaking,
  side,
  expression,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headBob = isSpeaking
    ? interpolate(Math.sin(frame * 0.25), [-1, 1], [-3, 3])
    : 0;
  const headTilt = isSpeaking
    ? interpolate(Math.sin(frame * 0.18), [-1, 1], [-3, 3])
    : 0;
  const idleSway = interpolate(Math.sin(frame * 0.04), [-1, 1], [-1, 1]);
  const bodyBounce = isSpeaking
    ? interpolate(Math.sin(frame * 0.3), [-1, 1], [-2, 2])
    : 0;

  const entrance = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 80 },
  });

  // Scale image to fixed display height
  const scale = DISPLAY_HEIGHT / config.imageHeight;
  const displayWidth = Math.round(config.imageWidth * scale);
  const faceCX = config.faceCenter.x * scale;
  const faceCY = config.faceCenter.y * scale;
  const faceR = config.faceCenter.radius * scale;

  const flipX = side === "right" ? -1 : 1;

  return (
    <div
      style={{
        transform: `scale(${entrance}) translateY(${idleSway}px)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Character body + face expression */}
      <div
        style={{
          position: "relative",
          width: displayWidth,
          height: DISPLAY_HEIGHT,
          transform: `scaleX(${flipX}) translateY(${bodyBounce}px)`,
        }}
      >
        <Img
          src={staticFile(config.image)}
          style={{ width: displayWidth, height: DISPLAY_HEIGHT }}
        />

        {/* Expression overlay on the white face */}
        <svg
          width={faceR * 2}
          height={faceR * 2}
          viewBox="-80 -80 160 160"
          style={{
            position: "absolute",
            left: faceCX - faceR,
            top: faceCY - faceR + headBob,
            overflow: "visible",
            transform: `rotate(${headTilt}deg)`,
          }}
        >
          <PandaFace
            expression={expression}
            isSpeaking={isSpeaking}
            frame={frame}
          />
        </svg>
      </div>

      {/* Name label */}
      <div
        style={{
          background: "rgba(0,0,0,0.75)",
          padding: "4px 20px",
          borderRadius: 14,
          marginTop: 8,
        }}
      >
        <span
          style={{
            color: "white",
            fontSize: 16,
            fontFamily: "PingFang SC, Microsoft YaHei, sans-serif",
            fontWeight: "bold",
          }}
        >
          {config.name}
        </span>
      </div>
    </div>
  );
};
