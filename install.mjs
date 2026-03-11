#!/usr/bin/env node
/**
 * VidPilot cross-platform installer.
 *
 * Usage:
 *   node install.mjs /path/to/project
 *   node install.mjs                   # uses CWD as project dir
 */
import { execSync } from "child_process";
import { existsSync, copyFileSync, mkdirSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = __dirname;
const PROJECT_DIR = resolve(process.argv[2] || process.cwd());

function log(tag, msg) {
  console.log(`[${tag}] ${msg}`);
}

function run(cmd, opts = {}) {
  execSync(cmd, { stdio: "inherit", ...opts });
}

console.log("=== VidPilot Install ===\n");
console.log(`Skill dir:   ${SKILL_DIR}`);
console.log(`Project dir: ${PROJECT_DIR}\n`);

// 1. Check or create vidpilot.json in project
const configDest = join(PROJECT_DIR, "vidpilot.json");
if (!existsSync(configDest)) {
  copyFileSync(join(SKILL_DIR, "config.example.json"), configDest);
  log("ok", "Created vidpilot.json in project directory");
  log("info", "Edit vidpilot.json to configure your accounts, then re-run.");
} else {
  log("skip", "vidpilot.json already exists in project");
}

// 2. Install Remotion engine dependencies
console.log("\n[step] Installing engine dependencies...");
run("npm install --silent", { cwd: join(SKILL_DIR, "engine") });
log("ok", "Engine ready");

// 3. Setup account directories + generate registry.ts
console.log("\n[step] Setting up accounts...");
run(`node scripts/setup-accounts.mjs "${PROJECT_DIR}"`, { cwd: SKILL_DIR });

// 4. Create Python venv for TTS (optional)
console.log("\n[step] Setting up TTS environment...");
const venvDir = join(SKILL_DIR, ".venv");
try {
  if (!existsSync(venvDir)) {
    run("python3 -m venv .venv", { cwd: SKILL_DIR });
    log("ok", "Python venv created");
  }
  const pip = process.platform === "win32"
    ? join(venvDir, "Scripts", "pip")
    : join(venvDir, "bin", "pip");
  const python = process.platform === "win32"
    ? join(venvDir, "Scripts", "python")
    : join(venvDir, "bin", "python");
  try {
    execSync(`"${python}" -c "import ChatTTS"`, { stdio: "ignore" });
    log("skip", "TTS already installed");
  } catch {
    log("step", "Installing ChatTTS (this may take a few minutes)...");
    run(`"${pip}" install -q ChatTTS torch torchaudio soundfile numpy`);
    log("ok", "TTS ready");
  }
} catch {
  log("warn", "python3 not found, TTS unavailable");
}

console.log("\n=== Done ===\n");
console.log("Project structure:");
console.log(`  ${PROJECT_DIR}/`);
console.log("    vidpilot.json          - account config");
console.log("    accounts/{id}/         - character images");
console.log("      characters/          - left.png, right.png");
console.log("      backgrounds/         - bg.png");
console.log("      images/              - narration images (per-video)");
console.log("    output/{name}/         - archived videos");
console.log("\nNext: add character images to accounts/{id}/, then ask Claude to make a video!");
