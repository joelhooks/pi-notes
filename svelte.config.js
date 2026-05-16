import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import adapter from "@sveltejs/adapter-node";
import { mdsvex } from "mdsvex";

function workspaceRoot() {
  return process.env.PI_NOTES_WORKSPACE_ROOT || process.cwd();
}

function parsePluginList(source, key) {
  const block = source.match(new RegExp(`${key}\\s*:\\s*\\[([\\s\\S]*?)\\]`, "m"))?.[1];
  return block ? [...block.matchAll(/["']([^"']+)["']/g)].map((match) => match[1]) : [];
}

function loadBrainPipelinePluginSpecifiers(root, key) {
  for (const name of ["pipeline.config.ts", "pipeline.config.js", "components.config.ts", "components.config.js"]) {
    const path = join(root, ".brain", name);
    if (existsSync(path)) return parsePluginList(readFileSync(path, "utf8"), key);
  }
  return [];
}

async function loadPlugin(specifier) {
  const root = workspaceRoot();
  const resolved = specifier.startsWith(".") ? new URL(specifier, `file://${root}/.brain/`).href : specifier;
  const module = await import(resolved);
  return module.default ?? module;
}

const remarkPlugins = await Promise.all(loadBrainPipelinePluginSpecifiers(workspaceRoot(), "remarkPlugins").map(loadPlugin));
const rehypePlugins = await Promise.all(loadBrainPipelinePluginSpecifiers(workspaceRoot(), "rehypePlugins").map(loadPlugin));

/** @type {import('@sveltejs/kit').Config} */
const config = {
  extensions: [".svelte", ".svx"],
  preprocess: [mdsvex({ extensions: [".svx"], remarkPlugins, rehypePlugins })],
  kit: {
    adapter: adapter(),
  },
};

export default config;
