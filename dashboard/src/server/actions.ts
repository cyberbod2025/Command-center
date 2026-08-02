import { promises as fs } from "node:fs";
import path from "node:path";
import { newId, nowIso } from "./ids.js";
import { findDecision, markReadyForExecution, markSent, markCompleted, markInExecution, markFailed } from "./decisions.js";
import {
  checkCompletion,
  computeEffectivePlan,
  describeCriteria,
  assertRequestMatchesCriteria,
} from "./verification.js";
import type { StateStore } from "./state.js";
import type { ActionEvidence, ActionRecord, CommandCenterState, Decision, VerificationCriteria } from "./types.js";

export class ActionNotFoundError extends Error {
  constructor(id: string) {
    super(`Accion no encontrada: ${id}`);
    this.name = "ActionNotFoundError";
  }
}

export class ActionNotWritableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActionNotWritableError";
  }
}

/** La decision requiere completar una accion anterior de la cadena antes de generar/completar esta. */
export class ChainBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChainBlockedError";
  }
}

function findAction(state: CommandCenterState, id: string): ActionRecord {
  const a = state.actions.find((x) => x.id === id);
  if (!a) throw new ActionNotFoundError(id);
  return a;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

// ---------------- Cadena de acciones dependientes ----------------

export interface ChainSlot {
  slotIndex: number;
  totalSlots: number;
  criteria: VerificationCriteria;
  dependsOnActionId?: string;
}

const NON_GENERATABLE_STATES = new Set([
  "propuesta",
  "en_analisis",
  "rechazada",
  "pospuesta",
  "bloqueada",
  "completada",
  "fallida",
  "cancelada",
]);

function chainCriteria(d: Decision): VerificationCriteria[] {
  return [d.verification, ...(d.additionalActionPlan ?? [])];
}

/**
 * Determina cual es la SIGUIENTE accion que hay que generar para completar
 * esta decision, respetando el orden de la cadena: la accion de indice i>0
 * no puede generarse hasta que la accion de indice i-1 este `completada`.
 * Lanza `ChainBlockedError` si la siguiente accion pendiente esta bloqueada
 * por una anterior sin completar, y un Error normal si la decision no esta
 * en un estado que admita generar (o si la cadena ya esta completa).
 */
export function resolveNextChainSlot(state: CommandCenterState, d: Decision): ChainSlot {
  if (NON_GENERATABLE_STATES.has(d.state)) {
    throw new Error(
      `No se puede generar un paquete de ejecucion desde el estado "${d.state}". La decision debe estar aceptada o modificada primero.`
    );
  }

  const chain = chainCriteria(d);
  const decisionActions = state.actions.filter((a) => a.decisionId === d.id);
  const completedBySlot = new Map<number, string>();
  for (const a of decisionActions) {
    if (a.status === "completada" && a.chainIndex !== undefined) completedBySlot.set(a.chainIndex, a.id);
  }

  for (let i = 0; i < chain.length; i++) {
    if (completedBySlot.has(i)) continue;

    // Si ya hay un intento vivo (no fallido) para esta posicion de la cadena,
    // no se genera otro — hay que completarlo o marcarlo fallido primero.
    const liveAttempt = decisionActions.find((a) => a.chainIndex === i && a.status !== "fallida");
    if (liveAttempt) {
      throw new ChainBlockedError(
        `La accion #${i + 1} de esta decision (de ${chain.length}) ya tiene un intento en curso (estado "${liveAttempt.status}") — completala o marcala fallida antes de generar otra.`
      );
    }

    if (i > 0 && !completedBySlot.has(i - 1)) {
      throw new ChainBlockedError(
        `La accion #${i + 1} de esta decision (de ${chain.length}) esta bloqueada hasta que la accion #${i} se complete.`
      );
    }
    return { slotIndex: i, totalSlots: chain.length, criteria: chain[i]!, dependsOnActionId: i > 0 ? completedBySlot.get(i - 1) : undefined };
  }

  throw new Error("Todas las acciones de esta decision ya estan completadas — no hay nada mas que generar.");
}

function renderPackageMarkdown(
  decisionQuestion: string,
  decisionId: string,
  decisionProject: string,
  decisionState: string,
  problem: string,
  evidence: string[],
  affected: string[],
  basePlan: { objetivo: string; pasos: string[]; responsable: string; fuente: string; validaciones: string[]; riesgos: string[]; revertir: string; evidenciaEsperada: string[] },
  effective: ReturnType<typeof computeEffectivePlan>,
  verification: VerificationCriteria,
  actionId: string,
  createdAt: string,
  slot: ChainSlot
): string {
  const modBlock = effective.isModified
    ? `## Propuesta original

${basePlan.objetivo}

Pasos originales:
${basePlan.pasos.map((s, i) => `${i + 1}. ${s}`).join("\n")}

## Modificaciones aprobadas por Hugo

${effective.diffs.map((d) => `- **${d.field}:** ${d.modified}`).join("\n")}

## Pasos efectivos (los que se ejecutan — reemplazan por completo a los originales)

${effective.pasos.map((s, i) => `${i + 1}. ${s}`).join("\n")}

${effective.prioridad ? `**Prioridad:** ${effective.prioridad}\n` : ""}
## Diferencias respecto a la propuesta original

${effective.diffs.map((d) => `- **${d.field}:** "${d.original}" → "${d.modified}"`).join("\n")}
`
    : `## Pasos efectivos (sin modificaciones de Hugo)

${effective.pasos.map((s, i) => `${i + 1}. ${s}`).join("\n")}
`;

  const restriccionesObligatorias = [
    "No fusionar ningun PR automaticamente.",
    "No borrar ramas ni hacer force-push.",
    "No rotar claves ni tocar Supabase.",
    "No escribir en Google Drive.",
    "No ejecutar ninguna accion fuera de las descritas en este paquete.",
    `Elementos que este paquete puede tocar: ${affected.join(", ") || "ninguno declarado"}.`,
    ...effective.restriccionesAdicionales,
  ];

  const secuenciaLinea =
    slot.totalSlots > 1
      ? `- **Secuencia:** accion ${slot.slotIndex + 1} de ${slot.totalSlots} de esta decision${slot.dependsOnActionId ? ` — depende de \`${slot.dependsOnActionId}\`` : " — primera de la cadena"}.\n`
      : "";

  return `# Paquete de ejecucion — ${decisionQuestion}

- **ID de accion:** \`${actionId}\`
- **Decision:** \`${decisionId}\`
- **Proyecto:** ${decisionProject}
- **Generado:** ${createdAt}
- **Estado de la decision al generar:** ${decisionState}
${secuenciaLinea}
## Contexto

${problem}

Evidencia disponible en el repositorio:
${evidence.map((e) => `- ${e}`).join("\n")}

${modBlock}

**Responsable sugerido:** ${effective.responsable}
**Repositorio / fuente:** \`${effective.fuente}\`

## Restricciones obligatorias

${restriccionesObligatorias.map((r) => `- ${r}`).join("\n")}

## Validaciones necesarias

${effective.validaciones.map((v) => `- ${v}`).join("\n")}

## Criterios de verificacion (lo que cierra esta accion)

- Repositorio esperado: ${verification.expectedRepo ?? "ninguno (accion sin GitHub)"}
- PR esperado: ${verification.expectedPrNumber !== undefined ? `#${verification.expectedPrNumber}` : "no aplica"}
${verification.expectedBaseBranch ? `- Rama base esperada: ${verification.expectedBaseBranch}\n` : ""}${verification.requireZeroOpenThreads ? "- Requiere cero hilos de revision abiertos\n" : ""}${verification.requireCodexReview ? "- Requiere revision de Codex detectada\n" : ""}- Estado requerido: ${verification.requiredState}
- Tipos de evidencia permitidos: ${verification.allowedEvidenceKinds.join(", ")}
- Evidencia minima: ${verification.minEvidence}
${verification.requiredManualConfirmationTags?.length ? `- Confirmaciones manuales requeridas ademas de la evidencia principal: ${verification.requiredManualConfirmationTags.join(", ")}\n` : ""}
## Resultado esperado final

${effective.resultadoEsperadoFinal ?? effective.evidenciaEsperada.join("; ")}

## Criterio de terminado

Esta accion se considera completada solo cuando exista evidencia que
coincida exactamente con los criterios de verificacion de arriba —
repositorio, PR, rama base, estado, hilos y revision (segun aplique) — mas
cualquier confirmacion manual requerida, verificada contra la fuente real
descrita en este paquete. Nunca por declaracion sin verificar.

## Plan de reversion

${effective.revertir}

## Agente sugerido

Claude Code, en una sesion con acceso al repositorio \`${effective.fuente}\`, siguiendo
el gobierno de ramas del portafolio (rama corta, pruebas en verde, PR, revision
de Codex, sin merge automatico).
`;
}

