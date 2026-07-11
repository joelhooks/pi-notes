import { error, type RequestHandler } from "@sveltejs/kit";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { workspaceRoot } from "$lib/server/brain-pipeline";
import { DIAGRAM_CACHE_DIR } from "$lib/server/mermaid/shared.js";

export const GET: RequestHandler = ({ params }) => {
  const file = params.file;
  if (!/^[a-f0-9]{16}(\.dark)?\.svg$/.test(file)) throw error(404, "Diagram not found");

  const path = join(workspaceRoot(), ...DIAGRAM_CACHE_DIR, file);
  if (!existsSync(path)) throw error(404, "Diagram not rendered yet");

  return new Response(readFileSync(path, "utf8"), {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
};
