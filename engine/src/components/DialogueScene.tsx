import React from "react";
import {
  useCurrentFrame,
  interpolate,
  useVideoConfig,
  Audio,
  Sequence,
  staticFile,
} from "remotion";
import { Character } from "./Character";
import { SpeechBubble } from "./SpeechBubble";
import { Background } from "./Background";
import { DialogueLine, CharacterConfig, Expression } from "../types";

// 表情 → 音效文件映射
const expressionSfxMap: Partial<Record<Expression, string>> = {
  shocked:    "sfx/shock.wav",
  angry:      "sfx/slap.wav",
  cry:        "sfx/cry.wav",
  despair:    "sfx/sad_trombone.wav",
  laugh:      "sfx/mock.wav",
  smug:       "sfx/mock.wav",
  evil:       "sfx/suspense.wav",
  excited:    "sfx/ding.wav",
  speechless: "sfx/boop.wav",
  confused:   "sfx/boop.wav",
};

function getSfx(expression?: Expression): string | null {
  if (!expression) return null;
  return expressionSfxMap[expression] ?? null;
}

interface DialogueSceneProps {
  dialogue: DialogueLine[];
  leftCharacter: CharacterConfig;
  rightCharacter: CharacterConfig;
  backgroundImage?: string;
}

export const DialogueScene: React.FC<DialogueSceneProps> = ({
  dialogue,
  leftCharacter,
  rightCharacter,
  backgroundImage,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const isPortrait = height > width;
  const charScale = isPortrait ? 1.4 : 1.0;

  // Calculate cumulative start frames for each line
  const lineTimings = dialogue.reduce<{ start: number; duration: number }[]>(
    (acc, line, i) => {
      const start = i === 0 ? 0 : acc[i - 1].start + acc[i - 1].duration;
      return [...acc, { start, duration: line.duration }];
    },
    []
  );

  // Find which line is currently speaking
  const currentLineIndex = lineTimings.findIndex(
    (t) => frame >= t.start && frame < t.start + t.duration
  );
  const currentLine =
    currentLineIndex >= 0 ? dialogue[currentLineIndex] : null;

  const isLeftSpeaking = currentLine?.speaker === "left";
  const isRightSpeaking = currentLine?.speaker === "right";

  // Determine expressions
  let leftExpression: Expression = "default";
  let rightExpression: Expression = "default";

  if (currentLine) {
    if (currentLine.speaker === "left") {
      leftExpression = currentLine.expression || "default";
      rightExpression = currentLine.listenerExpression || "default";
    } else {
      rightExpression = currentLine.expression || "default";
      leftExpression = currentLine.listenerExpression || "default";
    }
  }

  // Scale effect: speaking character pops
  const leftScale = isLeftSpeaking
    ? charScale * 1.05
    : isRightSpeaking
      ? charScale * 0.95
      : charScale;
  const rightScale = isRightSpeaking
    ? charScale * 1.05
    : isLeftSpeaking
      ? charScale * 0.95
      : charScale;

  // Title entrance
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  const totalDuration =
    lineTimings[lineTimings.length - 1].start +
    lineTimings[lineTimings.length - 1].duration;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Background backgroundImage={backgroundImage} />

      {/* 对话切换音效：每句开头播放 ding，说话人表情有对应音效则叠加 */}
      {dialogue.map((line, i) => {
        const start = lineTimings[i].start;
        const sfx = getSfx(line.expression);
        return (
          <React.Fragment key={i}>
            {/* 每句切换提示音 */}
            <Sequence from={start} durationInFrames={15}>
              <Audio src={staticFile("sfx/ding.wav")} volume={0.25} />
            </Sequence>
            {/* 说话人表情对应音效 */}
            {sfx && (
              <Sequence from={start} durationInFrames={60}>
                <Audio src={staticFile(sfx)} volume={0.55} />
              </Sequence>
            )}
          </React.Fragment>
        );
      })}

      {/* Title bar */}
      <div
        style={{
          position: "absolute",
          top: isPortrait ? 60 : 20,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: titleOpacity,
          zIndex: 10,
        }}
      >
        <span
          style={{
            background: "rgba(0,0,0,0.5)",
            padding: "10px 32px",
            borderRadius: 24,
            color: "rgba(255,255,255,0.85)",
            fontSize: isPortrait ? 28 : 18,
            fontFamily: "PingFang SC, Microsoft YaHei, sans-serif",
            fontWeight: 600,
            letterSpacing: 2,
          }}
        >
          {leftCharacter.name} & {rightCharacter.name}
        </span>
      </div>

      {/* Speech bubble area */}
      <div
        style={{
          position: "absolute",
          top: isPortrait ? 140 : 60,
          left: 0,
          right: 0,
          height: isPortrait ? 500 : 300,
          zIndex: 20,
        }}
      >
        {dialogue.map((line, i) => {
          const timing = lineTimings[i];
          const charConfig =
            line.speaker === "left" ? leftCharacter : rightCharacter;
          return (
            <SpeechBubble
              key={i}
              text={line.text}
              side={line.speaker}
              startFrame={timing.start}
              duration={timing.duration}
              speakerName={charConfig.name}
              isPortrait={isPortrait}
            />
          );
        })}
      </div>

      {/* Left character */}
      <div
        style={{
          position: "absolute",
          bottom: isPortrait ? 40 : 10,
          left: isPortrait ? 60 : 40,
          transform: `scale(${leftScale})`,
          transformOrigin: "bottom center",
          filter: isRightSpeaking
            ? "brightness(0.5) saturate(0.5)"
            : "brightness(1)",
          zIndex: isLeftSpeaking ? 15 : 5,
        }}
      >
        <Character
          config={leftCharacter}
          isSpeaking={isLeftSpeaking}
          side="left"
          expression={leftExpression}
        />
      </div>

      {/* Right character */}
      <div
        style={{
          position: "absolute",
          bottom: isPortrait ? 40 : 10,
          right: isPortrait ? 20 : 40,
          transform: `scale(${rightScale})`,
          transformOrigin: "bottom center",
          filter: isLeftSpeaking
            ? "brightness(0.5) saturate(0.5)"
            : "brightness(1)",
          zIndex: isRightSpeaking ? 15 : 5,
        }}
      >
        <Character
          config={rightCharacter}
          isSpeaking={isRightSpeaking}
          side="right"
          expression={rightExpression}
        />
      </div>

      {/* 投资风险警示 */}
      <div
        style={{
          position: "absolute",
          bottom: isPortrait ? 18 : 14,
          left: isPortrait ? 20 : 16,
          zIndex: 30,
          background: "rgba(0,0,0,0.45)",
          borderRadius: 6,
          padding: isPortrait ? "5px 10px" : "3px 8px",
        }}
      >
        <span
          style={{
            color: "rgba(255,255,255,0.65)",
            fontSize: isPortrait ? 18 : 13,
            fontFamily: "PingFang SC, Microsoft YaHei, sans-serif",
            letterSpacing: 1,
          }}
        >
          以上内容纯属娱乐，不构成投资建议
        </span>
      </div>

      {/* Progress bar */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 6,
          background: "rgba(255,255,255,0.1)",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${(frame / totalDuration) * 100}%`,
            background:
              "linear-gradient(90deg, #667eea 0%, #f093fb 100%)",
            borderRadius: "0 3px 3px 0",
          }}
        />
      </div>
    </div>
  );
};
