import { describe, it, expect, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { acceptDecision, modifyDecision } from "../src/server/decisions.js";
import { StateStore } from "../src/server/state.js";
import {
  generateExecutionPackage,
  markActionSent,
  addActionEvidence,
  addManualEvidence,
  completeActionIfVerified,
  getActionReadiness,
  assertCanPublishComment,
  ActionNotFoundError,
  ActionNotWritableError,
  ChainBlockedError,
} from "../src/server/actions.js";
import { AmbiguousOrderModificationError, EvidenceMismatchError } from "../src/server/verification.js";
import type { CommandCenterState } from "../src/server/types.js";

const tmpDirs: string[] = [];
afterEach(async () => {
  await Promise.all(tmpDirs.splice(0).map((d) => fs.rm(d, { recursive: true, force: true })));
});

async function makeStore(): Promise<{ store: StateStore; actionsDir: string }> {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "cc-actions-test-"));
  tmpDirs.push(dataDir);
  return { store: new StateStore(dataDir), actionsDir: path.join(dataDir, "actions") };
}

function findDecisionId(state: CommandCenterState, project: CommandCenterState["decisions"][number]["project"], statePredicate: string): string {
  return state.decisions.find((d) => d.project === project && d.state === statePredicate)!.id;
}

describe("cola de acciones", () => {
  it("no genera un paquete si la decision no esta aceptada o modificada", async () => {
    const { store, actionsDir } = await makeStore();
    const state = await store.load();
    const decisionId = findDecisionId(state, "Command Center", "propuesta");
    await expect(generateExecutionPackage(store, decisionId, actionsDir)).rejects.toThrow();
  });

  it("genera un archivo markdown real con las secciones requeridas", async () => {
    const { store, actionsDir } = await makeStore();
    const state = await store.load();
    const decisionId = findDecisionId(state, "Command Center", "propuesta");
    await store.mutate((s) => acceptDecision(s, decisionId));

    const { action, packagePath } = await generateExecutionPackage(store, decisionId, actionsDir);
    expect(action.status).toBe("generada");
    const content = await fs.readFile(path.join(actionsDir, "..", packagePath), "utf8");
    expect(content).toContain("## Contexto");
    expect(content).toContain("## Restricciones obligatorias");
    expect(content).toContain("## Criterio de terminado");
    expect(content).toContain("## Plan de reversion");
    expect(content).toContain("## Criterios de verificacion");

    const after = await store.load();
    expect(after.decisions.find((d) => d.id === decisionId)!.state).toBe("lista_para_ejecucion");
  });

  it("marcar enviada solo funciona una vez, desde generada", async () => {
    const { store, actionsDir } = await makeStore();
    const state = await store.load();
    const decisionId = findDecisionId(state, "Command Center", "propuesta");
    await store.mutate((s) => acceptDecision(s, decisionId));
    const { action } = await generateExecutionPackage(store, decisionId, actionsDir);

    await store.mutate((s) => markActionSent(s, action.id, "Claude Code"));
    const after = await store.load();
    expect(after.actions.find((a) => a.id === action.id)!.status).toBe("enviada");
    await expect(store.mutate((s) => markActionSent(s, action.id, "Claude Code"))).rejects.toThrow();
  });

  describe("division en acciones dependientes (P1 — PR #2 y PR #3)", () => {
    it("el merge del PR #2 no completa la decision superior", async () => {
      const { store, actionsDir } = await makeStore();
      const state = await store.load();
      const decisionId = findDecisionId(state, "Command Center", "propuesta");
      await store.mutate((s) => acceptDecision(s, decisionId));
      const { action } = await generateExecutionPackage(store, decisionId, actionsDir);

      await store.mutate((s) => {
        addActionEvidence(s, action.id, {
          kind: "merge",
          description: "PR #2 fusionado, hilos en 0, revision de Codex",
          verifiedAgainstGithub: true,
          repo: "cyberbod2025/Command-center",
          prNumber: 2,
          prState: "MERGED",
          openThreads: 0,
          totalThreads: 3,
          codexReviewFound: true,
        });
      });
      await store.mutate((s) => completeActionIfVerified(s, action.id, "PR #2 fusionado"));

      const after = await store.load();
      expect(after.actions.find((a) => a.id === action.id)!.status).toBe("completada");
      const decision = after.decisions.find((d) => d.id === decisionId)!;
      expect(decision.state).not.toBe("completada");
      expect(decision.state).toBe("en_ejecucion");
    });

    it("la accion B (PR #3) no puede generarse antes de completar la accion A (PR #2)", async () => {
      const { store, actionsDir } = await makeStore();
      const state = await store.load();
      const decisionId = findDecisionId(state, "Command Center", "propuesta");
      await store.mutate((s) => acceptDecision(s, decisionId));
      await generateExecutionPackage(store, decisionId, actionsDir); // genera solo la accion A, sin completarla

      await expect(generateExecutionPackage(store, decisionId, actionsDir)).rejects.toThrow(ChainBlockedError);
    });

    it("la accion B sigue bloqueada al intentar completarla si su dependencia no esta completada", async () => {
      const { store, actionsDir } = await makeStore();
      const state = await store.load();
      const decisionId = findDecisionId(state, "Command Center", "propuesta");
      await store.mutate((s) => acceptDecision(s, decisionId));
      const { action: actionA } = await generateExecutionPackage(store, decisionId, actionsDir);

      // Construimos manualmente una "accion B" con dependsOnActionId apuntando
      // a la accion A, que TODAVIA no esta completada.
      await store.mutate((s) => {
        const decision = s.decisions.find((d) => d.id === decisionId)!;
        s.actions.push({
          id: "act_b_manual",
          decisionId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          packagePath: "actions/no-existe.md",
          status: "generada",
          verification: decision.additionalActionPlan![0]!,
          dependsOnActionId: actionA.id,
          chainIndex: 1,
          evidence: [
            {
              id: "ev_1",
              ts: new Date().toISOString(),
              kind: "merge",
              description: "PR #3 fusionado",
              verifiedAgainstGithub: true,
              repo: "cyberbod2025/Command-center",
              prNumber: 3,
              prState: "MERGED",
              baseBranch: "main",
              openThreads: 0,
              totalThreads: 2,
              codexReviewFound: true,
            },
          ],
          history: [],
        });
      });

      await expect(store.mutate((s) => completeActionIfVerified(s, "act_b_manual", "listo"))).rejects.toThrow(ChainBlockedError);
    });

    it("ambas evidencias correctas (A y B) si completan la decision superior", async () => {
      const { store, actionsDir } = await makeStore();
      const state = await store.load();
      const decisionId = findDecisionId(state, "Command Center", "propuesta");
      await store.mutate((s) => acceptDecision(s, decisionId));

      const { action: actionA } = await generateExecutionPackage(store, decisionId, actionsDir);
      await store.mutate((s) => {
        addActionEvidence(s, actionA.id, {
          kind: "merge",
          description: "PR #2 fusionado",
          verifiedAgainstGithub: true,
          repo: "cyberbod2025/Command-center",
          prNumber: 2,
          prState: "MERGED",
          openThreads: 0,
          totalThreads: 3,
          codexReviewFound: true,
        });
      });
      await store.mutate((s) => completeActionIfVerified(s, actionA.id, "PR #2 fusionado"));

      const { action: actionB } = await generateExecutionPackage(store, decisionId, actionsDir);
      expect(actionB.dependsOnActionId).toBe(actionA.id);

      await store.mutate((s) => {
        addActionEvidence(s, actionB.id, {
          kind: "merge",
          description: "PR #3 fusionado con base en main",
          verifiedAgainstGithub: true,
          repo: "cyberbod2025/Command-center",
          prNumber: 3,
          prState: "MERGED",
          baseBranch: "main",
          openThreads: 0,
          totalThreads: 2,
          codexReviewFound: true,
        });
        addManualEvidence(s, actionB.id, {
          description: "Hugo confirmo que el diff de PR #3 se limita a la auditoria",
          evidenceType: "confirmacion_alcance_diff",
          confirmationTag: "diff_scope_confirmado",
        });
      });
      await store.mutate((s) => completeActionIfVerified(s, actionB.id, "PR #3 fusionado"));

      const after = await store.load();
      expect(after.decisions.find((d) => d.id === decisionId)!.state).toBe("completada");
    });
  });

  describe("evidencia manual operable (P1)", () => {
    it("una accion de Supabase/Drive no acepta evidencia de GitHub, solo manual", async () => {
      const { store, actionsDir } = await makeStore();
      const state = await store.load();
      const decisionId = findDecisionId(state, "Teacher OS", "propuesta");
      await store.mutate((s) => acceptDecision(s, decisionId));
      const { action } = await generateExecutionPackage(store, decisionId, actionsDir);

      await store.mutate((s) => {
        addActionEvidence(s, action.id, { kind: "manual", description: "evidencia mal marcada", verifiedAgainstGithub: true });
      });
      let readiness = getActionReadiness(await store.load(), action.id);
      expect(readiness.ready).toBe(false);

      await store.mutate((s) =>
        addManualEvidence(s, action.id, {
          description: "Hugo reviso el indice de Drive manualmente",
          evidenceType: "inventario_drive",
        })
      );
      readiness = getActionReadiness(await store.load(), action.id);
      expect(readiness.ready).toBe(true);
      expect(readiness.satisfying).toBeGreaterThanOrEqual(1);
    });

    it("evidencia manual incompleta (sin tipo) se rechaza", async () => {
      const { store, actionsDir } = await makeStore();
      const state = await store.load();
      const decisionId = findDecisionId(state, "Teacher OS", "propuesta");
      await store.mutate((s) => acceptDecision(s, decisionId));
      const { action } = await generateExecutionPackage(store, decisionId, actionsDir);

      await expect(
        store.mutate((s) => addManualEvidence(s, action.id, { description: "sin tipo", evidenceType: "" }))
      ).rejects.toThrow(/tipo de evidencia/);
    });

    it("readiness reporta 'no listo' cuando el tipo de evidencia no coincide con lo permitido", async () => {
      const { store, actionsDir } = await makeStore();
      const state = await store.load();
      const decisionId = findDecisionId(state, "Command Center", "propuesta");
      await store.mutate((s) => acceptDecision(s, decisionId));
      const { action } = await generateExecutionPackage(store, decisionId, actionsDir);

      // esta accion (Command Center) no permite kind "manual" en sus criterios
      await store.mutate((s) => addManualEvidence(s, action.id, { description: "intento invalido", evidenceType: "nota" }));
      const readiness = getActionReadiness(await store.load(), action.id);
      expect(readiness.ready).toBe(false);
    });

    it("completa correctamente una accion manual (Supabase) de principio a fin", async () => {
      const { store, actionsDir } = await makeStore();
      const state = await store.load();
      const decisionId = state.decisions.find((d) => d.project === "SASE Zero" && d.state === "aceptada")!.id;
      const { action } = await generateExecutionPackage(store, decisionId, actionsDir);

      await store.mutate((s) =>
        addManualEvidence(s, action.id, {
          description: "Hugo confirmo que no se rota la clave todavia",
          evidenceType: "confirmacion_riesgo_aceptado",
        })
      );
      await store.mutate((s) => completeActionIfVerified(s, action.id, "riesgo aceptado, sin cambios"));

      const after = await store.load();
      expect(after.actions.find((a) => a.id === action.id)!.status).toBe("completada");
      expect(after.decisions.find((d) => d.id === decisionId)!.state).toBe("completada");
    });
  });

  describe("orden estructurado del plan efectivo (P1)", () => {
    it("invertir dos pasos cambia realmente la secuencia efectiva", async () => {
      const { store, actionsDir } = await makeStore();
      const state = await store.load();
      const decisionId = findDecisionId(state, "Command Center", "propuesta");
      const original = state.decisions.find((d) => d.id === decisionId)!.plan.pasos;
      expect(original.length).toBeGreaterThanOrEqual(2);

      await store.mutate((s) => acceptDecision(s, decisionId));
      const ordenText = ["2", "1", ...original.slice(2).map((_, i) => String(i + 3))].join(",");
      await store.mutate((s) => modifyDecision(s, decisionId, { orden: ordenText }));

      const { packagePath } = await generateExecutionPackage(store, decisionId, actionsDir);
      const content = await fs.readFile(path.join(actionsDir, "..", packagePath), "utf8");

      // Busca solo dentro de la seccion "Pasos efectivos" (la que se ejecuta),
      // no en "Pasos originales" (que tambien aparece en el paquete a proposito).
      const efectivosStart = content.indexOf("## Pasos efectivos");
      expect(efectivosStart).toBeGreaterThan(-1);
      const efectivosSection = content.slice(efectivosStart);

      const idxSegundoOriginal = efectivosSection.indexOf(original[1]!);
      const idxPrimerOriginal = efectivosSection.indexOf(original[0]!);
      expect(idxSegundoOriginal).toBeGreaterThan(-1);
      expect(idxPrimerOriginal).toBeGreaterThan(idxSegundoOriginal);
    });

    it("una instruccion de orden ambigua bloquea la generacion del paquete", async () => {
      const { store, actionsDir } = await makeStore();
      const state = await store.load();
      const decisionId = findDecisionId(state, "Command Center", "propuesta");
      await store.mutate((s) => acceptDecision(s, decisionId));
      await store.mutate((s) => modifyDecision(s, decisionId, { orden: "PR #3 antes del #2" }));

      await expect(generateExecutionPackage(store, decisionId, actionsDir)).rejects.toThrow(AmbiguousOrderModificationError);

      const after = await store.load();
      expect(after.actions.filter((a) => a.decisionId === decisionId)).toHaveLength(0);
      const files = await fs.readdir(actionsDir).catch(() => []);
      expect(files.length).toBe(0);
    });

    it("el paquete no muestra simultaneamente el orden nuevo y el original", async () => {
      const { store, actionsDir } = await makeStore();
      const state = await store.load();
      const decisionId = findDecisionId(state, "Command Center", "propuesta");
      const original = state.decisions.find((d) => d.id === decisionId)!.plan.pasos;
      await store.mutate((s) => acceptDecision(s, decisionId));
      const ordenText = original.map((_, i) => String(original.length - i)).join(","); // invierte todo
      await store.mutate((s) => modifyDecision(s, decisionId, { orden: ordenText }));

      const { packagePath } = await generateExecutionPackage(store, decisionId, actionsDir);
      const content = await fs.readFile(path.join(actionsDir, "..", packagePath), "utf8");
      const pasosEfectivosSections = content.match(/## Pasos efectivos/g) ?? [];
      expect(pasosEfectivosSections).toHaveLength(1);
      expect(content).not.toContain("Orden modificado por Hugo: PR");
    });
  });

  describe("validacion antes de publicar comentario remoto", () => {
    it("un ID de accion inexistente no permite continuar", async () => {
      const { store } = await makeStore();
      const state = await store.load();
      expect(() => assertCanPublishComment(state, "act_no_existe", "cyberbod2025/Command-center", 2)).toThrow(
        ActionNotFoundError
      );
    });

    it("una accion cancelada no admite comentarios", async () => {
      const { store, actionsDir } = await makeStore();
      const state = await store.load();
      const decisionId = findDecisionId(state, "Command Center", "propuesta");
      await store.mutate((s) => acceptDecision(s, decisionId));
      const { action } = await generateExecutionPackage(store, decisionId, actionsDir);

      await store.mutate((s) => {
        const a = s.actions.find((x) => x.id === action.id)!;
        a.status = "cancelada";
      });
      const after = await store.load();
      expect(() => assertCanPublishComment(after, action.id, "cyberbod2025/Command-center", 2)).toThrow(ActionNotWritableError);
    });

    it("rechaza un repositorio o PR distinto del esperado", async () => {
      const { store, actionsDir } = await makeStore();
      const state = await store.load();
      const decisionId = findDecisionId(state, "Command Center", "propuesta");
      await store.mutate((s) => acceptDecision(s, decisionId));
      const { action } = await generateExecutionPackage(store, decisionId, actionsDir);
      await store.mutate((s) => {
        const a = s.actions.find((x) => x.id === action.id)!;
        a.verification.allowedEvidenceKinds = [...a.verification.allowedEvidenceKinds, "comment"];
      });

      const after = await store.load();
      expect(() => assertCanPublishComment(after, action.id, "cyberbod2025/SASE-ZERO", 2)).toThrow(EvidenceMismatchError);
      expect(() => assertCanPublishComment(after, action.id, "cyberbod2025/Command-center", 999)).toThrow(EvidenceMismatchError);
    });
  });
});
