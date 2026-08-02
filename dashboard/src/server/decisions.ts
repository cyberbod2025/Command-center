import { newId, nowIso } from "./ids.js";
import type {
  CommandCenterState,
  Decision,
  DecisionState,
  Modification,
  Postponement,
} from "./types.js";

export class DecisionNotFoundError extends Error {
  constructor(id: string) {
    super(`Decision no encontrada: ${id}`);
    this.name = "DecisionNotFoundError";
  }
}

export class InvalidTransitionError extends Error {
  constructor(from: DecisionState, to: DecisionState) {
    super(`Transicion no permitida: ${from} -> ${to}`);
    this.name = "InvalidTransitionError";
  }
}

const ALLOWED_NEXT: Record<DecisionState, DecisionState[]> = {
  propuesta: ["en_analisis", "aceptada", "modificada", "rechazada", "pospuesta", "cancelada"],
  en_analisis: ["aceptada", "modificada", "rechazada", "pospuesta", "cancelada"],
  aceptada: ["lista_para_ejecucion", "modificada", "rechazada", "pospuesta", "cancelada"],
  modificada: ["lista_para_ejecucion", "aceptada", "rechazada", "pospuesta", "cancelada"],
  rechazada: ["en_analisis"],
  pospuesta: ["propuesta", "en_analisis", "aceptada", "modificada", "rechazada", "cancelada"],
  lista_para_ejecucion: ["enviada", "cancelada", "pospuesta"],
  enviada: ["en_ejecucion", "bloqueada", "cancelada"],
  en_ejecucion: ["bloqueada", "completada", "fallida"],
  bloqueada: ["en_ejecucion", "cancelada", "pospuesta", "propuesta"],
  completada: [],
  fallida: ["en_analisis", "cancelada"],
  cancelada: [],
};

function findDecision(state: CommandCenterState, id: string): Decision {
  const d = state.decisions.find((x) => x.id === id);
  if (!d) throw new DecisionNotFoundError(id);
  return d;
}

function transition(d: Decision, to: DecisionState, actor: "hugo" | "sistema", action: string, detail: string): void {
  const allowed = ALLOWED_NEXT[d.state] ?? [];
  if (!allowed.includes(to) && d.state !== to) {
    throw new InvalidTransitionError(d.state, to);
  }
  d.state = to;
  d.updatedAt = nowIso();
  d.history.push({ id: newId("hist"), ts: d.updatedAt, actor, action, detail });
}

export function acceptDecision(state: CommandCenterState, id: string): Decision {
  const d = findDecision(state, id);
  transition(d, "aceptada", "hugo", "accepted", "Sugerencia aceptada tal cual. Pendiente de generar paquete de ejecucion.");
  return d;
}

export function rejectDecision(state: CommandCenterState, id: string, reason?: string): Decision {
  const d = findDecision(state, id);
  d.rejectionReason = reason?.trim() || undefined;
  transition(
    d,
    "rechazada",
    "hugo",
    "rejected",
    reason?.trim() ? `Rechazada. Motivo: ${reason.trim()}` : "Rechazada sin motivo registrado."
  );
  return d;
}

export function reopenForAnalysis(state: CommandCenterState, id: string, note: string): Decision {
  const d = findDecision(state, id);
  transition(d, "en_analisis", "hugo", "reopened", note);
  return d;
}

export interface ModifyInput {
  alcance?: string;
  prioridad?: string;
  condiciones?: string;
  orden?: string;
  restricciones?: string;
  resultadoEsperado?: string;
}

export function modifyDecision(state: CommandCenterState, id: string, input: ModifyInput): Decision {
  const d = findDecision(state, id);
  const filledKeys = (Object.keys(input) as (keyof ModifyInput)[]).filter((k) => input[k]?.trim());
  if (!filledKeys.length) {
    throw new Error("La modificacion debe incluir al menos un campo no vacio.");
  }
  const mod: Modification = { id: newId("mod"), ts: nowIso(), ...input };
  d.modifications.push(mod);
  transition(
    d,
    "modificada",
    "hugo",
    "modified",
    `Modificada por Hugo: ${filledKeys.map((k) => `${k}="${input[k]}"`).join(", ")}`
  );
  return d;
}

