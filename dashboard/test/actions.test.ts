import { describe, it, expect, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { acceptDecision } from "../src/server/decisions.js";
import { buildSeedState } from "../src/server/seed.js";
import {
  generateExecutionPackage,
  markActionSent,
  addActionEvidence,
  completeActionIfVerified,
} from "../src/server/actions.js";
import type { CommandCenterState } from "../src/server/types.js";

const tmpDirs: string[] = [];
afterEach(async () => {
  await Promise.all(tmpDirs.splice(0).map((d) => fs.rm(d, { recursive: true, force: true })));
});

async function actionsDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cc-actions-test-"));
  tmpDirs.push(dir);
  return dir;
}

function freshState(): { state: CommandCenterState; decisionId: string } {
  const state = buildSeedState();
  const decisionId = state.decisions.find((d) => d.state === "propuesta")!.id;
  return { state, decisionId };
}

describe("cola de acciones", () => {
  it("no genera un paquete si la decision no esta aceptada o modificada", async () => {
    const { state, decisionId } = freshState();
    const dir = await actionsDir();
    await expect(generateExecutionPackage(state, decisionId, dir)).rejects.toThrow();
  });

  it("genera un archivo markdown real con las secciones requeridas", async () => {
    const { state, decisionId } = freshState();
    acceptDecision(state, decisionId);
    const dir = await actionsDir();
    const { action, packagePath } = await generateExecutionPackage(state, decisionId, dir);

    expect(action.status).toBe("generada");
    const fullPath = path.join(dir, "..", packagePath);
    const content = await fs.readFile(fullPath, "utf8");
    expect(content).toContain("## Objetivo");
    expect(content).toContain("## Restricciones");
    expect(content).toContain("## Criterio de terminado");
    expect(content).toContain("## Plan de reversion");

    const decision = state.decisions.find((d) => d.id === decisionId)!;
    expect(decision.state).toBe("lista_para_ejecucion");
  });

  it("marcar enviada solo funciona una vez, desde generada", async () => {
    const { state, decisionId } = freshState();
    acceptDecision(state, decisionId);
    const dir = await actionsDir();
    const { action } = await generateExecutionPackage(state, decisionId, dir);

    markActionSent(state, action.id, "Claude Code");
    expect(action.status).toBe("enviada");
    expect(() => markActionSent(state, action.id, "Claude Code")).toThrow();
  });

  it("no completa una accion sin evidencia verificada contra GitHub", async () => {
    const { state, decisionId } = freshState();
    acceptDecision(state, decisionId);
    const dir = await actionsDir();
    const { action } = await generateExecutionPackage(state, decisionId, dir);

    expect(() => completeActionIfVerified(state, action.id, "listo")).toThrow(/evidencia verificada/);

    addActionEvidence(state, action.id, { kind: "manual", description: "nota manual", verifiedAgainstGithub: false });
    expect(() => completeActionIfVerified(state, action.id, "listo")).toThrow(/evidencia verificada/);

    addActionEvidence(state, action.id, { kind: "pr_updated", description: "PR verificado", verifiedAgainstGithub: true });
    const completed = completeActionIfVerified(state, action.id, "listo");
    expect(completed.status).toBe("completada");

    const decision = state.decisions.find((d) => d.id === decisionId)!;
    expect(decision.state).toBe("completada");
  });
});
