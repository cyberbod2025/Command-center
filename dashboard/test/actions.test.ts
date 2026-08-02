import { describe, it, expect, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { acceptDecision, modifyDecision } from "../src/server/decisions.js";
import { buildSeedState } from "../src/server/seed.js";
import {
  generateExecutionPackage,
  markActionSent,
  addActionEvidence,
  completeActionIfVerified,
  assertCanPublishComment,
  ActionNotFoundError,
  ActionNotWritableError,
} from "../src/server/actions.js";
import { EvidenceMismatchError } from "../src/server/verification.js";
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
  const decisionId = state.decisions.find((d) => d.state === "propuesta" && d.project === "Command Center")!.id;
  return { state, decisionId };
}

/** Decision Teacher OS/SASE (sin GitHub) del estado sembrado. */
function manualState(): { state: CommandCenterState; decisionId: string } {
  const state = buildSeedState();
  const decisionId = state.decisions.find((d) => d.state === "propuesta" && d.project === "Teacher OS")!.id;
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
    expect(content).toContain("## Contexto");
    expect(content).toContain("## Restricciones obligatorias");
    expect(content).toContain("## Criterio de terminado");
    expect(content).toContain("## Plan de reversion");
    expect(content).toContain("## Criterios de verificacion");

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

  describe("vinculacion de evidencia (P1)", () => {
    it("una accion de merge NO se completa con evidencia de un PR abierto", async () => {
      const { state, decisionId } = freshState();
      acceptDecision(state, decisionId);
      const dir = await actionsDir();
      const { action } = await generateExecutionPackage(state, decisionId, dir); // expectedPrNumber=2 ya en el seed

      addActionEvidence(state, action.id, {
        kind: "pr_updated",
        description: "PR #2 abierto",
        verifiedAgainstGithub: true,
        repo: "cyberbod2025/Command-center",
        prNumber: 2,
        prState: "OPEN",
      });
      expect(() => completeActionIfVerified(state, action.id, "listo")).toThrow(/no cumple los criterios/);
    });

    it("una accion de merge SI se completa con el PR correcto ya fusionado", async () => {
      const { state, decisionId } = freshState();
      acceptDecision(state, decisionId);
      const dir = await actionsDir();
      const { action } = await generateExecutionPackage(state, decisionId, dir);

      addActionEvidence(state, action.id, {
        kind: "merge",
        description: "PR #2 fusionado",
        verifiedAgainstGithub: true,
        repo: "cyberbod2025/Command-center",
        prNumber: 2,
        prState: "MERGED",
      });
      const completed = completeActionIfVerified(state, action.id, "listo");
      expect(completed.status).toBe("completada");
    });

    it("no acepta evidencia de otro repositorio ni de otro PR", async () => {
      const { state, decisionId } = freshState();
      acceptDecision(state, decisionId);
      const dir = await actionsDir();
      const { action } = await generateExecutionPackage(state, decisionId, dir);

      addActionEvidence(state, action.id, {
        kind: "merge",
        description: "PR de otro repo fusionado",
        verifiedAgainstGithub: true,
        repo: "cyberbod2025/NUEVO-HORIZONTE",
        prNumber: 2,
        prState: "MERGED",
      });
      addActionEvidence(state, action.id, {
        kind: "merge",
        description: "PR #99 fusionado en el repo correcto",
        verifiedAgainstGithub: true,
        repo: "cyberbod2025/Command-center",
        prNumber: 99,
        prState: "MERGED",
      });
      expect(() => completeActionIfVerified(state, action.id, "listo")).toThrow(/no cumple los criterios/);
    });

    it("un comentario no satisface una accion generica de merge", async () => {
      const { state, decisionId } = freshState();
      acceptDecision(state, decisionId);
      const dir = await actionsDir();
      const { action } = await generateExecutionPackage(state, decisionId, dir);

      addActionEvidence(state, action.id, {
        kind: "comment",
        description: "comentario publicado",
        verifiedAgainstGithub: true,
        repo: "cyberbod2025/Command-center",
        prNumber: 2,
        commentUrl: "https://github.com/x",
      });
      expect(() => completeActionIfVerified(state, action.id, "listo")).toThrow(/no cumple los criterios/);
    });

    it("una accion de Supabase/Drive (sin GitHub) no acepta evidencia verificada contra GitHub", async () => {
      const { state, decisionId } = manualState();
      acceptDecision(state, decisionId);
      const dir = await actionsDir();
      const { action } = await generateExecutionPackage(state, decisionId, dir);

      // alguien intenta colar evidencia de GitHub en una accion que es sobre Drive
      addActionEvidence(state, action.id, {
        kind: "manual",
        description: "evidencia marcada como de github por error",
        verifiedAgainstGithub: true,
      });
      expect(() => completeActionIfVerified(state, action.id, "listo")).toThrow(/no cumple los criterios/);

      addActionEvidence(state, action.id, {
        kind: "manual",
        description: "Hugo confirmo el inventario de Drive manualmente",
        verifiedAgainstGithub: false,
      });
      const completed = completeActionIfVerified(state, action.id, "listo");
      expect(completed.status).toBe("completada");
    });

    it("exige expectedPrNumber al generar el paquete cuando el criterio es ambiguo", async () => {
      const state = buildSeedState();
      const decisionId = state.decisions.find((d) => d.state === "propuesta" && d.project === "Command Center")!.id;
      const decision = state.decisions.find((d) => d.id === decisionId)!;
      // fuerza la ambiguedad quitando el expectedPrNumber por defecto del seed
      decision.verification.expectedPrNumber = undefined;
      acceptDecision(state, decisionId);
      const dir = await actionsDir();

      await expect(generateExecutionPackage(state, decisionId, dir)).rejects.toThrow(/mas de un PR/);
      const { action } = await generateExecutionPackage(state, decisionId, dir, { expectedPrNumber: 3 });
      expect(action.verification.expectedPrNumber).toBe(3);
    });
  });

  describe("plan efectivo con modificaciones (P1)", () => {
    it("una restriccion modificada aparece literalmente en el paquete generado", async () => {
      const { state, decisionId } = freshState();
      acceptDecision(state, decisionId);
      modifyDecision(state, decisionId, { restricciones: "No tocar la rama main directamente bajo ninguna circunstancia" });
      const dir = await actionsDir();
      const { packagePath } = await generateExecutionPackage(state, decisionId, dir);

      const fullPath = path.join(dir, "..", packagePath);
      const content = await fs.readFile(fullPath, "utf8");
      expect(content).toContain("No tocar la rama main directamente bajo ninguna circunstancia");
      expect(content).toContain("## Plan efectivo final");
      expect(content).toContain("## Modificaciones aprobadas por Hugo");
    });

    it("sin modificaciones, el paquete no incluye la seccion de plan efectivo con diffs", async () => {
      const { state, decisionId } = freshState();
      acceptDecision(state, decisionId);
      const dir = await actionsDir();
      const { packagePath } = await generateExecutionPackage(state, decisionId, dir);

      const fullPath = path.join(dir, "..", packagePath);
      const content = await fs.readFile(fullPath, "utf8");
      expect(content).not.toContain("## Modificaciones aprobadas por Hugo");
    });
  });

  describe("validacion antes de publicar comentario remoto (P2)", () => {
    it("un ID de accion inexistente no permite continuar", () => {
      const { state } = freshState();
      expect(() => assertCanPublishComment(state, "act_no_existe", "cyberbod2025/Command-center", 2)).toThrow(
        ActionNotFoundError
      );
    });

    it("una accion cancelada no admite comentarios", async () => {
      const { state, decisionId } = freshState();
      acceptDecision(state, decisionId);
      const dir = await actionsDir();
      const { action } = await generateExecutionPackage(state, decisionId, dir);
      action.status = "cancelada";

      expect(() => assertCanPublishComment(state, action.id, "cyberbod2025/Command-center", 2)).toThrow(
        ActionNotWritableError
      );
    });

    it("rechaza un repositorio distinto del esperado por la accion", async () => {
      const { state, decisionId } = freshState();
      acceptDecision(state, decisionId);
      const dir = await actionsDir();
      const { action } = await generateExecutionPackage(state, decisionId, dir);
      action.verification.allowedEvidenceKinds = [...action.verification.allowedEvidenceKinds, "comment"];

      expect(() => assertCanPublishComment(state, action.id, "cyberbod2025/SASE-ZERO", 2)).toThrow(EvidenceMismatchError);
    });

    it("rechaza un PR distinto del esperado por la accion", async () => {
      const { state, decisionId } = freshState();
      acceptDecision(state, decisionId);
      const dir = await actionsDir();
      const { action } = await generateExecutionPackage(state, decisionId, dir);
      action.verification.allowedEvidenceKinds = [...action.verification.allowedEvidenceKinds, "comment"];

      expect(() => assertCanPublishComment(state, action.id, "cyberbod2025/Command-center", 3)).toThrow(EvidenceMismatchError);
    });

    it("una accion cuyos criterios no permiten 'comment' rechaza publicar", async () => {
      const { state, decisionId } = manualState();
      acceptDecision(state, decisionId);
      const dir = await actionsDir();
      const { action } = await generateExecutionPackage(state, decisionId, dir);

      expect(() => assertCanPublishComment(state, action.id, "cyberbod2025/Command-center", 2)).toThrow(
        ActionNotWritableError
      );
    });

    it("acepta cuando la accion, el repo y el PR coinciden exactamente", async () => {
      const state = buildSeedState();
      const decisionId = state.decisions.find((d) => d.state === "propuesta" && d.project === "Command Center")!.id;
      acceptDecision(state, decisionId);
      const dir = await actionsDir();
      const { action } = await generateExecutionPackage(state, decisionId, dir, { expectedPrNumber: 2 });
      // amplía manualmente los tipos permitidos para simular una accion que si admite comentarios
      action.verification.allowedEvidenceKinds = [...action.verification.allowedEvidenceKinds, "comment"];

      expect(() => assertCanPublishComment(state, action.id, "cyberbod2025/Command-center", 2)).not.toThrow();
    });
  });
});
