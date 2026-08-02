import { promises as fs } from "node:fs";
import path from "node:path";
import { newId, nowIso } from "./ids.js";
import { findDecision, markReadyForExecution, markSent, markCompleted, markFailed } from "./decisions.js";
import { computeEffectivePlan, countSatisfyingEvidence, describeCriteria, assertRequestMatchesCriteria } from "./verification.js";
import type { ActionEvidence, ActionRecord, CommandCenterState, VerificationCriteria } from "./types.js";

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

function renderPackageMarkdown(decisionQuestion: string, decisionId: string, decisionProject: string, decisionState: string, problem: string, evidence: string[], affected: string[], basePlan: { objetivo: string; pasos: string[]; responsable: string; fuente: string; validaciones: string[]; riesgos: string[]; revertir: string; evidenciaEsperada: string[] }, effective: ReturnType<typeof computeEffectivePlan>, verification: VerificationCriteria, actionId: string, createdAt: string): string {
  const modBlock = effective.isModified
    ? `## Propuesta original

${basePlan.objetivo}

Pasos originales:
${basePlan.pasos.map((s, i) => `${i + 1}. ${s}`).join("\n")}

## Modificaciones aprobadas por Hugo

${effective.diffs.map((d) => `- **${d.field}:** ${d.modified}`).join("\n")}

## Plan efectivo final (el que se ejecuta)

${effective.objetivo}

Pasos efectivos:
${effective.pasos.map((s, i) => `${i + 1}. ${s}`).join("\n")}

${effective.prioridad ? `**Prioridad:** ${effective.prioridad}\n` : ""}
## Diferencias respecto a la propuesta original

${effective.diffs.map((d) => `- **${d.field}:** "${d.original}" → "${d.modified}"`).join("\n")}
`
    : `## Plan (sin modificaciones de Hugo)

${effective.objetivo}

Pasos:
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

  return `# Paquete de ejecucion — ${decisionQuestion}

- **ID de accion:** \`${actionId}\`
- **Decision:** \`${decisionId}\`
- **Proyecto:** ${decisionProject}
- **Generado:** ${createdAt}
- **Estado de la decision al generar:** ${decisionState}

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
- Estado requerido: ${verification.requiredState}
- Tipos de evidencia permitidos: ${verification.allowedEvidenceKinds.join(", ")}
- Evidencia minima: ${verification.minEvidence}
${verification.extraConditions.map((c) => `- ${c}`).join("\n")}

## Resultado esperado final

${effective.resultadoEsperadoFinal ?? effective.evidenciaEsperada.join("; ")}

## Criterio de terminado

Esta accion se considera completada solo cuando exista evidencia que
coincida exactamente con los criterios de verificacion de arriba —
repositorio, PR, estado y tipo correctos — verificada contra la fuente real
descrita en este paquete. Nunca por declaracion sin verificar, y nunca con
evidencia de otro repositorio, otro PR u otro tipo de accion.

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

/**
 * Genera un paquete de ejecucion en Markdown para una decision ya aceptada
 * o modificada, y crea el registro de accion correspondiente en la cola.
 * No ejecuta nada por si sola.
 *
 * El plan efectivo (con todas las modificaciones de Hugo ya aplicadas) se
 * calcula en el momento de generar — nunca puede quedar una modificacion
 * "pendiente" sin reflejarse, porque no existe un plan cacheado aparte.
 *
 * El archivo Markdown se escribe ANTES de tocar `state.actions`: si la
 * escritura falla, la mutacion completa se descarta (ver StateStore.mutate)
 * y no queda ningun registro de accion sin su paquete correspondiente.
 */
export async function generateExecutionPackage(
  state: CommandCenterState,
  decisionId: string,
  actionsDir: string,
  override?: VerificationOverride
): Promise<GeneratePackageResult> {
  const d = findDecision(state, decisionId);
  if (d.state !== "aceptada" && d.state !== "modificada") {
    throw new Error(
      `No se puede generar un paquete de ejecucion desde el estado "${d.state}". La decision debe estar aceptada o modificada primero.`
    );
  }

  const verification: VerificationCriteria = {
    ...d.verification,
    ...(override?.expectedPrNumber !== undefined ? { expectedPrNumber: override.expectedPrNumber } : {}),
    ...(override?.expectedBranch !== undefined ? { expectedBranch: override.expectedBranch } : {}),
    ...(override?.expectedCommitShort !== undefined ? { expectedCommitShort: override.expectedCommitShort } : {}),
  };

  if (
    verification.expectedRepo !== null &&
    GITHUB_SCOPED_STATES.includes(verification.requiredState) &&
    verification.expectedPrNumber === undefined &&
    verification.expectedCommitShort === undefined
  ) {
    throw new Error(
      "Esta decision afecta a mas de un PR/commit posible: hay que indicar expectedPrNumber (o expectedCommitShort) al generar el paquete para que la evidencia quede vinculada a un objetivo concreto."
    );
  }

  const effective = computeEffectivePlan(d);
  const ts = nowIso();
  const actionId = newId("act");

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
    ts
  );

  const fileName = `${ts.replace(/[:.]/g, "-")}_${slugify(d.question)}_${actionId}.md`;
  const fullPath = path.join(actionsDir, fileName);
  await fs.mkdir(actionsDir, { recursive: true });
  await fs.writeFile(fullPath, markdown, "utf8");
  const packagePath = path.relative(path.join(actionsDir, ".."), fullPath).split(path.sep).join("/");

  // Solo tras escribir el archivo con exito se registra la accion en el estado.
  const action: ActionRecord = {
    id: actionId,
    decisionId,
    createdAt: ts,
    updatedAt: ts,
    packagePath,
    status: "generada",
    verification,
    evidence: [],
    history: [{ id: newId("hist"), ts, actor: "hugo", action: "generated", detail: "Paquete de ejecucion generado." }],
  };
  state.actions.push(action);
  d.actionIds.push(action.id);

  markReadyForExecution(state, decisionId);

  return { action, packagePath };
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

/**
 * Marca una accion como completada UNICAMENTE si existe al menos
 * `verification.minEvidence` evidencia(s) que coincidan exactamente con los
 * criterios declarados de la accion (repositorio, PR, estado y tipo) — ver
 * `verification.ts::evidenceSatisfies`. Un PR abierto no satisface
 * "pr_merged"; un comentario no satisface "thread_resolved"; evidencia de
 * otro repositorio u otro PR nunca cuenta, aunque este "verificada contra
 * GitHub" en general.
 */
export function completeActionIfVerified(state: CommandCenterState, actionId: string, summary: string): ActionRecord {
  const action = findAction(state, actionId);
  const satisfying = countSatisfyingEvidence(action.evidence, action.verification);
  if (satisfying < action.verification.minEvidence) {
    throw new Error(
      `No se puede completar: la evidencia registrada no cumple los criterios de esta accion (${describeCriteria(action.verification)}). ` +
        `Evidencia que coincide: ${satisfying}/${action.verification.minEvidence} requerida(s).`
    );
  }
  action.status = "completada";
  action.updatedAt = nowIso();
  action.history.push({
    id: newId("hist"),
    ts: action.updatedAt,
    actor: "sistema",
    action: "completed",
    detail: `Completada con ${satisfying} evidencia(s) que cumplen los criterios declarados. ${summary}`,
  });
  markCompleted(state, action.decisionId, summary);
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
