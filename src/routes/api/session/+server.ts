import { json, type RequestHandler } from "@sveltejs/kit";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function readJson(path: string) {
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, "utf8"));
}

export const GET: RequestHandler = () => {
  const bridgeDir = join(process.cwd(), ".pi", "notes-bridge");
  const session = readJson(join(bridgeDir, "session.json"));
  const bridge = readJson(join(bridgeDir, "status.json"));
  if (!session) return json({ connected: false, cwd: process.cwd(), bridge });
  return json({ connected: true, cwd: process.cwd(), session, bridge });
};
