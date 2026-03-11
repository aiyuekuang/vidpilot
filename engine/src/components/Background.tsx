import React from "react";
import { useCurrentFrame, interpolate, staticFile, Img } from "remotion";

interface BackgroundProps {
  backgroundImage?: string;
}

export const Background: React.FC<BackgroundProps> = ({
  backgroundImage,
}) => {
  const frame = useCurrentFrame();

  // Try to use custom background image, fallback to gradient
  const hasBgImage = !!backgroundImage;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
      }}
    >
      {/* Background image or gradient fallback */}
      {hasBgImage ? (
        <>
          <Img
            src={staticFile(backgroundImage!)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
          {/* Dark overlay for readability */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.2) 40%, rgba(0,0,0,0.5) 100%)",
            }}
          />
        </>
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)`,
          }}
        />
      )}

      {/* Floating particles */}
      {Array.from({ length: 10 }).map((_, i) => {
        const x = (i * 137.5) % 100;
        const baseY = (i * 73.7) % 100;
        const y =
          baseY +
          interpolate(Math.sin(frame * 0.02 + i * 1.5), [-1, 1], [-6, 6]);
        const size = 3 + (i % 4) * 2;
        const opacity = interpolate(
          Math.sin(frame * 0.03 + i),
          [-1, 1],
          [0.05, 0.2]
        );

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              width: size,
              height: size,
              borderRadius: "50%",
              background: "white",
              opacity,
            }}
          />
        );
      })}

      {/* Ground area */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "25%",
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.3) 100%)",
        }}
      />
    </div>
  );
};
