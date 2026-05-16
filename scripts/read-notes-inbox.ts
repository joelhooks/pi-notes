#!/usr/bin/env bun
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), ".pi", "notes-inbox");
if (!existsSync(dir)) {
  console.log("No .pi/notes-inbox yet. Save a batch from /pi-notes first.");
  process.exit(0);
}

const files = readdirSync(dir).filter((file) => file.endsWith(".json")).sort();
if (files.length === 0) {
  console.log("No saved pi-notes review batches.");
  process.exit(0);
}

const file = files.at(-1)!;
const batch = JSON.parse(readFileSync(join(dir, file), "utf8"));

console.log(`# Latest pi-notes review batch\n`);
console.log(`File: .pi/notes-inbox/${file}`);
console.log(`Created: ${batch.createdAt}`);
console.log(`Type: ${batch.type}`);
console.log(`Product: ${batch.product}`);
console.log(`Comments: ${batch.comments?.length ?? 0}\n`);

for (const comment of batch.comments ?? []) {
  console.log(`## ${comment.id}: ${comment.kind} on ${comment.blockIds.join(", ")}\n`);
  console.log(comment.comment);
  console.log("\nCurrent text:\n");
  console.log(comment.currentText);
  console.log("\n---\n");
}

console.log("Expected agent action:");
console.log(batch.expectedAgentAction ?? "Handle the feedback.");