export function addQuestion(
  state: CommandCenterState,
  id: string,
  question: string,
  answer: string,
  source: "contexto_disponible" | "prototipo"
): Decision {
  const d = findDecision(state, id);
  d.questions.push({ id: newId("qa"), ts: nowIso(), question, answer, source });
  d.updatedAt = nowIso();
  d.history.push({
    id: newId("hist"),
    ts: d.updatedAt,
    actor: "hugo",
    action: "question",
    detail: `Pregunta: "${question}"`,
  });
  return d;
}

export function addProposal(state: CommandCenterState, id: string, text: string): Decision {
  const d = findDecision(state, id);
  if (!text.trim()) throw new Error("La propuesta no puede estar vacia.");
  d.proposals.push({ id: newId("prop"), ts: nowIso(), text: text.trim() });
  const nextState: DecisionState = d.state === "propuesta" || d.state === "pospuesta" ? "en_analisis" : d.state;
  if (nextState !== d.state) {
    transition(d, nextState, "hugo", "proposal", `Hugo escribio una propuesta propia: "${text.trim()}"`);
  } else {
    d.updatedAt = nowIso();
    d.history.push({
      id: newId("hist"),
      ts: d.updatedAt,
      actor: "hugo",
      action: "proposal",
      detail: `Hugo escribio una propuesta propia: "${text.trim()}"`,
    });
  }
  return d;
}

export interface PostponeInput {
  reason: Postponement["reason"];
  detail?: string;
  targetDate?: string;
}

export function postponeDecision(state: CommandCenterState, id: string, input: PostponeInput): Decision {
  const d = findDecision(state, id);
  const p: Postponement = { id: newId("postp"), ts: nowIso(), ...input };
  d.postponements.push(p);
  const labelMap: Record<Postponement["reason"], string> = {
    mas_tarde: "mas tarde",
    despues_de_otro_pr: "despues de cerrar otro PR",
    cuando_exista_acceso: "cuando exista acceso",
    fecha_aproximada: `fecha aproximada${input.targetDate ? ` (${input.targetDate})` : ""}`,
    condicion: `condicion necesaria${input.detail ? `: ${input.detail}` : ""}`,
  };
  transition(d, "pospuesta", "hugo", "postponed", `Pospuesta: ${labelMap[input.reason]}`);
  return d;
}

export function markReadyForExecution(state: CommandCenterState, id: string): Decision {
  const d = findDecision(state, id);
  transition(d, "lista_para_ejecucion", "hugo", "ready_for_execution", "Paquete de ejecucion generado; lista para enviarse a un agente.");
  return d;
}

export function markSent(state: CommandCenterState, id: string): Decision {
  const d = findDecision(state, id);
  transition(d, "enviada", "hugo", "sent", "Paquete registrado como enviado a un agente.");
  return d;
}

export function markInExecution(state: CommandCenterState, id: string): Decision {
  const d = findDecision(state, id);
  transition(d, "en_ejecucion", "sistema", "in_execution", "Evidencia parcial detectada; accion en ejecucion.");
  return d;
}

export function markBlocked(state: CommandCenterState, id: string, detail: string): Decision {
  const d = findDecision(state, id);
  transition(d, "bloqueada", "sistema", "blocked", detail);
  return d;
}

export function markCompleted(state: CommandCenterState, id: string, evidenceSummary: string): Decision {
  const d = findDecision(state, id);
  transition(d, "completada", "sistema", "completed", `Completada con evidencia verificada: ${evidenceSummary}`);
  return d;
}

export function markFailed(state: CommandCenterState, id: string, detail: string): Decision {
  const d = findDecision(state, id);
  transition(d, "fallida", "sistema", "failed", detail);
  return d;
}

export function markCancelled(state: CommandCenterState, id: string, detail: string): Decision {
  const d = findDecision(state, id);
  transition(d, "cancelada", "hugo", "cancelled", detail);
  return d;
}

export { findDecision };
