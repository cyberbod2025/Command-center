import { describe, it, expect } from "vitest";
import { buildSeedState } from "../src/server/seed.js";
import {
  assertRequestMatchesCriteria,
  computeEffectivePlan,
  countSatisfyingEvidence,
  evidenceSatisfies,
  EvidenceMismatchError,
} from "../src/server/verification.js";
import type { ActionEvidence, VerificationCriteria } from "../src/server/types.js";

function mergeCriteria(): VerificationCriteria {
  return {
    project: "Command Center",
    expectedRepo: "cyberbod2025/Command-center",
    allowedEvidenceKinds: ["pr_updated", "merge"],
    expectedPrNumber: 2,
    requiredState: "pr_merged",
    extraConditions: [],
    minEvidence: 1,
  };
}

function ev(overrides: Partial<ActionEvidence>): ActionEvidence {
  return {
    id: "ev_1",
    ts: new Date(0).toISOString(),
    kind: "pr_updated",
    description: "desc",
    verifiedAgainstGithub: true,
    ...overrides,
  };
}

describe("evidenceSatisfies — vincular evidencia a la accion", () => {
  it("una accion de merge NO se satisface con un PR abierto", () => {
    const v = mergeCriteria();
    const openEv = ev({ kind: "pr_updated", repo: v.expectedRepo!, prNumber: 2, prState: "OPEN" });
    expect(evidenceSatisfies(openEv, v)).toBe(false);
  });

  it("una accion de merge SI se satisface con el PR correcto fusionado", () => {
    const v = mergeCriteria();
    const mergedEv = ev({ kind: "merge", repo: v.expectedRepo!, prNumber: 2, prState: "MERGED" });
    expect(evidenceSatisfies(mergedEv, v)).toBe(true);
  });

  it("rechaza evidencia de un PR distinto del esperado", () => {
    const v = mergeCriteria();
    const wrongPr = ev({ kind: "merge", repo: v.expectedRepo!, prNumber: 3, prState: "MERGED" });
    expect(evidenceSatisfies(wrongPr, v)).toBe(false);
  });

  it("rechaza evidencia de otro repositorio aunque el PR coincida", () => {
    const v = mergeCriteria();
    const wrongRepo = ev({ kind: "merge", repo: "cyberbod2025/NUEVO-HORIZONTE", prNumber: 2, prState: "MERGED" });
    expect(evidenceSatisfies(wrongRepo, v)).toBe(false);
  });

  it("un comentario no satisface una accion que exige hilo resuelto", () => {
    const v: VerificationCriteria = {
      project: "Command Center",
      expectedRepo: "cyberbod2025/Command-center",
      allowedEvidenceKinds: ["pr_updated", "comment"],
      expectedPrNumber: 2,
      requiredState: "thread_resolved",
      extraConditions: [],
      minEvidence: 1,
    };
    const commentEv = ev({ kind: "comment", repo: v.expectedRepo!, prNumber: 2, commentUrl: "https://github.com/x" });
    expect(evidenceSatisfies(commentEv, v)).toBe(false);

    const resolvedEv = ev({ kind: "pr_updated", repo: v.expectedRepo!, prNumber: 2, openThreads: 0, totalThreads: 4 });
    expect(evidenceSatisfies(resolvedEv, v)).toBe(true);
  });

  it("una accion sin GitHub (Drive/Supabase) no acepta evidencia verificada contra GitHub", () => {
    const v: VerificationCriteria = {
      project: "SASE Zero",
      expectedRepo: null,
      allowedEvidenceKinds: ["manual"],
      requiredState: "manual_confirmation",
      extraConditions: [],
      minEvidence: 1,
    };
    const githubEv = ev({ kind: "manual", verifiedAgainstGithub: true, description: "intento de colar evidencia de github" });
    expect(evidenceSatisfies(githubEv, v)).toBe(false);

    const manualEv = ev({ kind: "manual", verifiedAgainstGithub: false, description: "Hugo confirmo acceso a Supabase" });
    expect(evidenceSatisfies(manualEv, v)).toBe(true);
  });

  it("countSatisfyingEvidence solo cuenta evidencia que cumple todos los criterios", () => {
    const v = mergeCriteria();
    const evidence = [
      ev({ kind: "pr_updated", repo: v.expectedRepo!, prNumber: 2, prState: "OPEN" }),
      ev({ kind: "merge", repo: "otro/repo", prNumber: 2, prState: "MERGED" }),
      ev({ kind: "merge", repo: v.expectedRepo!, prNumber: 2, prState: "MERGED" }),
    ];
    expect(countSatisfyingEvidence(evidence, v)).toBe(1);
  });
});

describe("assertRequestMatchesCriteria — rechaza antes de llamar a GitHub", () => {
  it("rechaza un repo distinto del esperado", () => {
    const v = mergeCriteria();
    expect(() => assertRequestMatchesCriteria(v, "cyberbod2025/SASE-ZERO", 2)).toThrow(EvidenceMismatchError);
  });

  it("rechaza un PR distinto del esperado", () => {
    const v = mergeCriteria();
    expect(() => assertRequestMatchesCriteria(v, v.expectedRepo!, 99)).toThrow(EvidenceMismatchError);
  });

  it("rechaza cualquier evidencia de GitHub para una accion con expectedRepo null", () => {
    const v: VerificationCriteria = {
      project: "Teacher OS",
      expectedRepo: null,
      allowedEvidenceKinds: ["manual"],
      requiredState: "manual_confirmation",
      extraConditions: [],
      minEvidence: 1,
    };
    expect(() => assertRequestMatchesCriteria(v, "cyberbod2025/Command-center", 1)).toThrow(EvidenceMismatchError);
  });

  it("acepta cuando repo y PR coinciden exactamente", () => {
    const v = mergeCriteria();
    expect(() => assertRequestMatchesCriteria(v, v.expectedRepo!, v.expectedPrNumber)).not.toThrow();
  });
});

describe("computeEffectivePlan", () => {
  it("sin modificaciones, el plan efectivo es igual al plan base", () => {
    const state = buildSeedState();
    const d = state.decisions.find((x) => x.state === "propuesta")!;
    const effective = computeEffectivePlan(d);
    expect(effective.isModified).toBe(false);
    expect(effective.objetivo).toBe(d.plan.objetivo);
    expect(effective.diffs).toHaveLength(0);
  });

  it("una restriccion modificada aparece en restriccionesAdicionales y en los diffs", () => {
    const state = buildSeedState();
    const d = state.decisions.find((x) => x.state === "propuesta")!;
    d.modifications.push({
      id: "mod_1",
      ts: new Date().toISOString(),
      restricciones: "No tocar el modulo 9 bajo ninguna circunstancia",
    });
    const effective = computeEffectivePlan(d);
    expect(effective.isModified).toBe(true);
    expect(effective.restriccionesAdicionales).toContain("No tocar el modulo 9 bajo ninguna circunstancia");
    expect(effective.diffs.some((diff) => diff.field === "restricciones")).toBe(true);
  });

  it("el orden modificado se refleja al inicio de los pasos efectivos", () => {
    const state = buildSeedState();
    const d = state.decisions.find((x) => x.state === "propuesta")!;
    d.modifications.push({ id: "mod_1", ts: new Date().toISOString(), orden: "Primero verificar checks, luego mergear" });
    const effective = computeEffectivePlan(d);
    expect(effective.pasos[0]).toContain("Primero verificar checks, luego mergear");
  });
});
