import type { ActionEvidence, Decision, EvidenceKind, Modification, VerificationCriteria } from "./types.js";

/**
 * Plan efectivo: el plan base de la decision con TODAS las modificaciones de
 * Hugo ya aplicadas. Se recalcula en cada llamada a partir de
 * `decision.modifications`, asi que nunca puede quedar una modificacion sin
 * reflejar en el paquete que se genere despues.
 */
export interface EffectivePlanDiff {
  field: string;
  original: string;
  modified: string;
}

export interface EffectivePlan {
  objetivo: string;
  pasos: string[];
  responsable: string;
  fuente: string;
  validaciones: string[];
  riesgos: string[];
  revertir: string;
  evidenciaEsperada: string[];
  prioridad?: string;
  restriccionesAdicionales: string[];
  resultadoEsperadoFinal?: string;
  isModified: boolean;
  diffs: EffectivePlanDiff[];
}

export class AmbiguousOrderModificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AmbiguousOrderModificationError";
  }
}

/**
 * Interpreta `orden` como una lista de posiciones 1-basadas que reordena
 * COMPLETAMENTE los pasos actuales — nunca se antepone como nota de texto
 * ni convive con la secuencia original. Debe ser una permutacion exacta
 * (mismo largo, cada indice de 1..N presente exactamente una vez); de lo
 * contrario se rechaza para no producir un orden ejecutable ambiguo.
 *
 * Formato esperado: "3,1,2" (separado por comas y/o espacios).
 */
export function applyOrderModification(pasos: string[], ordenText: string): string[] {
  const tokens = ordenText
    .split(/[,\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  if (tokens.length !== pasos.length) {
    throw new AmbiguousOrderModificationError(
      `El orden modificado debe listar exactamente las ${pasos.length} posiciones de los pasos actuales (una permutacion de 1 a ${pasos.length}), separadas por comas. Se recibieron ${tokens.length}: "${ordenText}".`
    );
  }

  const indices: number[] = [];
  for (const t of tokens) {
    const n = Number(t);
    if (!Number.isInteger(n) || n < 1 || n > pasos.length) {
      throw new AmbiguousOrderModificationError(
        `"${t}" no es una posicion valida (debe ser un entero entre 1 y ${pasos.length}). Orden recibido: "${ordenText}".`
      );
    }
    indices.push(n);
  }

  const seen = new Set(indices);
  if (seen.size !== pasos.length) {
    throw new AmbiguousOrderModificationError(
      `El orden modificado debe usar cada posicion (1 a ${pasos.length}) exactamente una vez, sin repetir ni omitir ninguna. Orden recibido: "${ordenText}".`
    );
  }

  return indices.map((i) => pasos[i - 1]!);
}

function applyModification(acc: {
  objetivo: string;
  pasos: string[];
  validaciones: string[];
  prioridad?: string;
  restriccionesAdicionales: string[];
  resultadoEsperadoFinal?: string;
  diffs: EffectivePlanDiff[];
}, m: Modification): void {
  if (m.alcance?.trim()) {
    const original = acc.objetivo;
    acc.objetivo = `${acc.objetivo}\n\nAlcance modificado por Hugo: ${m.alcance.trim()}`;
    acc.diffs.push({ field: "alcance", original, modified: acc.objetivo });
  }
  if (m.prioridad?.trim()) {
    acc.diffs.push({ field: "prioridad", original: acc.prioridad ?? "(no definida)", modified: m.prioridad.trim() });
    acc.prioridad = m.prioridad.trim();
  }
  if (m.condiciones?.trim()) {
    const original = acc.validaciones.join("; ");
    acc.validaciones = [...acc.validaciones, `Condicion anadida por Hugo: ${m.condiciones.trim()}`];
    acc.diffs.push({ field: "condiciones", original, modified: acc.validaciones.join("; ") });
  }
  if (m.orden?.trim()) {
    const original = acc.pasos.join(" -> ");
    // Reemplaza COMPLETAMENTE la secuencia — nunca antepone ni conserva la original.
    acc.pasos = applyOrderModification(acc.pasos, m.orden.trim());
    acc.diffs.push({ field: "orden", original, modified: acc.pasos.join(" -> ") });
  }
  if (m.restricciones?.trim()) {
    acc.restriccionesAdicionales.push(m.restricciones.trim());
    acc.diffs.push({ field: "restricciones", original: "(ninguna adicional)", modified: m.restricciones.trim() });
  }
  if (m.resultadoEsperado?.trim()) {
    const original = acc.resultadoEsperadoFinal ?? "(el original: ver evidencia esperada del plan base)";
    acc.resultadoEsperadoFinal = m.resultadoEsperado.trim();
    acc.diffs.push({ field: "resultadoEsperado", original, modified: acc.resultadoEsperadoFinal });
  }
}

/**
 * Puede lanzar `AmbiguousOrderModificationError` si alguna modificacion de
 * `orden` no se traduce de forma inequivoca en una secuencia de pasos —
 * quien la llama (generacion de paquete) debe dejar que se propague y
 * bloquear la generacion en vez de producir un plan contradictorio.
 */
export function computeEffectivePlan(d: Decision): EffectivePlan {
  const base = d.plan;
  const acc = {
    objetivo: base.objetivo,
    pasos: [...base.pasos],
    validaciones: [...base.validaciones],
    prioridad: undefined as string | undefined,
    restriccionesAdicionales: [] as string[],
    resultadoEsperadoFinal: undefined as string | undefined,
    diffs: [] as EffectivePlanDiff[],
  };

  for (const m of d.modifications) applyModification(acc, m);

  const stepSet = new Set(acc.pasos);
  if (stepSet.size !== acc.pasos.length) {
    throw new AmbiguousOrderModificationError("El plan efectivo resultante contiene pasos duplicados — revisa las modificaciones de orden aplicadas.");
  }

  return {
    objetivo: acc.objetivo,
    pasos: acc.pasos,
    responsable: base.responsable,
    fuente: base.fuente,
    validaciones: acc.validaciones,
    riesgos: base.riesgos,
    revertir: base.revertir,
    evidenciaEsperada: base.evidenciaEsperada,
    prioridad: acc.prioridad,
    restriccionesAdicionales: acc.restriccionesAdicionales,
    resultadoEsperadoFinal: acc.resultadoEsperadoFinal,
    isModified: d.modifications.length > 0,
    diffs: acc.diffs,
  };
}

export class EvidenceMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvidenceMismatchError";
  }
}