export interface GeneratePackageResult {
  action: ActionRecord;
  packagePath: string;
}

export interface VerificationOverride {
  expectedPrNumber?: number;
  expectedBranch?: string;
  expectedCommitShort?: string;
}

const GITHUB_SCOPED_STATES: ReadonlyArray<VerificationCriteria["requiredState"]> = [
  "pr_open",
  "pr_closed",
  "pr_merged",
  "comment_published",
  "thread_resolved",
  "checks_green",
  "commit_exists",
];

function applyOverride(criteria: VerificationCriteria, override?: VerificationOverride): VerificationCriteria {
  const merged: VerificationCriteria = {
    ...criteria,
    ...(override?.expectedPrNumber !== undefined ? { expectedPrNumber: override.expectedPrNumber } : {}),
    ...(override?.expectedBranch !== undefined ? { expectedBranch: override.expectedBranch } : {}),
    ...(override?.expectedCommitShort !== undefined ? { expectedCommitShort: override.expectedCommitShort } : {}),
  };
  if (
    merged.expectedRepo !== null &&
    GITHUB_SCOPED_STATES.includes(merged.requiredState) &&
    merged.expectedPrNumber === undefined &&
    merged.expectedCommitShort === undefined
  ) {
    throw new Error(
      "Esta accion afecta a mas de un PR/commit posible: hay que indicar expectedPrNumber (o expectedCommitShort) al generar el paquete para que la evidencia quede vinculada a un objetivo concreto."
    );
  }
  return merged;
}

