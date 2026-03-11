import React from "react";
import { Expression } from "../types";

interface ExpressionProps {
  expression: Expression;
  isSpeaking: boolean;
  frame: number;
}

const speakMouth = (frame: number) => {
  const open = Math.sin(frame * 0.5);
  return open > 0.2;
};

// 眉毛组件 - 金馆长最关键的特征
const Eyebrows: React.FC<{
  leftAngle?: number;
  rightAngle?: number;
  y?: number;
  thick?: number;
  angry?: boolean;
}> = ({ leftAngle = 0, rightAngle = 0, y = -28, thick = 5, angry = false }) => (
  <g>
    <line
      x1="-42" y1={y - leftAngle * 0.8} x2="-16" y2={y + leftAngle * 0.8}
      stroke="#1a1a1a" strokeWidth={thick} strokeLinecap="round"
    />
    <line
      x1="16" y1={y + rightAngle * 0.8} x2="42" y2={y - rightAngle * 0.8}
      stroke="#1a1a1a" strokeWidth={thick} strokeLinecap="round"
    />
    {angry && (
      <>
        <line x1="-38" y1={y - 3} x2="-20" y2={y + 5} stroke="#1a1a1a" strokeWidth={thick + 1} strokeLinecap="round" />
        <line x1="20" y1={y + 5} x2="38" y2={y - 3} stroke="#1a1a1a" strokeWidth={thick + 1} strokeLinecap="round" />
      </>
    )}
  </g>
);

// 眼睛组件
const Eyes: React.FC<{
  size?: number;
  pupilSize?: number;
  pupilOffsetY?: number;
  wide?: boolean;
}> = ({ size = 10, pupilSize = 6, pupilOffsetY = 0, wide = false }) => (
  <g>
    {/* 眼白 */}
    <ellipse cx="-30" cy="-5" rx={size + 4} ry={wide ? size + 8 : size + 2} fill="white" stroke="#1a1a1a" strokeWidth="2.5" />
    <ellipse cx="30" cy="-5" rx={size + 4} ry={wide ? size + 8 : size + 2} fill="white" stroke="#1a1a1a" strokeWidth="2.5" />
    {/* 瞳孔 */}
    <ellipse cx="-30" cy={-5 + pupilOffsetY} rx={pupilSize} ry={pupilSize} fill="#1a1a1a" />
    <ellipse cx="30" cy={-5 + pupilOffsetY} rx={pupilSize} ry={pupilSize} fill="#1a1a1a" />
    {/* 高光 */}
    <ellipse cx={-30 + pupilSize * 0.4} cy={-5 + pupilOffsetY - pupilSize * 0.35} rx="3" ry="3" fill="white" />
    <ellipse cx={30 + pupilSize * 0.4} cy={-5 + pupilOffsetY - pupilSize * 0.35} rx="3" ry="3" fill="white" />
  </g>
);

// 鼻子
const Nose: React.FC = () => (
  <ellipse cx="0" cy="12" rx="4" ry="3" fill="#ddd" />
);

// 腮红
const Blush: React.FC<{ opacity?: number; intense?: boolean }> = ({ opacity = 0.3, intense = false }) => (
  <g>
    <ellipse cx="-46" cy="15" rx={intense ? 18 : 14} ry={intense ? 10 : 8} fill="#FF6666" opacity={opacity} />
    <ellipse cx="46" cy="15" rx={intense ? 18 : 14} ry={intense ? 10 : 8} fill="#FF6666" opacity={opacity} />
  </g>
);

