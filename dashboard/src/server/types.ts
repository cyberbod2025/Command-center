export const SCHEMA_VERSION = 1;

export type DecisionState =
  | "propuesta"
  | "en_analisis"
  | "aceptada"
  | "modificada"
  | "rechazada"
  | "pospuesta"
  | "lista_para_ejecucion"
  | "enviada"
  | "en_ejecucion"
  | "bloqueada"
  | "completada"
  | "fallida"
  | "cancelada";

export type Confidence = "alta" | "media" | "baja";
export type Urgency = "alta" | "media" | "baja";
export type Reversibility = "reversible" | "parcial" | "irreversible" | "no_aplica";

export interface HistoryEntry {
  id: string;
  ts: string;
  actor: "hugo" | "sistema";
  action: string;
  detail: string;
}

export interface QaEntry {
  id: string;
  ts: string;
  question: string;
  answer: string;
  source: "contexto_disponible" | "prototipo";
}

export interface Proposal {
  id: string;
  ts: string;
  text: string;
}

export interface Modification {
  id: string;
  ts: string;
  alcance?: string;
  prioridad?: string;
  condiciones?: string;
  orden?: string;
  restricciones?: string;
  resultadoEsperado?: string;
}

export interface Postponement {
  id: string;
  ts: string;
  reason: "mas_tarde" | "despues_de_otro_pr" | "cuando_exista_acceso" | "fecha_aproximada" | "condicion";
  detail?: string;
  targetDate?: string;
}

export interface ExecutionPlan {
  objetivo: string;
  pasos: string[];
  responsable: string;
  fuente: string;
  validaciones: string[];
  riesgos: string[];
  revertir: string;
  evidenciaEsperada: string[];
}

export type EvidenceKind = "commit" | "pr_updated" | "comment" | "thread_resolved" | "check_run" | "merge" | "manual";

export type RequiredEvidenceState =
  | "pr_open"
  | "pr_closed"
  | "pr_merged"
  | "comment_published"
  | "thread_resolved"
  | "checks_green"
  | "commit_exists"
  | "manual_confirmation";

/**
 * Criterios estructurados que definen QUE evidencia concreta cierra una
 * accion. `expectedRepo: null` significa "esta accion no acepta evidencia
 * de GitHub" (p. ej. decisiones sobre Drive o Supabase) — solo evidencia
 * `manual` puede satisfacerla.
 */
export interface VerificationCriteria {
  project: Decision["project"];
  expectedRepo: string | null;
  allowedEvidenceKinds: EvidenceKind[];
  expectedPrNumber?: number;
  expectedBranch?: string;
  /** Rama base requerida del PR (p. ej. "main"), distinta de expectedBranch (rama head). */
  expectedBaseBranch?: string;
  expectedCommitShort?: string;
  requiredState: RequiredEvidenceState;
  /** Exige openThreads === 0 en la evidencia para contar. */
  requireZeroOpenThreads?: boolean;
  /** Exige que exista una revision de Codex detectada sobre el commit evaluado. */
  requireCodexReview?: boolean;
  /**
   * Etiquetas de confirmacion manual que deben existir ademas de la
   * evidencia principal (p. ej. "diff_scope_confirmado"). Cada etiqueta debe
   * tener al menos una ActionEvidence con kind="manual" y ese
   * confirmationTag — no cuenta hacia minEvidence, es un requisito aparte.
   */
  requiredManualConfirmationTags?: string[];
  /** Contexto informativo para humanos — NUNCA se evalua para decidir si una accion se completa. */
  extraConditions: string[];
  minEvidence: number;
}

export interface Decision {
  id: string;
  createdAt: string;
  updatedAt: string;
  project: "Teacher OS" | "SASE Zero" | "Nuevo Horizonte" | "Command Center";
  question: string;
  problem: string;
  evidence: string[];
  confidence: Confidence;
  confidenceNote: string;
  pros: string[];
  cons: string[];
  impact: string;
  urgency: Urgency;
  reversibility: Reversibility;
  reversibilityNote: string;
  affected: string[];
  plan: ExecutionPlan;
  /** Criterios de la PRIMERA (o unica) accion generada desde esta decision. */
  verification: VerificationCriteria;
  /**
   * Cuando una decision requiere MAS de un resultado verificable en orden
   * (p. ej. cerrar PR #2 y luego PR #3), cada entrada describe la accion
   * dependiente siguiente. La accion N+1 no puede generarse hasta que la
   * accion N este completada, y la decision solo se marca completada cuando
   * TODAS las acciones (la de `verification` + cada una de esta lista)
   * estan completadas, en orden.
   */
  additionalActionPlan?: VerificationCriteria[];
  state: DecisionState;
  rejectionReason?: string;
  history: HistoryEntry[];
  questions: QaEntry[];
  proposals: Proposal[];
  modifications: Modification[];
  postponements: Postponement[];
  actionIds: string[];
}

export type ActionStatus =
  | "generada"
  | "enviada"
  | "en_ejecucion"
  | "verificada"
  | "completada"
  | "fallida"
  | "cancelada";

export interface ActionEvidence {
  id: string;
  ts: string;
  kind: EvidenceKind;
  description: string;
  url?: string;
  verifiedAgainstGithub: boolean;
  /** Datos estructurados para poder cotejar la evidencia contra VerificationCriteria. */
  repo?: string;
  prNumber?: number;
  prState?: "OPEN" | "CLOSED" | "MERGED";
  branch?: string;
  commitShort?: string;
  openThreads?: number;
  totalThreads?: number;
  checksAllGreen?: boolean;
  baseBranch?: string;
  codexReviewFound?: boolean;
  commentUrl?: string;
  commentId?: string;
  /** Vincula esta evidencia manual a un VerificationCriteria.requiredManualConfirmationTags. */
  confirmationTag?: string;
  // Campos de evidencia manual (Teacher OS / Supabase / otras fuentes sin GitHub):
  evidenceType?: string;
  source?: string;
  occurredAt?: string;
  responsible?: string;
  reference?: string;
  notes?: string;
}

export interface ActionRecord {
  id: string;
  decisionId: string;
  createdAt: string;
  updatedAt: string;
  packagePath: string;
  status: ActionStatus;
  /** Copia congelada de los criterios de la decision en el momento de generar el paquete. */
  verification: VerificationCriteria;
  /** Si esta definido, esta accion no puede completarse hasta que la accion referida este "completada". */
  dependsOnActionId?: string;
  /** Posicion (0-based) de esta accion dentro de la cadena de la decision (verification + additionalActionPlan). */
  chainIndex?: number;
  sentTo?: {
    ts: string;
    agent: string;
    notes?: string;
  };
  evidence: ActionEvidence[];
  history: HistoryEntry[];
}

export interface AuditEntry {
  id: string;
  ts: string;
  actor: "hugo" | "sistema";
  category: "decision" | "action" | "github_write" | "github_read" | "system";
  action: string;
  detail: string;
  refId?: string;
}

export interface CommandCenterState {
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  decisions: Decision[];
  actions: ActionRecord[];
  audit: AuditEntry[];
}
