import fs from "fs";
import path from "path";
import { AccountConfig, ThemeName } from "./types";

// Config file search order:
// 1. VIDPILOT_CONFIG env var
// 2. ~/.vidpilot/config.json
// 3. ./config.json (relative to engine root)
function findConfigPath(): string {
  if (process.env.VIDPILOT_CONFIG) {
    return process.env.VIDPILOT_CONFIG;
  }
  const home = process.env.HOME || process.env.USERPROFILE || "";
  const dotfileConfig = path.join(home, ".vidpilot", "config.json");
  if (fs.existsSync(dotfileConfig)) return dotfileConfig;

  const projectConfig = path.resolve(__dirname, "../../config.json");
  if (fs.existsSync(projectConfig)) return projectConfig;

  throw new Error(
    "vidpilot config not found. Create ~/.vidpilot/config.json or set VIDPILOT_CONFIG env var."
  );
}

interface RawCharacter {
  name: string;
  image: string;
  imageWidth: number;
  imageHeight: number;
  faceCenter: { x: number; y: number; radius: number };
}

interface RawAccount {
  name: string;
  outputDir: string;
  formats?: string[];
  characters: { left: RawCharacter; right: RawCharacter };
  backgroundImage: string;
  defaultTheme: string;
  voiceSeeds: { left: number; right: number; narrator: number };
  files: Record<string, string>;
}

interface RawConfig {
  global: { fps: number; width: number; height: number };
  accounts: Record<string, RawAccount>;
}

function expandHome(p: string): string {
  if (p.startsWith("~/")) {
    return path.join(process.env.HOME || "", p.slice(2));
  }
  return p;
}

function loadConfig(): { global: RawConfig["global"]; accounts: Record<string, AccountConfig> } {
  const configPath = findConfigPath();
  const raw: RawConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  const result: Record<string, AccountConfig> = {};

  for (const [id, acct] of Object.entries(raw.accounts)) {
    result[id] = {
      id,
      name: acct.name,
      outputDir: expandHome(acct.outputDir),
      leftCharacter: acct.characters.left,
      rightCharacter: acct.characters.right,
      backgroundImage: acct.backgroundImage,
      defaultTheme: acct.defaultTheme as ThemeName,
      voiceSeeds: acct.voiceSeeds,
      formats: acct.formats as any,
    };
  }
  return { global: raw.global, accounts: result };
}

const config = loadConfig();
export const globalConfig = config.global;
export const accounts = config.accounts;

export function getAccount(id: string): AccountConfig {
  const account = accounts[id];
  if (!account) {
    throw new Error(`Unknown account: "${id}". Available: ${Object.keys(accounts).join(", ")}`);
  }
  return account;
}
