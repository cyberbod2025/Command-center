import { describe, it, expect, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Server } from "node:http";
import { StateStore } from "../src/server/state.js";
import { actionsDirFromDataDir } from "../src/server/routes.js";
import { buildApp, listenLoopback, LOOPBACK_HOST } from "../src/server/app.js";

const tmpDirs: string[] = [];
const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (s) =>
        new Promise<void>((resolve) => {
          s.close(() => resolve());
        })
    )
  );
  await Promise.all(tmpDirs.splice(0).map((d) => fs.rm(d, { recursive: true, force: true })));
});

async function startTestServer(): Promise<{ server: Server; port: number }> {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "cc-app-test-"));
  tmpDirs.push(dataDir);
  const store = new StateStore(dataDir);
  const publicDir = await fs.mkdtemp(path.join(os.tmpdir(), "cc-app-public-"));
  tmpDirs.push(publicDir);
  const app = buildApp(store, actionsDirFromDataDir(dataDir), publicDir);
  const server = await listenLoopback(app, 0); // puerto 0 = el SO asigna uno libre
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("direccion de servidor inesperada");
  return { server, port: address.port };
}

describe("el servidor solo escucha en loopback", () => {
  it("LOOPBACK_HOST es 127.0.0.1", () => {
    expect(LOOPBACK_HOST).toBe("127.0.0.1");
  });

  it("server.address().address es 127.0.0.1, no 0.0.0.0 ni ::", async () => {
    const { server } = await startTestServer();
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("direccion inesperada");
    expect(address.address).toBe("127.0.0.1");
  });

  it("responde correctamente en 127.0.0.1", async () => {
    const { port } = await startTestServer();
    const res = await fetch(`http://127.0.0.1:${port}/api/decisions`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { decisions: unknown[] };
    expect(Array.isArray(body.decisions)).toBe(true);
  });
});
