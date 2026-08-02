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

  it("espera un callback asincrono lento antes de escribir a disco", async () => {
    const dir = await makeTmpDir();
    const store = new StateStore(dir);
    await store.load();

    const order: string[] = [];
    const mutatePromise = store.mutate(async (s) => {
      order.push("start");
      await new Promise((resolve) => setTimeout(resolve, 60)); // I/O simulado lento
      s.audit.push({ id: "audit_slow", ts: new Date().toISOString(), actor: "sistema", category: "system", action: "slow", detail: "x" });
      order.push("end");
    });
    order.push("mutate-called");
    await mutatePromise;

    // "end" debe ocurrir antes de que mutate() se resuelva, y el efecto debe estar en disco.
    expect(order).toEqual(["mutate-called", "start", "end"]);
    const raw = await fs.readFile(path.join(dir, "command-center-state.json"), "utf8");
    expect(JSON.parse(raw).audit.some((a: { action: string }) => a.action === "slow")).toBe(true);
  });

  it("no persiste nada si el callback de mutate falla a medio camino", async () => {
    const dir = await makeTmpDir();
    const store = new StateStore(dir);
    const before = await store.load();
    const decisionCountBefore = before.decisions.length;
    const auditCountBefore = before.audit.length;

    await expect(
      store.mutate((s) => {
        // mutacion parcial: se agregan datos y LUEGO se lanza
        s.audit.push({ id: "audit_partial", ts: new Date().toISOString(), actor: "sistema", category: "system", action: "partial", detail: "no deberia sobrevivir" });
        s.decisions.push({ ...before.decisions[0]!, id: "dec_fantasma" });
        throw new Error("fallo simulado a medio camino");
      })
    ).rejects.toThrow("fallo simulado a medio camino");

    const after = await store.load();
    expect(after.decisions.length).toBe(decisionCountBefore);
    expect(after.audit.length).toBe(auditCountBefore);
    expect(after.decisions.some((d) => d.id === "dec_fantasma")).toBe(false);
    expect(after.audit.some((a) => a.action === "partial")).toBe(false);

    const raw = await fs.readFile(path.join(dir, "command-center-state.json"), "utf8");
    expect(JSON.parse(raw).audit.some((a: { action: string }) => a.action === "partial")).toBe(false);
  });

  it("una falla al crear el paquete (fs.writeFile) no deja una accion huerfana en el estado", async () => {
    const dir = await makeTmpDir();
    const store = new StateStore(dir);
    const before = await store.load();
    const decisionId = before.decisions.find((d) => d.state === "propuesta")!.id;

    await store.mutate((s) => {
      const d = s.decisions.find((x) => x.id === decisionId)!;
      d.state = "aceptada";
    });

    const actionsCountBefore = (await store.load()).actions.length;
    const badActionsDir = path.join(dir, "no-existe", String.fromCharCode(0)); // ruta invalida a proposito

    const { generateExecutionPackage } = await import("../src/server/actions.js");
    await expect(
      store.mutate((s) => generateExecutionPackage(s, decisionId, badActionsDir))
    ).rejects.toThrow();

    const after = await store.load();
    expect(after.actions.length).toBe(actionsCountBefore);
    const decision = after.decisions.find((d) => d.id === decisionId)!;
    expect(decision.actionIds).toHaveLength(0);
    expect(decision.state).toBe("aceptada"); // no avanzo a lista_para_ejecucion
  });
});
