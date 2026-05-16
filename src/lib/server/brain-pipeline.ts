import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export type BrainPipelineConfig = {
  components?: Record<string, string>;
  remarkPlugins?: string[];
  rehypePlugins?: string[];
};

export const defaultBrainComponentImports: Record<string, string> = {
  ExternalLink: "$lib/brain-components/ExternalLink.svelte",
  FeedbackControls: "$lib/brain-components/FeedbackControls.svelte",
  GateTrace: "$lib/brain-components/GateTrace.svelte",
  NoteCallout: "$lib/brain-components/NoteCallout.svelte",
  StatusPill: "$lib/brain-components/StatusPill.svelte",
  SupportReplyCard: "$lib/brain-components/SupportReplyCard.svelte",
};

export function workspaceRoot() {
  return process.env.PI_NOTES_WORKSPACE_ROOT || process.cwd();
}

function parseConfigObject(source: string): BrainPipelineConfig {
  const config: BrainPipelineConfig = {};
  const componentBlock = source.match(/components\s*:\s*{([\s\S]*?)}\s*,?/m)?.[1];
  if (componentBlock) {
    config.components = {};
    for (const match of componentBlock.matchAll(/([A-Za-z_$][\w$]*)\s*:\s*["']([^"']+)["']/g)) {
      config.components[match[1]!] = match[2]!;
    }
  }
  for (const key of ["remarkPlugins", "rehypePlugins"] as const) {
    const block = source.match(new RegExp(`${key}\\s*:\\s*\\[([\\s\\S]*?)\\]`, "m"))?.[1];
    if (block) config[key] = [...block.matchAll(/["']([^"']+)["']/g)].map((match) => match[1]!);
  }
  return config;
}

export function loadBrainPipelineConfig(root = workspaceRoot()): BrainPipelineConfig {
  for (const name of ["pipeline.config.ts", "pipeline.config.js", "components.config.ts", "components.config.js"]) {
    const path = join(root, ".brain", name);
    if (existsSync(path)) return parseConfigObject(readFileSync(path, "utf8"));
  }
  return {};
}

export function projectComponentImports(root = workspaceRoot()): Record<string, string> {
  const config = loadBrainPipelineConfig(root);
  const configured = Object.fromEntries(Object.entries(config.components ?? {}).map(([name, relativePath]) => [name, toFsImport(root, relativePath)]));
  const componentsDir = join(root, ".brain", "components");
  const scanned = existsSync(componentsDir)
    ? Object.fromEntries(readdirSync(componentsDir).filter((file) => file.endsWith(".svelte")).map((file) => [file.replace(/\.svelte$/, ""), `/@fs/${join(componentsDir, file)}`]))
    : {};
  return { ...scanned, ...configured };
}

function toFsImport(root: string, relativePath: string) {
  if (relativePath.startsWith("$lib/") || relativePath.startsWith("/@fs/")) return relativePath;
  const fullPath = resolve(root, ".brain", relativePath);
  const brainRoot = resolve(root, ".brain");
  if (!fullPath.startsWith(brainRoot)) throw new Error(`Brain component import escapes .brain: ${relativePath}`);
  return `/@fs/${fullPath}`;
}

export function componentImportsForSource(source: string, root = workspaceRoot()) {
  const usedNames = new Set([...source.matchAll(/<([A-Z][A-Za-z0-9_$]*)\b/g)].map((match) => match[1]));
  const project = projectComponentImports(root);
  const imports = { ...defaultBrainComponentImports, ...project };
  return [...usedNames].filter((name) => imports[name]).map((name) => `import ${name} from ${JSON.stringify(imports[name])};`);
}

export function injectBrainComponentImports(source: string, root = workspaceRoot()) {
  const imports = componentImportsForSource(source, root);
  if (imports.length === 0) return source;
  const importBlock = imports.join("\n");
  const moduleScript = source.match(/<script\s+context=["']module["'][^>]*>[\s\S]*?<\/script>/m);
  if (moduleScript) return source.replace(moduleScript[0], moduleScript[0].replace("</script>", `\n${importBlock}\n</script>`));
  return `<script context="module">\n${importBlock}\n</script>\n\n${source}`;
}

export function brainPipelineSummary(root = workspaceRoot()) {
  const config = loadBrainPipelineConfig(root);
  return {
    root,
    defaultComponents: Object.keys(defaultBrainComponentImports),
    projectComponents: Object.keys(projectComponentImports(root)),
    remarkPlugins: config.remarkPlugins ?? [],
    rehypePlugins: config.rehypePlugins ?? [],
  };
}
