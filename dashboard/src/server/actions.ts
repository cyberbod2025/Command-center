import { promises as fs } from "node:fs";
import path from "node:path";
import { newId, nowIso } from "./ids.js";
import { findDecision, markReadyForExecution, markSent, markCompleted, markFailed } from "./decisions.js";
import type { ActionEvidence, ActionRecord, CommandCenterState } from "./types.js";

export class ActionNotFoundError extends Error {
  constructor(id: string) {
    super(`Accion no encontrada: ${id}`);
    this.name = "ActionNotFoundError";
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

function renderPackageMarkdown(state: CommandCenterState, actionId: string): string {
  const action = findAction(state, actionId);
  const d = findDecision(state, action.decisionId);
  const p = d.plan;
  return `# Paquete de ejecucion — ${d.question}

- **ID de accion:** \`${action.id}\`
- **Decision:** \`${d.id}\`
- **Proyecto:** ${d.project}
- **Generado:** ${action.createdAt}
- **Estado de la decision al generar:** ${d.state}

## Objetivo

${p.objetivo}

## Contexto

${d.problem}

Evidencia disponible en el repositorio:
${d.evidence.map((e) => `- ${e}`).join("\n")}

## Instrucciones

${p.pasos.map((s, i) => `${i + 1}. ${s}`).join("\n")}

**Responsable sugerido:** ${p.responsable}
**Repositorio / fuente:** \`${p.fuente}\`

## Restricciones

- No fusionar ningun PR automaticamente.
- No borrar ramas ni hacer force-push.
- No rotar claves ni tocar Supabase.
- No escribir en Google Drive.
- No ejecutar ninguna accion fuera de las descritas en este paquete.
- Elementos que este paquete puede tocar: ${d.affected.join(", ") || "ninguno declarado"}.

## Validaciones necesarias

${p.validaciones.map((v) => `- ${v}`).join("\n")}

## Evidencia esperada

${p.evidenciaEsperada.map((e) => `- ${e}`).join("\n")}

## Criterio de terminado

Esta accion se considera completada solo cuando la evidencia esperada de arriba
se verifique contra la fuente real (GitHub u otra) descrita en este paquete —
nunca por declaracion sin verificar.

## Plan de reversion

${p.revertir}

## Agente sugerido

Claude Code, en una sesion con acceso al repositorio \`${p.fuente}\`, siguiendo
el gobierno de ramas del portafolio (rama corta, pruebas en verde, PR, revision
de Codex, sin merge automatico).
`;
}

export interface GeneratePackageResult {
  action: ActionRecord;
  packagePath: string;
}

/**
 * Genera un paquete de ejecucion en Markdown para una decision ya aceptada
 * o modificada, y crea el registro de accion correspondiente en la cola.
 * No ejecuta nada por si sola.
 */
export async function generateExecutionPackage(
  state: CommandCenterState,
  decisionId: string,
  actionsDir: string
): Promise<GeneratePackageResult> {
  const d = findDecision(state, decisionId);
  if (d.state !== "aceptada" && d.state !== "modificada") {
    throw new Error(
      `No se puede generar un paquete de ejecucion desde el estado "${d.state}". La decision debe estar aceptada o modificada primero.`
    );
  }

  const ts = nowIso();
  const action: ActionRecord = {
    id: newId("act"),
    decisionId,
    createdAt: ts,
    updatedAt: ts,
    packagePath: "",
    status: "generada",
    evidence: [],
    history: [{ id: newId("hist"), ts, actor: "hugo", action: "generated", detail: "Paquete de ejecucion generado." }],
  };
  state.actions.push(action);
  d.actionIds.push(action.id);

  const fileName = `${ts.replace(/[:.]/g, "-")}_${slugify(d.question)}_${action.id}.md`;
  const fullPath = path.join(actionsDir, fileName);
  const markdown = renderPackageMarkdown(state, action.id);
  await fs.mkdir(actionsDir, { recursive: true });
  await fs.writeFile(fullPath, markdown, "utf8");

  action.packagePath = path.relative(path.join(actionsDir, ".."), fullPath).split(path.sep).join("/");

  markReadyForExecution(state, decisionId);

  return { action, packagePath: action.packagePath };
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
 * Marca una accion como completada UNICAMENTE si tiene al menos una
 * evidencia verificada contra GitHub. Nunca marca completada por
 * declaracion sin evidencia.
 */
export function completeActionIfVerified(state: CommandCenterState, actionId: string, summary: string): ActionRecord {
  const action = findAction(state, actionId);
  const verified = action.evidence.filter((e) => e.verifiedAgainstGithub);
  if (!verified.length) {
    throw new Error("No se puede completar: no hay evidencia verificada contra GitHub para esta accion.");
  }
  action.status = "completada";
  action.updatedAt = nowIso();
  action.history.push({
    id: newId("hist"),
    ts: action.updatedAt,
    actor: "sistema",
    action: "completed",
    detail: `Completada con ${verified.length} evidencia(s) verificada(s). ${summary}`,
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

export { findAction };
