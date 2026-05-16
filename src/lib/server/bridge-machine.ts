import { setup } from "xstate";

export const bridgeMachine = setup({
  types: {
    context: {} as {
      product: string;
      sessionFile?: string;
      lastError?: string;
    },
    events: {} as
      | { type: "bridge.connected"; sessionFile: string }
      | { type: "feedback.send"; payload: unknown }
      | { type: "feedback.sent" }
      | { type: "feedback.failed"; error: string }
      | { type: "bridge.disconnected" },
    input: {} as { product: string },
  },
}).createMachine({
  id: "pi-notes-bridge",
  initial: "idle",
  context: ({ input }) => ({ product: input.product }),
  states: {
    idle: {
      on: {
        "bridge.connected": {
          target: "ready",
          actions: ({ context, event }) => {
            context.sessionFile = event.sessionFile;
          },
        },
      },
    },
    ready: {
      on: {
        "feedback.send": { target: "sending" },
        "bridge.disconnected": { target: "idle" },
      },
    },
    sending: {
      tags: ["busy"],
      on: {
        "feedback.sent": { target: "ready" },
        "feedback.failed": {
          target: "failed",
          actions: ({ context, event }) => {
            context.lastError = event.error;
          },
        },
      },
    },
    failed: {
      tags: ["error"],
      on: {
        "feedback.send": { target: "sending" },
        "bridge.disconnected": { target: "idle" },
      },
    },
  },
});
