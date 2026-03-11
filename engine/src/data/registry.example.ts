/**
 * Data registry template.
 *
 * Copy this file to registry.ts and add your account data imports.
 * The vidpilot skill auto-updates registry.ts when generating content.
 *
 * Usage:
 *   cp registry.example.ts registry.ts
 *   # Then add your account imports and register them below.
 */

// ── Example account data ─────────────────────────────────────
import { dialogue as exampleDialogue } from "./example/dialogue.example";
import { slides as exampleSlides, theme as exampleSlidesTheme } from "./example/slides.example";
import { rankSlides as exampleRankSlides, theme as exampleRankTheme } from "./example/ranking.example";
import { codeSteps as exampleCodeSteps, theme as exampleCodeTheme } from "./example/code.example";
import { segments as exampleSegments, theme as exampleNarrationTheme } from "./example/narration.example";

// ── Registry type ────────────────────────────────────────────
interface FormatData {
  data: any[];
  totalFrames: number;
  theme?: string;
}

export interface AccountDataRegistry {
  dialogue?: FormatData;
  slides?: FormatData;
  ranking?: FormatData;
  code?: FormatData;
  narration?: FormatData;
}

function sumFrames(items: { duration: number }[]): number {
  return items.reduce((s, l) => s + l.duration, 0);
}

// ── Register your accounts here ──────────────────────────────
// The skill auto-updates this section when generating content.
// Format: accountId -> { format -> { data, totalFrames, theme? } }

export const registry: Record<string, AccountDataRegistry> = {
  example: {
    dialogue: {
      data: exampleDialogue,
      totalFrames: sumFrames(exampleDialogue),
    },
    slides: {
      data: exampleSlides,
      totalFrames: sumFrames(exampleSlides),
      theme: exampleSlidesTheme,
    },
    ranking: {
      data: exampleRankSlides,
      totalFrames: sumFrames(exampleRankSlides),
      theme: exampleRankTheme,
    },
    code: {
      data: exampleCodeSteps,
      totalFrames: sumFrames(exampleCodeSteps),
      theme: exampleCodeTheme,
    },
    narration: {
      data: exampleSegments,
      totalFrames: sumFrames(exampleSegments),
      theme: exampleNarrationTheme,
    },
  },
};