interface CommittedDraft {
  action: ActionRecord;
  packagePath: string;
  tmpFullPath: string;
  finalFullPath: string;
}

/**
 * Genera un paquete de ejecucion en Markdown para la SIGUIENTE accion
 * pendiente de la cadena de esta decision (ver `resolveNextChainSlot`), y
 * crea el registro de accion correspondiente en la cola. No ejecuta nada
 * por si sola.
 *
 * El plan efectivo (con todas las modificaciones de Hugo ya aplicadas) se
 * calcula en el momento de generar — nunca puede quedar una modificacion
 * "pendiente" sin reflejarse. Si una modificacion de `orden` no se traduce
 * en una secuencia inequivoca, `computeEffectivePlan` lanza y NO se genera
 * nada (ni archivo ni accion).
 *
 * Consistencia de archivo/estado (evita paquetes huerfanos):
 * 1. El Markdown se escribe primero a una ruta TEMPORAL.
 * 2. El estado (JSON) se confirma en una unica mutacion atomica que
 *    tambien registra la accion — si esta mutacion falla por CUALQUIER
 *    motivo (validacion, fallo de `writeAtomic`, fallo de backup...), el
 *    archivo temporal se borra y no queda ningun registro a medias.
 * 3. Solo entonces se renombra el archivo temporal a su nombre final.
 * 4. Si el renombrado final falla, la accion ya persistida se marca
 *    `fallida` (una mutacion de compensacion) y el temporal se borra —
 *    nunca queda un paquete consumible sin una accion valida que lo respalde.
 */
