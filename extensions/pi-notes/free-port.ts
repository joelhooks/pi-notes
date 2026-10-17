import { createServer } from "node:net";

/** OTLP gRPC and HTTP. The fleet telemetry collector listens on these, so the walk never takes them. */
export const RESERVED_PORTS: ReadonlySet<number> = new Set([4317, 4318]);

export type PortProbe = (port: number) => Promise<boolean>;

export const probeLoopbackPort: PortProbe = (port) =>
  new Promise<boolean>((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
  });

export async function findFreePort(start: number, probe: PortProbe = probeLoopbackPort) {
  for (let port = start; port < start + 1_000; port += 1) {
    if (RESERVED_PORTS.has(port)) continue;
    if (await probe(port)) return port;
  }
  throw new Error(`No free port found from ${start}`);
}
