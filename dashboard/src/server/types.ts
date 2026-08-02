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
  expectedCommitShort?: string;
  requiredState: RequiredEvidenceState;
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
  verification: VerificationCriteria;
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
  commentUrl?: string;
  commentId?: string;
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
