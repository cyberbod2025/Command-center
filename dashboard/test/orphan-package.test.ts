import { describe, it, expect, afterEach, vi } from "vitest";
import { promises as fsp } from "node:fs";
import os from "node:os";
import path from "node:path";
import { acceptDecision } from "../src/server/decisions.js";
import { StateStore } from "../src/server/state.js";
import { generateExecutionPackage } from "../src/server/actions.js";

const tmpDirs: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(tmpDirs.splice(0).map((d) => fs_rm(d)));
});

async function fs_rm(d: string) {
  await fsp.rm(d, { recursive: true, force: true }).catch(() => undefined);
}

async function makeStore(): Promise<{ store: StateStore; dataDir: string; actionsDir: string; decisionId: string }> {
  const dataDir = await fsp.mkdtemp(path.join(os.tmpdir(), "cc-orphan-test-"));
  tmpDirs.push(dataDir);
  const store = new StateStore(dataDir);
  const state = await store.load();
  const decisionId = state.decisions.find((d) => d.project === "Command Center" && d.state === "propuesta")!.id;
  await store.mutate((s) => acceptDecision(s, decisionId));
  return { store, dataDir, actionsDir: path.join(dataDir, "actions"), decisionId };
}

async function listMarkdownFiles(actionsDir: string): Promise<string[]> {
  const entries = await fsp.readdir(actionsDir).catch(() => [] as string[]);
  return entries.filter((f) => f.endsWith(".md"));
}

describe("generateExecutionPackage no deja paquetes Markdown huerfanos", () => {
  it("fallo al escribir el JSON del estado: no queda archivo .md ni accion registrada", async () => {
    const { store, actionsDir, decisionId } = await makeStore();

    // El primer `rename` que ocurre dentro de un ciclo de generacion es el
    // de writeAtomic (state.ts) publicando el JSON del estado — lo hacemos
    // fallar para simular que la escritura del JSON no se pudo confirmar.
    const spy = vi.spyOn(fsp, "rename").mockRejectedValueOnce(new Error("disco lleno (simulado)"));

    await expect(generateExecutionPackage(store, decisionId, actionsDir)).rejects.toThrow(/disco lleno/);
    spy.mockRestore();

    const after = await store.load();
    expect(after.actions.filter((a) => a.decisionId === decisionId)).toHaveLength(0);
    expect(await listMarkdownFiles(actionsDir)).toHaveLength(0);
  });

  it("fallo al crear el respaldo antes de escribir: la escritura completa se aborta sin dejar .md", async () => {
    const { store, actionsDir, decisionId } = await makeStore();

    // backupCurrent (state.ts) usa fs.copyFile antes del propio writeAtomic.
    // Solo aplica si YA existe un command-center-state.json previo, que aqui
    // ya existe porque acceptDecision (en makeStore) escribio uno.
    const spy = vi.spyOn(fsp, "copyFile").mockRejectedValueOnce(new Error("permiso denegado (simulado)"));

    await expect(generateExecutionPackage(store, decisionId, actionsDir)).rejects.toThrow(/permiso denegado/);
    spy.mockRestore();

    const after = await store.load();
    expect(after.actions.filter((a) => a.decisionId === decisionId)).toHaveLength(0);
    expect(await listMarkdownFiles(actionsDir)).toHaveLength(0);
  });

  it("fallo al renombrar el paquete final: la accion queda marcada fallida y no hay .md consumible", async () => {
    const { store, actionsDir, decisionId } = await makeStore();

    const realRename = fsp.rename.bind(fsp);
    let call = 0;
    const spy = vi.spyOn(fsp, "rename").mockImplementation(async (...args: Parameters<typeof fsp.rename>) => {
      call += 1;
      // La 1ra llamada es el rename interno de writeAtomic (el JSON del estado) — debe funcionar.
      // La 2da es la que publica el Markdown final — la hacemos fallar.
      if (call === 2) throw new Error("no se pudo publicar el paquete (simulado)");
      return realRename(...args);
    });

    await expect(generateExecutionPackage(store, decisionId, actionsDir)).rejects.toThrow(/no pudo publicarse/);
    spy.mockRestore();

    const after = await store.load();
    const actions = after.actions.filter((a) => a.decisionId === decisionId);
    expect(actions).toHaveLength(1);
    expect(actions[0]!.status).toBe("fallida");

    // Ni el temporal ni el archivo final quedan en disco: nada consumible.
    expect(await listMarkdownFiles(actionsDir)).toHaveLength(0);
    const allFiles = await fsp.readdir(actionsDir).catch(() => []);
    expect(allFiles.some((f) => f.endsWith(".tmp"))).toBe(false);
  });

  it("reintento posterior: tras un fallo de publicacion, generar de nuevo produce un paquete valido", async () => {
    const { store, actionsDir, decisionId } = await makeStore();

    const realRename = fsp.rename.bind(fsp);
    let call = 0;
    const spy = vi.spyOn(fsp, "rename").mockImplementation(async (...args: Parameters<typeof fsp.rename>) => {
      call += 1;
      if (call === 2) throw new Error("fallo transitorio (simulado)");
      return realRename(...args);
    });
    await expect(generateExecutionPackage(store, decisionId, actionsDir)).rejects.toThrow();
    spy.mockRestore();

    // Reintento: sin mocks, deberia funcionar de punta a punta.
    const { action, packagePath } = await generateExecutionPackage(store, decisionId, actionsDir);
    expect(action.status).toBe("generada");
    const content = await fsp.readFile(path.join(actionsDir, "..", packagePath), "utf8");
    expect(content).toContain("## Contexto");

    const after = await store.load();
    const actions = after.actions.filter((a) => a.decisionId === decisionId);
    expect(actions.some((a) => a.status === "fallida")).toBe(true);
    expect(actions.some((a) => a.id === action.id && a.status === "generada")).toBe(true);
  });

  it("un consumidor (GET del paquete) nunca ve un archivo sin una accion valida que lo respalde", async () => {
    const { store, actionsDir, decisionId } = await makeStore();

    const realRename = fsp.rename.bind(fsp);
    let call = 0;
    const spy = vi.spyOn(fsp, "rename").mockImplementation(async (...args: Parameters<typeof fsp.rename>) => {
      call += 1;
      if (call === 2) throw new Error("fallo de publicacion (simulado)");
      return realRename(...args);
    });
    await expect(generateExecutionPackage(store, decisionId, actionsDir)).rejects.toThrow();
    spy.mockRestore();

    const after = await store.load();
    const failedAction = after.actions.find((a) => a.decisionId === decisionId)!;
    // La accion existe (para trazabilidad) pero esta 'fallida', y su
    // packagePath no apunta a ningun archivo real en disco.
    expect(failedAction.status).toBe("fallida");
    const fullPath = path.join(actionsDir, "..", failedAction.packagePath);
    await expect(fsp.readFile(fullPath, "utf8")).rejects.toThrow();
  });
});
