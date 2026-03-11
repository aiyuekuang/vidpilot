import fs from "fs";
import path from "path";
import { AccountConfig, ThemeName } from "./types";

// Config file search order:
// 1. VIDPILOT_CONFIG env var (absolute path)
// 2. VIDPILOT_PROJECT env var + /vidpilot.json
// 3. CWD/vidpilot.json (project root)
function findConfigPath(): string {
  if (process.env.VIDPILOT_CONFIG) {
    return process.env.VIDPILOT_CONFIG;
  }
  if (process.env.VIDPILOT_PROJECT) {
    const p = path.join(process.env.VIDPILOT_PROJECT, "vidpilot.json");
    if (fs.existsSync(p)) return p;
  }
  const cwdConfig = path.resolve(process.cwd(), "vidpilot.json");
  if (fs.existsSync(cwdConfig)) return cwdConfig;

  throw new Error(
    "vidpilot.json not found in project directory. See config.example.json in the skill repo."
  );
}

// ── Raw config types (match vidpilot.json schema v1) ──

interface RawCharacter {
  name: string;
  image: string;
  size: [number, number];     // [width, height]
  face: [number, number, number]; // [x, y, radius]
}

interface RawAccount {
  name: string;
  formats?: string[];
  theme?: string;
  characters: { left: RawCharacter; right: RawCharacter };
  background: string;
  tts: { left: number; right: number; narrator: number };
}

interface RawConfig {
  version: number;
  video: { fps: number; width: number; height: number };
  accounts: Record<string, RawAccount>;
}

function parseCharacter(raw: RawCharacter) {
  return {
    name: raw.name,
    image: raw.image,
    imageWidth: raw.size[0],
    imageHeight: raw.size[1],
    faceCenter: { x: raw.face[0], y: raw.face[1], radius: raw.face[2] },
  };
}

function loadConfig(): { video: RawConfig["video"]; accounts: Record<string, AccountConfig> } {
  const configPath = findConfigPath();
  const raw: RawConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  const result: Record<string, AccountConfig> = {};

  for (const [id, acct] of Object.entries(raw.accounts)) {
    result[id] = {
      id,
      name: acct.name,
      outputDir: path.resolve(path.dirname(configPath), "output", id),
      leftCharacter: parseCharacter(acct.characters.left),
      rightCharacter: parseCharacter(acct.characters.right),
      backgroundImage: acct.background,
      defaultTheme: (acct.theme || "dark") as ThemeName,
      voiceSeeds: acct.tts,
      formats: acct.formats as any,
    };
  }
  return { video: raw.video, accounts: result };
}

const config = loadConfig();
export const globalConfig = config.video;
export const accounts = config.accounts;

export function getAccount(id: string): AccountConfig {
  const account = accounts[id];
  if (!account) {
    throw new Error(`Unknown account: "${id}". Available: ${Object.keys(accounts).join(", ")}`);
  }
  return account;
}
