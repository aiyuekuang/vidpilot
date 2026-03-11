import React from "react";
import { Composition } from "remotion";
import { DialogueScene } from "./components/DialogueScene";
import { SlideScene } from "./components/SlideScene";
import { RankScene } from "./components/RankScene";
import { CodeScene } from "./components/CodeScene";
import { NarrationScene } from "./components/NarrationScene";
import { accounts, globalConfig } from "./accounts";
import { registry } from "./data/registry";

// Composition ID: {accountId}-{format}
// Example: laodong-dialogue, stock-dialogue, laodong-slides

export const RemotionRoot: React.FC = () => {
  const { fps, width, height } = globalConfig;

  return (
    <>
      {Object.entries(accounts).map(([accountId, account]) => {
        const data = registry[accountId];
        if (!data) return null;

        const compositions: React.ReactNode[] = [];

        if (data.dialogue && data.dialogue.totalFrames > 0) {
          compositions.push(
            <Composition
              key={`${accountId}-dialogue`}
              id={`${accountId}-dialogue`}
              component={DialogueScene}
              durationInFrames={data.dialogue.totalFrames}
              fps={fps}
              width={width}
              height={height}
              defaultProps={{
                dialogue: data.dialogue.data,
                leftCharacter: account.leftCharacter,
                rightCharacter: account.rightCharacter,
                backgroundImage: account.backgroundImage,
              }}
            />
          );
        }

        if (data.slides && data.slides.totalFrames > 0) {
          compositions.push(
            <Composition
              key={`${accountId}-slides`}
              id={`${accountId}-slides`}
              component={SlideScene}
              durationInFrames={data.slides.totalFrames}
              fps={fps}
              width={width}
              height={height}
              defaultProps={{
                slides: data.slides.data,
                theme: (data.slides.theme || account.defaultTheme) as any,
                title: account.name,
              }}
            />
          );
        }

        if (data.ranking && data.ranking.totalFrames > 0) {
          compositions.push(
            <Composition
              key={`${accountId}-ranking`}
              id={`${accountId}-ranking`}
              component={RankScene}
              durationInFrames={data.ranking.totalFrames}
              fps={fps}
              width={width}
              height={height}
              defaultProps={{
                slides: data.ranking.data,
                theme: (data.ranking.theme || account.defaultTheme) as any,
                title: account.name,
              }}
            />
          );
        }

        if (data.code && data.code.totalFrames > 0) {
          compositions.push(
            <Composition
              key={`${accountId}-code`}
              id={`${accountId}-code`}
              component={CodeScene}
              durationInFrames={data.code.totalFrames}
              fps={fps}
              width={width}
              height={height}
              defaultProps={{
                steps: data.code.data,
                theme: (data.code.theme || account.defaultTheme) as any,
                title: account.name,
              }}
            />
          );
        }

        if (data.narration && data.narration.totalFrames > 0) {
          compositions.push(
            <Composition
              key={`${accountId}-narration`}
              id={`${accountId}-narration`}
              component={NarrationScene}
              durationInFrames={data.narration.totalFrames}
              fps={fps}
              width={width}
              height={height}
              defaultProps={{
                segments: data.narration.data,
                theme: (data.narration.theme || account.defaultTheme) as any,
                title: account.name,
              }}
            />
          );
        }

        return compositions;
      })}
    </>
  );
};
