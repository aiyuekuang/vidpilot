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

function resolvePath(p: string, projectRoot: string): string {
  if (p.startsWith("~/")) {
    return path.join(process.env.HOME || "", p.slice(2));
  }
  if (path.isAbsolute(p)) return p;
  return path.resolve(projectRoot, p);
}

function loadConfig(): { global: RawConfig["global"]; accounts: Record<string, AccountConfig> } {
  const configPath = findConfigPath();
  const projectRoot = path.dirname(configPath);
  const raw: RawConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  const result: Record<string, AccountConfig> = {};

  for (const [id, acct] of Object.entries(raw.accounts)) {
    result[id] = {
      id,
      name: acct.name,
      outputDir: resolvePath(acct.outputDir, projectRoot),
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
