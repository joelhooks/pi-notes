#!/usr/bin/env bun
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { compileDiagramFile } from "../src/lib/server/diagram-compiler";

const sourcePath = process.argv[2];
if (!sourcePath) {
  console.error("usage: bun run diagram:compile docs/diagrams/foo.diagram");
  process.exit(1);
}

const result = compileDiagramFile(process.cwd(), sourcePath);
writeFileSync(resolve(process.cwd(), result.artifactPath), `${JSON.stringify(result.excalidraw, null, 2)}\n`);
console.log(`compiled ${sourcePath} -> ${result.artifactPath}`);
if (result.warnings.length > 0) {
  console.warn("warnings:");
  for (const warning of result.warnings) console.warn(`- ${warning}`);
}
