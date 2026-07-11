#!/usr/bin/env bun
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const brainDir = join(root, ".brain");
const errors: string[] = [];
const warnings: string[] = [];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function isAllowedBrainFile(path: string) {
  if (path.split("/").at(-1) === ".DS_Store") return true;
  if (path.endsWith(".svx")) return true;
  if (path.startsWith(".brain/data/")) return true;
  if (path.startsWith(".brain/components/") && path.endsWith(".svelte")) return true;
  if (/^\.brain\/[^/]+\.config\.[tj]s$/.test(path)) return true;
  return false;
}

function checkBrainComponentPerformance(path: string, source: string) {
  if (source.includes("<video") && !/preload\s*=\s*["']none["']/.test(source)) {
    warnings.push(`${path}: data-backed videos should use preload=\"none\"`);
  }
  if (source.includes("<img") && !/loading\s*=\s*["']lazy["']/.test(source)) {
    warnings.push(`${path}: data-backed images should use loading=\"lazy\"`);
  }
  if (source.includes("{@html") && /\b(record|item|row|tweet|source|text|body|content)\b/i.test(source)) {
    warnings.push(`${path}: render raw source fields as text, not {@html ...}`);
  }
  if ((source.includes("../data/") || source.includes(".brain/data")) && source.includes("{#each") && !/\b(page|visible|virtual|slice|limit|offset)\b/i.test(source)) {
    warnings.push(`${path}: large data-backed lists should paginate or virtualize`);
  }
}

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
    checkBrainComponentPerformance(file, readFileSync(join(root, file), "utf8"));
  }

  console.log(`Brain pages: ${svxFiles.length}`);
  for (const warning of warnings) console.warn(`brain:check warning: ${warning}`);
}


if (errors.length > 0) {
  console.error(errors.map((error) => `brain:check error: ${error}`).join("\n"));
  process.exit(1);
}

console.log("brain:check passed");
