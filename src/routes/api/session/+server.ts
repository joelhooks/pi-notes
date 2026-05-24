import { json, type RequestHandler } from "@sveltejs/kit";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function workspaceRoot() {
  return process.env.PI_NOTES_WORKSPACE_ROOT || process.cwd();
}

function readJson(path: string) {
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, "utf8"));
}

export const GET: RequestHandler = () => {
  const root = workspaceRoot();
  const bridgeDir = join(root, ".pi", "notes-bridge");
  const session = readJson(join(bridgeDir, "session.json"));
  const bridge = readJson(join(bridgeDir, "status.json"));
  if (!session) return json({ connected: false, cwd: root, bridge });
  return json({ connected: true, cwd: root, session, bridge });
};