export async function generateExecutionPackage(
  store: StateStore,
  decisionId: string,
  actionsDir: string,
  override?: VerificationOverride
): Promise<GeneratePackageResult> {
  let tmpFullPathForCleanup: string | undefined;

  let committed: CommittedDraft;
  try {
    committed = await store.mutate(async (draft) => {
      const d = findDecision(draft, decisionId);
      const slot = resolveNextChainSlot(draft, d);
      const verification = applyOverride(slot.criteria, override);
      const effective = computeEffectivePlan(d); // puede lanzar AmbiguousOrderModificationError

      const ts = nowIso();
      const actionId = newId("act");
      const finalFileName = `${ts.replace(/[:.]/g, "-")}_${slugify(d.question)}_${actionId}.md`;
      const finalFullPath = path.join(actionsDir, finalFileName);
      const tmpFullPath = `${finalFullPath}.tmp`;

      const markdown = renderPackageMarkdown(
        d.question,
        d.id,
        d.project,
        d.state,
        d.problem,
        d.evidence,
        d.affected,
        d.plan,
        effective,
        verification,
        actionId,
        ts,
        slot
      );

      await fs.mkdir(actionsDir, { recursive: true });
      await fs.writeFile(tmpFullPath, markdown, "utf8");
      tmpFullPathForCleanup = tmpFullPath; // visible al catch exterior si algo posterior falla

      const packagePath = path.relative(path.join(actionsDir, ".."), finalFullPath).split(path.sep).join("/");
      const action: ActionRecord = {
        id: actionId,
        decisionId,
        createdAt: ts,
        updatedAt: ts,
        packagePath,
        status: "generada",
        verification,
        chainIndex: slot.slotIndex,
        dependsOnActionId: slot.dependsOnActionId,
        evidence: [],
        history: [{ id: newId("hist"), ts, actor: "hugo", action: "generated", detail: `Paquete de ejecucion generado (accion ${slot.slotIndex + 1}/${slot.totalSlots}).` }],
      };
      draft.actions.push(action);
      d.actionIds.push(action.id);

      if (slot.slotIndex === 0) {
        markReadyForExecution(draft, decisionId);
      }

      return { action, packagePath, tmpFullPath, finalFullPath };
    });
  } catch (err) {
    if (tmpFullPathForCleanup) {
      await fs.rm(tmpFullPathForCleanup, { force: true }).catch(() => undefined);
    }
    throw err;
  }

  try {
    await fs.rename(committed.tmpFullPath, committed.finalFullPath);
  } catch (renameErr) {
    await fs.rm(committed.tmpFullPath, { force: true }).catch(() => undefined);
    await store
      .mutate((draft) => {
        const action = draft.actions.find((a) => a.id === committed.action.id);
        if (action) {
          action.status = "fallida";
          action.updatedAt = nowIso();
          action.history.push({
            id: newId("hist"),
            ts: action.updatedAt,
            actor: "sistema",
            action: "package_publish_failed",
            detail: `No se pudo publicar el paquete final: ${renameErr instanceof Error ? renameErr.message : "error desconocido"}`,
          });
        }
      })
      .catch(() => undefined);
    throw new Error(
      `El paquete se genero pero no pudo publicarse (${renameErr instanceof Error ? renameErr.message : "error desconocido"}). La accion quedo marcada como fallida; no queda ningun archivo consumible.`
    );
  }

  return { action: committed.action, packagePath: committed.packagePath };
}