// Head radius = 88, expressions scaled for big head
export const PandaFace: React.FC<ExpressionProps> = ({
  expression,
  isSpeaking,
  frame,
}) => {
  const mouthOpen = isSpeaking && speakMouth(frame);

  switch (expression) {
    case "default":
      return (
        <g>
          <Eyebrows leftAngle={2} rightAngle={2} />
          <Eyes />
          <Nose />
          {mouthOpen ? (
            <ellipse cx="0" cy="28" rx="14" ry="10" fill="#2d2d2d" />
          ) : (
            <path d="M-14,24 Q0,36 14,24" fill="none" stroke="#1a1a1a" strokeWidth="3.5" strokeLinecap="round" />
          )}
          <Blush />
        </g>
      );

    case "smile":
      return (
        <g>
          <Eyebrows leftAngle={-3} rightAngle={-3} />
          <Eyes size={9} pupilSize={5} />
          <Nose />
          {mouthOpen ? (
            <g>
              <ellipse cx="0" cy="28" rx="18" ry="12" fill="#2d2d2d" />
              <rect x="-12" y="20" width="24" height="8" rx="2" fill="white" />
            </g>
          ) : (
            <path d="M-16,24 Q0,38 16,24" fill="none" stroke="#1a1a1a" strokeWidth="3.5" strokeLinecap="round" />
          )}
          <Blush opacity={0.4} />
        </g>
      );

    case "laugh":
      return (
        <g>
          <Eyebrows leftAngle={-5} rightAngle={-5} thick={4} />
          {/* 笑到眯眼 */}
          <path d="M-40,-6 Q-30,4 -20,-6" fill="none" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round" />
          <path d="M20,-6 Q30,4 40,-6" fill="none" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round" />
          <Nose />
          {/* 大张嘴笑 */}
          <ellipse cx="0" cy="28" rx="24" ry="18" fill="#2d2d2d" />
          <rect x="-14" y="16" width="28" height="10" rx="3" fill="white" />
          <ellipse cx="0" cy="38" rx="14" ry="6" fill="#c0392b" />
          <Blush opacity={0.5} intense />
          {/* 笑出眼泪 */}
          <path d="M-42,-2 L-48,14" stroke="#5dade2" strokeWidth="3" strokeLinecap="round" opacity={0.6} />
          <path d="M42,-2 L48,14" stroke="#5dade2" strokeWidth="3" strokeLinecap="round" opacity={0.6} />
        </g>
      );

    case "smug":
      return (
        <g>
          {/* 一高一低的挑眉 */}
          <line x1="-42" y1="-30" x2="-16" y2="-24" stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round" />
          <line x1="16" y1="-34" x2="42" y2="-26" stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round" />
          {/* 左眼眯起，右眼正常 */}
          <path d="M-40,-6 Q-30,2 -20,-6" fill="none" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round" />
          <ellipse cx="30" cy="-5" rx="12" ry="11" fill="white" stroke="#1a1a1a" strokeWidth="2.5" />
          <ellipse cx="30" cy="-5" rx="6" ry="6" fill="#1a1a1a" />
          <ellipse cx="33" cy="-8" rx="2.5" ry="2.5" fill="white" />
          <Nose />
          {mouthOpen ? (
            <g>
              <ellipse cx="5" cy="28" rx="14" ry="10" fill="#2d2d2d" />
              <rect x="-6" y="22" width="22" height="6" rx="2" fill="white" />
            </g>
          ) : (
            <path d="M-12,24 Q4,24 16,16" fill="none" stroke="#1a1a1a" strokeWidth="3.5" strokeLinecap="round" />
          )}
        </g>
      );

    case "shocked":
      return (
        <g>
          {/* 眉毛飞起 */}
          <Eyebrows leftAngle={-8} rightAngle={-8} y={-36} thick={5} />
          {/* 瞪大的眼睛 */}
          <Eyes size={14} pupilSize={5} pupilOffsetY={2} wide />
          <Nose />
          {/* O型嘴 */}
          <ellipse cx="0" cy="32" rx="14" ry="18" fill="#2d2d2d" />
          {/* 惊讶汗珠 */}
          <path d="M52,-20 Q58,-10 52,0" fill="#5dade2" opacity={0.6} />
          <text x="-56" y="-32" fontSize="22" fill="#e74c3c" fontWeight="bold" fontFamily="Arial">!</text>
        </g>
      );

    case "angry":
      return (
        <g>
          {/* 倒八字怒眉 */}
          <Eyebrows leftAngle={8} rightAngle={8} thick={6} angry />
          {/* 怒瞪的眼 */}
          <ellipse cx="-30" cy="-3" rx="12" ry="10" fill="white" stroke="#1a1a1a" strokeWidth="2.5" />
          <ellipse cx="30" cy="-3" rx="12" ry="10" fill="white" stroke="#1a1a1a" strokeWidth="2.5" />
          <ellipse cx="-30" cy="-2" rx="7" ry="7" fill="#1a1a1a" />
          <ellipse cx="30" cy="-2" rx="7" ry="7" fill="#1a1a1a" />
          <ellipse cx="-28" cy="-4" rx="2.5" ry="2.5" fill="white" />
          <ellipse cx="32" cy="-4" rx="2.5" ry="2.5" fill="white" />
          <Nose />
          {mouthOpen ? (
            <g>
              <rect x="-22" y="20" width="44" height="22" rx="6" fill="#2d2d2d" />
              <rect x="-14" y="20" width="28" height="8" rx="2" fill="white" />
            </g>
          ) : (
            <g>
              <rect x="-22" y="24" width="44" height="16" rx="6" fill="#2d2d2d" />
              <rect x="-14" y="24" width="28" height="6" rx="2" fill="white" />
            </g>
          )}
          {/* 怒火 */}
          <g transform="translate(50, -38)">
            <path d="M0,0 L5,-3 L3,4 L9,0 L5,6 L12,3" stroke="#e74c3c" strokeWidth="3" fill="none" />
          </g>
          <g transform="translate(-54, -34)">
            <path d="M0,0 L-4,-3 L-2,4 L-8,0 L-4,6 L-10,3" stroke="#e74c3c" strokeWidth="2.5" fill="none" />
          </g>
        </g>
      );

    case "cry":
      return (
        <g>
          {/* 悲伤八字眉 */}
          <line x1="-42" y1="-32" x2="-16" y2="-24" stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round" />
          <line x1="16" y1="-24" x2="42" y2="-32" stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round" />
          {/* 含泪大眼 */}
          <ellipse cx="-30" cy="-3" rx="14" ry="14" fill="white" stroke="#1a1a1a" strokeWidth="2" />
          <ellipse cx="30" cy="-3" rx="14" ry="14" fill="white" stroke="#1a1a1a" strokeWidth="2" />
          <ellipse cx="-30" cy="-1" rx="7" ry="7" fill="#1a1a1a" />
          <ellipse cx="30" cy="-1" rx="7" ry="7" fill="#1a1a1a" />
          {/* 泪水 - 两行 */}
          <path d="M-18,8 L-22,48" stroke="#5dade2" strokeWidth="4" strokeLinecap="round" opacity={0.8} />
          <path d="M18,8 L22,48" stroke="#5dade2" strokeWidth="4" strokeLinecap="round" opacity={0.8} />
          <ellipse cx="-22" cy="50" rx="5" ry="6" fill="#5dade2" opacity={0.5} />
          <ellipse cx="22" cy="50" rx="5" ry="6" fill="#5dade2" opacity={0.5} />
          <Nose />
          {/* 哭嘴 */}
          <path d="M-16,28 Q-8,24 0,28 Q8,36 16,28" fill="none" stroke="#1a1a1a" strokeWidth="3.5" strokeLinecap="round" />
        </g>
      );

    case "speechless":
      return (
        <g>
          {/* 平直眉 */}
          <Eyebrows leftAngle={0} rightAngle={0} />
          {/* 无神的眼 */}
          <ellipse cx="-30" cy="-3" rx="12" ry="12" fill="white" stroke="#1a1a1a" strokeWidth="2" />
          <ellipse cx="30" cy="-3" rx="12" ry="12" fill="white" stroke="#1a1a1a" strokeWidth="2" />
          <ellipse cx="-30" cy="-3" rx="5" ry="5" fill="#666" />
          <ellipse cx="30" cy="-3" rx="5" ry="5" fill="#666" />
          <Nose />
          {/* 一横嘴 */}
          <line x1="-16" y1="28" x2="16" y2="28" stroke="#1a1a1a" strokeWidth="3.5" strokeLinecap="round" />
          {/* 省略号 */}
          <g transform="translate(0, -50)">
            <circle cx="-12" cy="0" r="3" fill="#999" />
            <circle cx="0" cy="0" r="3" fill="#999" />
            <circle cx="12" cy="0" r="3" fill="#999" />
          </g>
        </g>
      );

    case "confused":
      return (
        <g>
          {/* 一高一低困惑眉 */}
          <line x1="-42" y1="-26" x2="-16" y2="-30" stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round" />
          <path d="M16,-34 Q28,-24 42,-30" fill="none" stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round" />
          {/* 大小不一的眼 */}
          <ellipse cx="-30" cy="-3" rx="10" ry="11" fill="white" stroke="#1a1a1a" strokeWidth="2.5" />
          <ellipse cx="30" cy="-3" rx="14" ry="15" fill="white" stroke="#1a1a1a" strokeWidth="2.5" />
          <ellipse cx="-30" cy="-3" rx="5" ry="5" fill="#1a1a1a" />
          <ellipse cx="30" cy="-3" rx="7" ry="7" fill="#1a1a1a" />
          <ellipse cx="-28" cy="-5" rx="2.5" ry="2.5" fill="white" />
          <ellipse cx="33" cy="-6" rx="3" ry="3" fill="white" />
          <Nose />
          {/* 小嘴 */}
          <ellipse cx="3" cy="28" rx="7" ry="6" fill="#2d2d2d" />
          {/* 问号 */}
          <g transform="translate(54, -32)">
            <text fontSize="32" fontWeight="bold" fill="#e67e22" fontFamily="Arial">?</text>
          </g>
        </g>
      );

    case "contempt":
      return (
        <g>
          {/* 鄙视眉 - 一边压低 */}
          <line x1="-42" y1="-24" x2="-16" y2="-28" stroke="#1a1a1a" strokeWidth="5.5" strokeLinecap="round" />
          <line x1="16" y1="-32" x2="42" y2="-24" stroke="#1a1a1a" strokeWidth="5.5" strokeLinecap="round" />
          {/* 眯眼 */}
          <path d="M-42,-4 L-18,-4" stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round" />
          <path d="M18,-4 L42,-4" stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round" />
          <Nose />
          {mouthOpen ? (
            <path d="M-10,28 Q2,22 18,16" fill="none" stroke="#1a1a1a" strokeWidth="3.5" strokeLinecap="round" />
          ) : (
            <path d="M-10,24 Q6,24 18,16" fill="none" stroke="#1a1a1a" strokeWidth="3.5" strokeLinecap="round" />
          )}
        </g>
      );

    case "shy":
      return (
        <g>
          <Eyebrows leftAngle={-3} rightAngle={-3} thick={4} />
          {/* 害羞眯眼 */}
          <path d="M-40,-4 Q-30,6 -20,-4" fill="none" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round" />
          <path d="M20,-4 Q30,6 40,-4" fill="none" stroke="#1a1a1a" strokeWidth="4" strokeLinecap="round" />
          <Nose />
          <path d="M-10,26 Q0,34 10,26" fill="none" stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round" />
          <Blush opacity={0.6} intense />
          {/* 害羞汗 */}
          <path d="M48,-24 Q54,-14 48,0" fill="#5dade2" opacity={0.4} />
        </g>
      );

    case "excited":
      return (
        <g>
          {/* 眉毛飞起 */}
          <Eyebrows leftAngle={-6} rightAngle={-6} y={-34} thick={5} />
          {/* 星星眼 */}
          <g transform="translate(-30, -5) scale(1.1)">
            <polygon points="0,-14 4,-5 14,-5 6,2 8,14 0,7 -8,14 -6,2 -14,-5 -4,-5" fill="#f39c12" />
          </g>
          <g transform="translate(30, -5) scale(1.1)">
            <polygon points="0,-14 4,-5 14,-5 6,2 8,14 0,7 -8,14 -6,2 -14,-5 -4,-5" fill="#f39c12" />
          </g>
          <Nose />
          {/* 兴奋大张嘴 */}
          <ellipse cx="0" cy="30" rx="22" ry="14" fill="#2d2d2d" />
          <rect x="-14" y="22" width="28" height="8" rx="3" fill="white" />
          <Blush opacity={0.5} intense />
          {/* 闪闪发光 */}
          <text x="-60" y="-34" fontSize="20" fill="#f1c40f">✦</text>
          <text x="48" y="-38" fontSize="14" fill="#f1c40f">✦</text>
          <text x="56" y="10" fontSize="12" fill="#f1c40f">✧</text>
        </g>
      );

    case "despair":
      return (
        <g>
          {/* 极度悲伤的八字眉 */}
          <line x1="-42" y1="-36" x2="-16" y2="-22" stroke="#1a1a1a" strokeWidth="5.5" strokeLinecap="round" />
          <line x1="16" y1="-22" x2="42" y2="-36" stroke="#1a1a1a" strokeWidth="5.5" strokeLinecap="round" />
          {/* 空洞的死鱼眼 */}
          <ellipse cx="-30" cy="-3" rx="12" ry="12" fill="#1a1a1a" />
          <ellipse cx="30" cy="-3" rx="12" ry="12" fill="#1a1a1a" />
          <ellipse cx="-30" cy="-3" rx="3" ry="3" fill="white" />
          <ellipse cx="30" cy="-3" rx="3" ry="3" fill="white" />
          <Nose />
          {/* 波浪嘴 */}
          <path d="M-18,24 Q-10,36 0,24 Q10,36 18,24" fill="#2d2d2d" stroke="#1a1a1a" strokeWidth="1.5" />
          {/* 灵魂出窍的乌云 */}
          <g opacity={0.25} transform="translate(0, -72)">
            <ellipse cx="0" cy="0" rx="18" ry="12" fill="#888" />
            <path d="M-12,10 L-12,24 Q-6,18 0,24 Q6,18 12,24 L12,10" fill="#888" />
          </g>
          {/* 眼下阴影（疲惫） */}
          <path d="M-40,10 Q-30,16 -20,10" fill="none" stroke="#aaa" strokeWidth="2" opacity={0.4} />
          <path d="M20,10 Q30,16 40,10" fill="none" stroke="#aaa" strokeWidth="2" opacity={0.4} />
        </g>
      );

    case "evil":
      return (
        <g>
          {/* 压低的邪恶眉 */}
          <line x1="-42" y1="-18" x2="-16" y2="-26" stroke="#1a1a1a" strokeWidth="5.5" strokeLinecap="round" />
          <line x1="16" y1="-26" x2="42" y2="-18" stroke="#1a1a1a" strokeWidth="5.5" strokeLinecap="round" />
          {/* 眯起的邪恶眼 */}
          <path d="M-42,-6 L-18,-2" stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round" />
          <path d="M18,-2 L42,-6" stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round" />
          {/* 微弱高光 */}
          <ellipse cx="-28" cy="-6" rx="2.5" ry="1.5" fill="white" opacity={0.7} />
          <ellipse cx="32" cy="-6" rx="2.5" ry="1.5" fill="white" opacity={0.7} />
          <Nose />
          {mouthOpen ? (
            <g>
              <path d="M-22,20 Q0,44 22,20" fill="#2d2d2d" />
              {/* 锯齿牙 */}
              <path d="M-16,20 L-12,28 L-8,20 L-4,28 L0,20 L4,28 L8,20 L12,28 L16,20" fill="white" />
            </g>
          ) : (
            <path d="M-22,24 Q0,42 22,24" fill="#2d2d2d" />
          )}
          {/* 邪恶光环 */}
          <ellipse cx="0" cy="0" rx="60" ry="55" fill="none" stroke="#e74c3c" strokeWidth="0.8" opacity={0.15} />
        </g>
      );

    default:
      return (
        <g>
          <Eyebrows leftAngle={2} rightAngle={2} />
          <Eyes />
          <Nose />
          <path d="M-14,24 Q0,36 14,24" fill="none" stroke="#1a1a1a" strokeWidth="3.5" strokeLinecap="round" />
          <Blush />
        </g>
      );
  }
};
