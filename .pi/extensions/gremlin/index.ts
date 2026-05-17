import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const phases = ["research", "shape", "plan", "build", "capture", "review"] as const;
const captureTypes = ["decision", "insight", "gotcha", "code-change", "concept", "risk", "next-step"] as const;

type Phase = (typeof phases)[number];
type CaptureType = (typeof captureTypes)[number];

interface CaptureEntry {
  readonly timestamp: string;
  readonly type: CaptureType;
  readonly phase: Phase;
  readonly concept: string;
  readonly summary: string;
  readonly details?: string;
}

const state = {
  phase: "research" as Phase,
  capturesThisSession: 0,
  lastBrainCheck: "unknown" as "unknown" | "passed" | "failed",
};

function root() {
  return process.cwd();
}

function appendJsonl(entry: CaptureEntry) {
  const piDir = join(root(), ".pi");
  mkdirSync(piDir, { recursive: true });
  writeFileSync(join(piDir, "course-log.jsonl"), `${JSON.stringify(entry)}\n`, { flag: "a" });
}

function appendCaptureToBrain(entry: CaptureEntry) {
  const brainPath = join(root(), ".brain", "build-process.svx");
  if (!existsSync(brainPath)) return false;

  const current = readFileSync(brainPath, "utf8");
  const heading = "## Captured build notes";
  const note = [
    `- **${entry.type} / ${entry.concept}** (${entry.phase}, ${entry.timestamp}): ${entry.summary}`,
    entry.details ? `  - ${entry.details.replace(/\n/g, "\n  - ")}` : undefined,
  ].filter(Boolean).join("\n");

  const next = current.includes(heading)
    ? current.replace(heading, `${heading}\n\n${note}`)
    : `${current.trimEnd()}\n\n${heading}\n\nDurable captures from the gremlin extension. Periodically fold these into focused Brain topic files.\n\n${note}\n`;

  writeFileSync(brainPath, next, "utf8");
  return true;
}

export default function gremlin(pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    for (const entry of ctx.sessionManager.getEntries()) {
      if (entry.type === "custom" && entry.customType === "gremlin-state") {
        const data = entry.data as { phase?: Phase };
        if (data.phase && phases.includes(data.phase)) state.phase = data.phase;
      }
    }

    if (ctx.hasUI) {
      ctx.ui.setStatus("gremlin", `gremlin:${state.phase} captures:${state.capturesThisSession} brain:${state.lastBrainCheck}`);
    }
  });

  pi.on("before_agent_start", async (event) => {
    let extra = "";
    const contextFiles = [
      ["docs/project/identity.md", "identity"],
      ["docs/project/tools.md", "tools"],
      ["ID.md", "ID.md"],
      ["TOOLS.md", "TOOLS.md"],
    ] as const;
    for (const [file, label] of contextFiles) {
      const path = join(root(), file);
      if (existsSync(path)) extra += `\n\n# ${label}\n\n${readFileSync(path, "utf8")}`;
    }
    if (extra) return { systemPrompt: event.systemPrompt + extra };
  });

  pi.registerCommand("phase", {
    description: "Set pi-notes capture phase",
    handler: async (args, ctx) => {
      const phase = args.trim() as Phase;
      if (!phases.includes(phase)) {
        ctx.ui.notify(`Use one of: ${phases.join(", ")}`, "warning");
        return;
      }
      state.phase = phase;
      pi.appendEntry("gremlin-state", { phase });
      ctx.ui.setStatus("gremlin", `gremlin:${state.phase} captures:${state.capturesThisSession} brain:${state.lastBrainCheck}`);
      ctx.ui.notify(`gremlin phase: ${phase}`, "info");
    },
  });

  pi.registerTool({
    name: "pi_notes_capture",
    label: "Capture pi-notes build knowledge",
    description: "Capture durable pi-notes build knowledge into .pi/course-log.jsonl and .brain/build-process.svx.",
    promptSnippet: "Capture pi-notes build decisions, insights, gotchas, concepts, risks, and next steps",
    promptGuidelines: [
      "Use pi_notes_capture after meaningful pi-notes decisions, concepts, risks, build steps, or review findings. Do not wait until the end of a long task.",
      "Use pi_notes_capture for durable build knowledge; then fold repeated notes into focused Brain topic files instead of leaving a messy append-only log.",
    ],
    parameters: Type.Object({
      type: StringEnum(captureTypes),
      concept: Type.String({ description: "Canonical concept name, e.g. Pi Bridge or Source Subtree" }),
      summary: Type.String({ description: "One concise durable capture" }),
      details: Type.Optional(Type.String({ description: "Optional supporting detail, command, file, or rationale" })),
    }),
    async execute(_toolCallId, params) {
      const entry: CaptureEntry = {
        timestamp: new Date().toISOString(),
        phase: state.phase,
        type: params.type,
        concept: params.concept,
        summary: params.summary,
        details: params.details,
      };

      appendJsonl(entry);
      const wroteBrain = appendCaptureToBrain(entry);
      state.capturesThisSession += 1;
      pi.appendEntry("gremlin-capture", entry);

      return {
        content: [{ type: "text", text: `Captured ${entry.type} for ${entry.concept}${wroteBrain ? " and updated .brain/build-process.svx" : ""}.` }],
        details: { entry, wroteBrain },
      };
    },
  });

  pi.registerTool({
    name: "course_brain_check",
    label: "Check Brain",
    description: "Run bun run brain:check and record whether the self-documenting graph passes.",
    parameters: Type.Object({}),
    async execute(_toolCallId, _params, signal) {
      const result = await pi.exec("bun", ["run", "brain:check"], { signal, timeout: 120_000 });
      state.lastBrainCheck = result.code === 0 ? "passed" : "failed";
      return {
        content: [{ type: "text", text: result.stdout + (result.stderr ? `\n${result.stderr}` : "") }],
        details: { code: result.code, lastBrainCheck: state.lastBrainCheck },
      };
    },
  });
}