export function markActionSent(state: CommandCenterState, actionId: string, agent: string, notes?: string): ActionRecord {
  const action = findAction(state, actionId);
  if (action.status !== "generada") {
    throw new Error(`Solo se puede marcar como enviada una accion en estado "generada" (actual: ${action.status}).`);
  }
  const ts = nowIso();
  action.status = "enviada";
  action.updatedAt = ts;
  action.sentTo = { ts, agent, notes };
  action.history.push({
    id: newId("hist"),
    ts,
    actor: "hugo",
    action: "sent",
    detail: `Registrada como enviada a ${agent}.${notes ? ` Notas: ${notes}` : ""}`,
  });
  markSent(state, action.decisionId);
  return action;
}

export function addActionEvidence(
  state: CommandCenterState,
  actionId: string,
  evidence: Omit<ActionEvidence, "id" | "ts">
): ActionRecord {
  const action = findAction(state, actionId);
  const ts = nowIso();
  action.evidence.push({ id: newId("ev"), ts, ...evidence });
  action.updatedAt = ts;
  action.history.push({
    id: newId("hist"),
    ts,
    actor: "sistema",
    action: "evidence_recorded",
    detail: `${evidence.kind}: ${evidence.description}${evidence.verifiedAgainstGithub ? " (verificado en GitHub)" : " (sin verificar)"}`,
  });
  return action;
}

export interface ManualEvidenceInput {
  description: string;
  evidenceType: string;
  source?: string;
  occurredAt?: string;
  responsible?: string;
  reference?: string;
  notes?: string;
  confirmationTag?: string;
}

/**
 * Registra evidencia manual (Teacher OS, Supabase u otra fuente sin
 * GitHub) desde la interfaz. Siempre `kind: "manual"`,
 * `verifiedAgainstGithub: false` — nunca puede colarse como evidencia de
 * GitHub. La descripcion y el tipo de evidencia son obligatorios.
 */
export function addManualEvidence(state: CommandCenterState, actionId: string, input: ManualEvidenceInput): ActionRecord {
  if (!input.description?.trim()) throw new Error("La descripcion de la evidencia manual es obligatoria.");
  if (!input.evidenceType?.trim()) throw new Error("El tipo de evidencia manual es obligatorio.");

  return addActionEvidence(state, actionId, {
    kind: "manual",
    description: input.description.trim(),
    verifiedAgainstGithub: false,
    evidenceType: input.evidenceType.trim(),
    source: input.source?.trim() || undefined,
    occurredAt: input.occurredAt?.trim() || undefined,
    responsible: input.responsible?.trim() || undefined,
    reference: input.reference?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    confirmationTag: input.confirmationTag?.trim() || undefined,
  });
}

/**
 * Estado de "¿esta accion esta lista para completarse?" que consulta tanto
 * `completeActionIfVerified` como el endpoint de readiness que usa la
 * interfaz — nunca se basa en `verifiedAgainstGithub` como condicion
 * universal, sino en `verification.ts::checkCompletion` contra los
 * criterios estructurados de la propia accion.
 */
export function getActionReadiness(state: CommandCenterState, actionId: string) {
  const action = findAction(state, actionId);
  const check = checkCompletion(action.evidence, action.verification);
  const dependencyOk =
    !action.dependsOnActionId || state.actions.find((a) => a.id === action.dependsOnActionId)?.status === "completada";
  return {
    actionId,
    ready: check.ok && dependencyOk,
    satisfying: check.satisfying,
    minEvidence: check.minEvidence,
    missingManualTags: check.missingManualTags,
    dependencyOk,
    dependsOnActionId: action.dependsOnActionId,
    criteria: describeCriteria(action.verification),
  };
}

/**
 * Marca una accion como completada UNICAMENTE si:
 * 1. no depende de otra accion pendiente (`dependsOnActionId`), y
 * 2. la evidencia registrada cumple `verification.ts::checkCompletion`
 *    (coincidencia exacta de repo/PR/rama/estado/hilos/revision, mas
 *    cualquier confirmacion manual requerida) — nunca por
 *    `verifiedAgainstGithub` aislado ni por declaracion sin verificar.
 *
 * La DECISION superior solo se marca completada cuando TODAS las acciones
 * de su cadena (`verification` + `additionalActionPlan`) estan
 * `completada`, en orden. Si a esta accion le siguen mas acciones
 * pendientes, la decision pasa a `en_ejecucion`, no a `completada`.
 */
