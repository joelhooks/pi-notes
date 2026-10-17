import { describe, expect, it } from "vitest";
import { findFreePort, RESERVED_PORTS } from "./free-port";

const probeFrom = (taken: Set<number>, probed: number[] = []) => async (port: number) => {
  probed.push(port);
  return !taken.has(port);
};

describe("findFreePort", () => {
  it("reserves the OTLP ports", () => {
    expect([...RESERVED_PORTS].sort()).toEqual([4317, 4318]);
  });

  it("returns the start when it is free", async () => {
    expect(await findFreePort(4288, probeFrom(new Set()))).toBe(4288);
  });

  it("walks past reserved ports without probing them", async () => {
    const probed: number[] = [];
    expect(await findFreePort(4316, probeFrom(new Set([4316]), probed))).toBe(4319);
    expect(probed).toEqual([4316, 4319]);
  });

  it("skips a reserved start", async () => {
    expect(await findFreePort(4317, probeFrom(new Set()))).toBe(4319);
    expect(await findFreePort(4318, probeFrom(new Set()))).toBe(4319);
  });

  it("never returns a reserved port across a busy range", async () => {
    const taken = new Set(Array.from({ length: 40 }, (_, i) => 4288 + i).filter((port) => !RESERVED_PORTS.has(port)));
    const port = await findFreePort(4288, probeFrom(taken));
    expect(RESERVED_PORTS.has(port)).toBe(false);
    expect(port).toBe(4328);
  });

  it("throws when nothing is free", async () => {
    await expect(findFreePort(5000, async () => false)).rejects.toThrow("No free port found from 5000");
  });
});
