#!/usr/bin/env bun
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const updateManaged = args.includes("--update-managed");
const targetArg = args.find((arg) => !arg.startsWith("--"));
if (!targetArg) {
  console.error("Usage: bun run rig:install -- [--update-managed] <target-repo>");
  process.exit(1);
}

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const templateRoot = join(packageRoot, "templates", "default");
const targetRoot = resolve(process.cwd(), targetArg);
const projectSlug = basename(targetRoot);
const projectTitle = projectSlug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

type Action = "created" | "updated" | "exists" | "missing";
type Result = { path: string; action: Action; note?: string };

function readMaybe(path: string) {
  return existsSync(path) ? readFileSync(path, "utf8") : undefined;
}

function renderTemplate(source: string) {
  return source.replaceAll("{{projectTitle}}", projectTitle).replaceAll("{{projectSlug}}", projectSlug);
}

function walkFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walkFiles(path);
    return entry.isFile() ? [path] : [];
  });
}

function writeFile(path: string, content: string, action: Action): Result {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content.endsWith("\n") ? content : `${content}\n`, "utf8");
  return { path, action };
}

function managedMarker(content: string) {
  const match = content.match(/<!--\s*(pi-notes-[a-z0-9-]+:start)\s*-->/i);
  if (!match?.[1]) return undefined;
  const start = `<!-- ${match[1]} -->`;
  const end = start.replace(":start", ":end");
  return { start, end };
}

function upsertManagedBlock(targetPath: string, template: string): Result {
  const marker = managedMarker(template);
  const current = readMaybe(targetPath);
  if (!current) return writeFile(targetPath, template, "created");
  if (!marker) return { path: targetPath, action: "exists" };

  const startIndex = current.indexOf(marker.start);
  const endIndex = current.indexOf(marker.end);
  if (startIndex >= 0 && endIndex >= startIndex) {
    if (!updateManaged) return { path: targetPath, action: "exists", note: "managed block present" };
    const afterEnd = endIndex + marker.end.length;
    const next = `${current.slice(0, startIndex).trimEnd()}\n\n${template.trim()}\n\n${current.slice(afterEnd).trimStart()}`.trimEnd() + "\n";
    if (next === current) return { path: targetPath, action: "exists" };
    return writeFile(targetPath, next, "updated");
  }

  const next = `${current.trimEnd()}\n\n${template.trim()}\n`;
  return writeFile(targetPath, next, "updated");
}

function installTemplateFile(relativePath: string): Result {
  const sourcePath = join(templateRoot, relativePath);
  const targetPath = join(targetRoot, relativePath);
  const template = renderTemplate(readFileSync(sourcePath, "utf8"));

  if (["AGENTS.md", "CLAUDE.md", join(".pi", "APPEND_SYSTEM.md")].includes(relativePath)) {
    return upsertManagedBlock(targetPath, template);
  }

  if (existsSync(targetPath)) return { path: targetPath, action: "exists" };
  return writeFile(targetPath, template, "created");
}

function updatePackageScripts(path: string): Result {
  const current = readMaybe(path);
  if (!current) return { path, action: "missing" };
  const pkg = JSON.parse(current);
  pkg.scripts = pkg.scripts ?? {};
  const before = JSON.stringify(pkg.scripts);
  pkg.scripts["brain:check"] = pkg.scripts["brain:check"] ?? "pi-notes brain check";
  const after = JSON.stringify(pkg.scripts);
  if (before === after) return { path, action: "exists" };
  return writeFile(path, JSON.stringify(pkg, null, 2), "updated");
}

if (!existsSync(templateRoot) || !statSync(templateRoot).isDirectory()) {
  console.error(`missing pi-notes default template: ${templateRoot}`);
  process.exit(1);
}

const templateResults = walkFiles(templateRoot)
  .map((path) => relative(templateRoot, path))
  .sort()
  .map(installTemplateFile);

const results = [...templateResults, updatePackageScripts(join(targetRoot, "package.json"))];

for (const result of results) {
  const suffix = result.note ? ` (${result.note})` : "";
  console.log(`${result.action.padEnd(8)} ${result.path}${suffix}`);
}
console.log(`pi-notes Brain rig ${updateManaged ? "update" : "install"} complete for ${targetRoot}`);
