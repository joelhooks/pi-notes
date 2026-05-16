#!/usr/bin/env bun
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const brainDir = join(root, ".brain");
const errors: string[] = [];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

if (!existsSync(brainDir)) {
  errors.push("missing .brain/ directory");
} else {
  const files = walk(brainDir).map((path) => path.slice(root.length + 1));
  const svxFiles = files.filter((path) => path.endsWith(".svx"));
  const nonSvxFiles = files.filter((path) => !path.endsWith(".svx"));

  if (!existsSync(join(brainDir, "index.svx"))) errors.push("missing .brain/index.svx");
  if (svxFiles.length === 0) errors.push(".brain/ contains no .svx pages");
  for (const file of nonSvxFiles) errors.push(`non-svx Brain source: ${file}`);

  console.log(`Brain pages: ${svxFiles.length}`);
}


if (errors.length > 0) {
  console.error(errors.map((error) => `brain:check error: ${error}`).join("\n"));
  process.exit(1);
}

console.log("brain:check passed");