/**
 * Se ejecuta ANTES de llamar a GitHub: si el repo/PR solicitados no
 * coinciden con lo que la accion espera, rechaza sin hacer ninguna llamada
 * remota. Evita "cualquier PR del mismo repo" y "PR de otro proyecto".
 */
export function assertRequestMatchesCriteria(
  v: VerificationCriteria,
  requestedRepo: string,
  requestedPrNumber?: number
): void {
  if (v.expectedRepo === null) {
    throw new EvidenceMismatchError(
      `Esta accion (${v.project}) no acepta evidencia de GitHub — requiere confirmacion manual (${v.requiredState}).`
    );
  }
  if (requestedRepo !== v.expectedRepo) {
    throw new EvidenceMismatchError(
      `Repositorio incorrecto para esta accion: se esperaba "${v.expectedRepo}", se recibio "${requestedRepo}".`
    );
  }
  if (v.expectedPrNumber !== undefined && requestedPrNumber !== v.expectedPrNumber) {
    throw new EvidenceMismatchError(
      `PR incorrecto para esta accion: se esperaba #${v.expectedPrNumber}, se recibio ${requestedPrNumber === undefined ? "ninguno" : `#${requestedPrNumber}`}.`
    );
  }
}

function evidenceKindAllowed(ev: ActionEvidence, v: VerificationCriteria): boolean {
  return (v.allowedEvidenceKinds as EvidenceKind[]).includes(ev.kind);
}

