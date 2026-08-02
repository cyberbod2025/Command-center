import { describe, it, expect, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { StateStore } from "../src/server/state.js";

const tmpDirs: string[] = [];

async function makeTmpDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cc-state-test-"));
  tmpDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tmpDirs.splice(0).map((d) => fs.rm(d, { recursive: true, force: true })));
});

describe("StateStore", () => {
  it("siembra el estado inicial cuando el archivo no existe", async () => {
    const dir = await makeTmpDir();
    const store = new StateStore(dir);
    const state = await store.load();
    expect(state.schemaVersion).toBe(1);
    expect(state.decisions.length).toBeGreaterThan(0);

    const raw = await fs.readFile(path.join(dir, "command-center-state.json"), "utf8");
    expect(JSON.parse(raw).decisions.length).toBe(state.decisions.length);
  });

  it("no deja archivos temporales tras escribir", async () => {
    const dir = await makeTmpDir();
    const store = new StateStore(dir);
    await store.load();
    await store.mutate((s) => {
      s.audit.push({ id: "audit_1", ts: new Date().toISOString(), actor: "sistema", category: "system", action: "test", detail: "x" });
    });
    const files = await fs.readdir(dir);
    expect(files.some((f) => f.includes(".tmp-"))).toBe(false);
  });

  it("crea un respaldo antes de sobrescribir", async () => {
    const dir = await makeTmpDir();
    const store = new StateStore(dir);
    await store.load();
    await store.mutate((s) => {
      s.audit.push({ id: "audit_1", ts: new Date().toISOString(), actor: "sistema", category: "system", action: "test", detail: "x" });
    });
    const backups = await fs.readdir(path.join(dir, "backups"));
    expect(backups.filter((f) => f.startsWith("command-center-state.")).length).toBeGreaterThan(0);
  });

  it("persiste mutaciones entre instancias distintas del store", async () => {
    const dir = await makeTmpDir();
    const store1 = new StateStore(dir);
    const first = await store1.load();
    const targetId = first.decisions[0]!.id;
    await store1.mutate((s) => {
      const d = s.decisions.find((x) => x.id === targetId)!;
      d.state = "aceptada";
    });

    const store2 = new StateStore(dir);
    const second = await store2.load();
    expect(second.decisions.find((x) => x.id === targetId)?.state).toBe("aceptada");
  });

  it("serializa mutaciones concurrentes sin perder escrituras", async () => {
    const dir = await makeTmpDir();
    const store = new StateStore(dir);
    await store.load();
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        store.mutate((s) => {
          s.audit.push({ id: `audit_${i}`, ts: new Date().toISOString(), actor: "sistema", category: "system", action: "concurrent", detail: String(i) });
        })
      )
    );
    const final = await store.load();
    const concurrentEntries = final.audit.filter((a) => a.action === "concurrent");
    expect(concurrentEntries.length).toBe(10);
  });
});