export function completeActionIfVerified(state: CommandCenterState, actionId: string, summary: string): ActionRecord {
  const action = findAction(state, actionId);

  if (action.dependsOnActionId) {
    const dependency = state.actions.find((a) => a.id === action.dependsOnActionId);
    if (!dependency || dependency.status !== "completada") {
      throw new ChainBlockedError(
        `No se puede completar: esta accion depende de que la accion ${action.dependsOnActionId} este completada primero (estado actual: ${dependency?.status ?? "desconocida"}).`
      );
    }
  }

  const check = checkCompletion(action.evidence, action.verification);
  if (!check.ok) {
    const missing = check.missingManualTags.length ? ` Confirmaciones manuales faltantes: ${check.missingManualTags.join(", ")}.` : "";
    throw new Error(
      `No se puede completar: la evidencia registrada no cumple los criterios de esta accion (${describeCriteria(action.verification)}). ` +
        `Evidencia que coincide: ${check.satisfying}/${check.minEvidence} requerida(s).${missing}`
    );
  }

  action.status = "completada";
  action.updatedAt = nowIso();
  action.history.push({
    id: newId("hist"),
    ts: action.updatedAt,
    actor: "sistema",
    action: "completed",
    detail: `Completada con ${check.satisfying} evidencia(s) que cumplen los criterios declarados. ${summary}`,
  });

  const d = findDecision(state, action.decisionId);
  const chainLength = 1 + (d.additionalActionPlan?.length ?? 0);
  const decisionActions = state.actions.filter((a) => a.decisionId === d.id);
  const completedSlots = new Set(
    decisionActions.filter((a) => a.status === "completada" && a.chainIndex !== undefined).map((a) => a.chainIndex)
  );

  if (completedSlots.size >= chainLength) {
    markCompleted(state, action.decisionId, summary);
  } else {
    try {
      markInExecution(state, action.decisionId);
    } catch {
      // la decision ya estaba en un estado compatible (p. ej. en_ejecucion); no es fatal.
    }
  }
  return action;
}

export function failAction(state: CommandCenterState, actionId: string, detail: string): ActionRecord {
  const action = findAction(state, actionId);
  action.status = "fallida";
  action.updatedAt = nowIso();
  action.history.push({ id: newId("hist"), ts: action.updatedAt, actor: "sistema", action: "failed", detail });
  markFailed(state, action.decisionId, detail);
  return action;
}

const TERMINAL_STATUSES = new Set(["cancelada", "completada", "fallida"]);

/**
 * Valida TODO lo necesario antes de que routes.ts intente publicar un
 * comentario remoto en un PR. Si algo falla aqui, no se produce ninguna
 * llamada a `gh` — se lanza el error correspondiente y el caller no debe
 * continuar.
 */
export function assertCanPublishComment(
  state: CommandCenterState,
  actionId: string,
  repo: string,
  prNumber: number
): ActionRecord {
  const action = findAction(state, actionId); // 1. la accion existe

  if (TERMINAL_STATUSES.has(action.status)) {
    // 2. valida su estado
    throw new ActionNotWritableError(
      `La accion ${actionId} esta en estado terminal "${action.status}" — no admite nuevas escrituras remotas.`
    );
  }

  if (!action.verification.allowedEvidenceKinds.includes("comment")) {
    // 3. confirma que permite escritura remota (comentarios)
    throw new ActionNotWritableError(
      `Esta accion (${describeCriteria(action.verification)}) no admite evidencia de tipo "comment" — publicar un comentario no la satisface.`
    );
  }

  // 4. valida repositorio y PR contra los datos esperados de la accion
  assertRequestMatchesCriteria(action.verification, repo, prNumber);

  return action;
}

export { findAction };