/** ¿Esta evidencia concreta satisface los criterios declarados de la accion? */
export function evidenceSatisfies(ev: ActionEvidence, v: VerificationCriteria): boolean {
  if (!evidenceKindAllowed(ev, v)) return false;

  if (v.requiredState === "manual_confirmation") {
    // Las acciones sin GitHub (Drive/Supabase) solo se satisfacen con evidencia manual,
    // nunca con evidencia marcada como verificada contra GitHub.
    return ev.kind === "manual" && !ev.verifiedAgainstGithub;
  }

  if (v.expectedRepo === null) return false; // nunca deberia llegar evidencia de GitHub aqui
  if (!ev.verifiedAgainstGithub) return false;
  if (ev.repo !== v.expectedRepo) return false;
  if (v.expectedPrNumber !== undefined && ev.prNumber !== v.expectedPrNumber) return false;
  if (v.expectedBranch !== undefined && ev.branch !== v.expectedBranch) return false;
  if (v.expectedBaseBranch !== undefined && ev.baseBranch !== v.expectedBaseBranch) return false;
  if (v.expectedCommitShort !== undefined && ev.commitShort !== v.expectedCommitShort) return false;
  if (v.requireZeroOpenThreads && ev.openThreads !== 0) return false;
  if (v.requireCodexReview && ev.codexReviewFound !== true) return false;

  switch (v.requiredState) {
    case "pr_open":
      return ev.prState === "OPEN";
    case "pr_closed":
      return ev.prState === "CLOSED";
    case "pr_merged":
      return ev.prState === "MERGED";
    case "comment_published":
      return ev.kind === "comment" && !!(ev.commentUrl ?? ev.url);
    case "thread_resolved":
      return ev.openThreads === 0 && (ev.totalThreads ?? 0) > 0;
    case "checks_green":
      return ev.checksAllGreen === true;
    case "commit_exists":
      return !!ev.commitShort;
    default:
      return false;
  }
}

export function countSatisfyingEvidence(evidence: ActionEvidence[], v: VerificationCriteria): number {
  return evidence.filter((e) => evidenceSatisfies(e, v)).length;
}

export interface CompletionCheck {
  ok: boolean;
  satisfying: number;
  minEvidence: number;
  missingManualTags: string[];
}

/**
 * Evalua si una accion tiene evidencia suficiente para completarse: al
 * menos `minEvidence` evidencias que cumplen `evidenceSatisfies`, MAS —
 * cuando la accion lo requiere — una evidencia manual por cada
 * `requiredManualConfirmationTags`. Esta es la unica fuente de verdad que
 * consultan tanto `completeActionIfVerified` como el endpoint de
 * "readiness" que usa la interfaz para habilitar "Completar".
 */
export function checkCompletion(evidence: ActionEvidence[], v: VerificationCriteria): CompletionCheck {
  const satisfying = countSatisfyingEvidence(evidence, v);
  const missingManualTags = (v.requiredManualConfirmationTags ?? []).filter(
    (tag) => !evidence.some((e) => e.kind === "manual" && e.confirmationTag === tag)
  );
  return {
    ok: satisfying >= v.minEvidence && missingManualTags.length === 0,
    satisfying,
    minEvidence: v.minEvidence,
    missingManualTags,
  };
}

export function describeCriteria(v: VerificationCriteria): string {
  const repoPart = v.expectedRepo ? `repo=${v.expectedRepo}${v.expectedPrNumber ? ` PR#${v.expectedPrNumber}` : ""}` : "sin GitHub (manual)";
  const extras: string[] = [];
  if (v.expectedBaseBranch) extras.push(`base=${v.expectedBaseBranch}`);
  if (v.requireZeroOpenThreads) extras.push("hilos=0");
  if (v.requireCodexReview) extras.push("revision Codex requerida");
  if (v.requiredManualConfirmationTags?.length) extras.push(`confirmaciones=${v.requiredManualConfirmationTags.join(",")}`);
  return `estado requerido=${v.requiredState}, ${repoPart}, tipos permitidos=${v.allowedEvidenceKinds.join(",")}, minimo=${v.minEvidence}${extras.length ? `, ${extras.join(", ")}` : ""}`;
}
