#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..");

function usage(exitCode = 0): never {
  console.log(`pi-notes

Usage:
  pi-notes brain check [repo]
  pi-notes rig install <repo>
  pi-notes inbox [repo]
  pi-notes diagram compile <file>
`);
  process.exit(exitCode);
}

function runBunScript(script: string, args: string[]) {
  const result = spawnSync("bun", [join(packageRoot, "scripts", script), ...args], {
    stdio: "inherit",
    cwd: process.cwd(),
    env: process.env,
  });
  process.exit(result.status ?? 1);
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function isAllowedBrainFile(path: string) {
  if (path.endsWith(".svx")) return true;
  if (path.startsWith(".brain/data/")) return true;
  if (path.startsWith(".brain/components/") && path.endsWith(".svelte")) return true;
  if (/^\.brain\/[^/]+\.config\.[tj]s$/.test(path)) return true;
  return false;
}

function componentPerformanceWarnings(path: string, source: string) {
  const warnings: string[] = [];
  if (source.includes("<video") && !/preload\s*=\s*["']none["']/.test(source)) warnings.push(`${path}: data-backed videos should use preload=\"none\"`);
  if (source.includes("<img") && !/loading\s*=\s*["']lazy["']/.test(source)) warnings.push(`${path}: data-backed images should use loading=\"lazy\"`);
  if (source.includes("{@html") && /\b(record|item|row|tweet|source|text|body|content)\b/i.test(source)) warnings.push(`${path}: render raw source fields as text, not {@html ...}`);
  if ((source.includes("../data/") || source.includes(".brain/data")) && source.includes("{#each") && !/\b(page|visible|virtual|slice|limit|offset)\b/i.test(source)) warnings.push(`${path}: large data-backed lists should paginate or virtualize`);
  return warnings;
}

function brainCheck(repoArg?: string) {
  const root = resolve(process.cwd(), repoArg ?? ".");
  const brainDir = join(root, ".brain");
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!existsSync(brainDir)) {
    errors.push("missing .brain/ directory");
  } else {
    const files = walk(brainDir).map((path) => path.slice(root.length + 1));
    const svxFiles = files.filter((path) => path.endsWith(".svx"));
    const invalidFiles = files.filter((path) => !isAllowedBrainFile(path));

    if (!existsSync(join(brainDir, "index.svx"))) errors.push("missing .brain/index.svx");
    if (svxFiles.length === 0) errors.push(".brain/ contains no .svx pages");
    for (const file of invalidFiles) errors.push(`unsupported Brain support file: ${file}`);
    for (const file of files.filter((path) => path.startsWith(".brain/components/") && path.endsWith(".svelte"))) {
      warnings.push(...componentPerformanceWarnings(file, readFileSync(join(root, file), "utf8")));
    }

    console.log(`Brain pages: ${svxFiles.length}`);
    for (const warning of warnings) console.warn(`brain:check warning: ${warning}`);
  }

  if (errors.length > 0) {
    console.error(errors.map((error) => `brain:check error: ${error}`).join("\n"));
    process.exit(1);
  }

  console.log("brain:check passed");
}

const [cmd, subcmd, ...rest] = process.argv.slice(2);

if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") usage(0);

if (cmd === "brain" && subcmd === "check") brainCheck(rest[0]);
else if (cmd === "rig" && subcmd === "install") {
  const target = rest[0];
  if (!target) usage(1);
  runBunScript("install-rig.ts", [target]);
} else if (cmd === "inbox") runBunScript("read-notes-inbox.ts", rest);
else if (cmd === "diagram" && subcmd === "compile") runBunScript("compile-diagram.ts", rest);
else usage(1);
