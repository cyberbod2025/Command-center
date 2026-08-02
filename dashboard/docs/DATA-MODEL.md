# Modelo de datos

Todo el estado vive en `data/command-center-state.json` (`schemaVersion: 1`),
con esta forma:

```ts
CommandCenterState {
  schemaVersion: number
  createdAt, updatedAt: string (ISO)
  decisions: Decision[]
  actions: ActionRecord[]
  audit: AuditEntry[]
}
```

## Decision

Campos obligatorios que pide la tarea (recomendación, problema, evidencia,
confianza, ventajas, riesgos, impacto, urgencia, reversibilidad, proyecto,
elementos afectados, historial, estado) más los sub-registros de cada control:

```ts
Decision {
  id, createdAt, updatedAt
  project: "Teacher OS" | "SASE Zero" | "Nuevo Horizonte" | "Command Center"
  question: string            // la recomendación concreta
  problem: string
  evidence: string[]
  confidence: "alta" | "media" | "baja"
  confidenceNote: string
  pros: string[]
  cons: string[]
  impact: string
  urgency: "alta" | "media" | "baja"
  reversibility: "reversible" | "parcial" | "irreversible" | "no_aplica"
  reversibilityNote: string
  affected: string[]          // archivos / repos / servicios que podría tocar
  plan: ExecutionPlan         // ver abajo
  verification: VerificationCriteria  // ver "Vinculación de evidencia" abajo
  state: DecisionState        // ver máquina de estados
  rejectionReason?: string
  history: HistoryEntry[]
  questions: QaEntry[]        // "hacer una pregunta"
  proposals: Proposal[]       // "escribir mi propuesta"
  modifications: Modification[] // "modificar sugerencia"
  postponements: Postponement[] // "posponer"
  actionIds: string[]         // paquetes generados desde esta decisión
}
```

`ExecutionPlan` es la propuesta ORIGINAL: `objetivo, pasos[], responsable,
fuente, validaciones[], riesgos[], revertir, evidenciaEsperada[]`. No es lo
que se ejecuta si Hugo modificó la decisión — ver "Plan efectivo" abajo.

## Vinculación de evidencia (`VerificationCriteria`)

Cada decisión (y cada `ActionRecord` generado desde ella, que congela una
copia en el momento de generación) declara qué evidencia concreta la cierra:

```ts
VerificationCriteria {
  project: Decision["project"]
  expectedRepo: string | null   // null = no acepta evidencia de GitHub (Drive/Supabase)
  allowedEvidenceKinds: EvidenceKind[]
  expectedPrNumber?: number
  expectedBranch?: string
  expectedCommitShort?: string
  requiredState: "pr_open" | "pr_closed" | "pr_merged" | "comment_published"
               | "thread_resolved" | "checks_green" | "commit_exists"
               | "manual_confirmation"
  extraConditions: string[]
  minEvidence: number
}
```

`verification.ts::evidenceSatisfies(evidencia, criterios)` es la única función
que decide si una evidencia concreta cuenta: compara tipo, repositorio, PR,
rama/commit y el estado exacto exigido — un PR abierto nunca satisface
`pr_merged`, un comentario nunca satisface `thread_resolved`, y evidencia de
un repositorio o PR distinto nunca cuenta, aunque venga marcada
`verifiedAgainstGithub: true`. `assertRequestMatchesCriteria` aplica la misma
comparación de repo/PR *antes* de llamar a GitHub en `/api/actions/:id/verify`,
así que una petición mal dirigida ni siquiera llega a `gh`.

Si `decision.verification.expectedPrNumber` es ambiguo (una decisión que
afecta a más de un PR, como cerrar el PR #2 y luego el #3), generar el
paquete exige pasar `expectedPrNumber` (o `expectedCommitShort`) explícito en
`POST /decisions/:id/generate-package` — no se permite dejarlo abierto a
"cualquier PR del repositorio".

## Plan efectivo (`EffectivePlan`)

`verification.ts::computeEffectivePlan(decision)` recalcula, en cada llamada,
el plan que realmente se va a ejecutar aplicando **todas** las
`modifications` registradas sobre el `ExecutionPlan` base — nunca hay un plan
modificado "cacheado" aparte, así que no puede quedar una modificación sin
reflejarse:

```ts
EffectivePlan {
  objetivo, pasos[], responsable, fuente, validaciones[], riesgos[],
  revertir, evidenciaEsperada[]      // heredados/mezclados del plan base
  prioridad?: string                  // de Modification.prioridad
  restriccionesAdicionales: string[]  // de Modification.restricciones
  resultadoEsperadoFinal?: string     // de Modification.resultadoEsperado
  isModified: boolean
  diffs: { field, original, modified }[]
}
```

El paquete Markdown generado (`actions.ts::renderPackageMarkdown`) incluye,
cuando hay modificaciones, las secciones "Propuesta original",
"Modificaciones aprobadas por Hugo", "Plan efectivo final" y "Diferencias" —
una restricción o condición que Hugo agregó aparece literalmente en el
archivo, dentro de "Restricciones obligatorias" o "Validaciones necesarias".

## Estados de decisión

```
propuesta ⇄ en_analisis → aceptada / modificada → lista_para_ejecucion
   → enviada → en_ejecucion → completada
   (en cualquier punto: rechazada, pospuesta, bloqueada, fallida, cancelada)
```

Las transiciones válidas están codificadas explícitamente en
`decisions.ts::ALLOWED_NEXT` — cualquier transición no listada lanza
`InvalidTransitionError` y la API responde `400`. `completada` y `cancelada`
son terminales (no se derivan por completeActionIfVerified salvo con
evidencia verificada, ver más abajo).

## ActionRecord (cola de acciones)

```ts
ActionRecord {
  id, decisionId, createdAt, updatedAt
  packagePath: string          // ruta relativa dentro de data/
  status: "generada" | "enviada" | "en_ejecucion" | "verificada"
        | "completada" | "fallida" | "cancelada"
  verification: VerificationCriteria   // copia congelada al generar el paquete
  sentTo?: { ts, agent, notes? }
  evidence: ActionEvidence[]
  history: HistoryEntry[]
}

ActionEvidence {
  id, ts
  kind: "commit" | "pr_updated" | "comment" | "thread_resolved"
      | "check_run" | "merge" | "manual"
  description: string
  url?: string
  verifiedAgainstGithub: boolean
  // campos estructurados para cotejar contra VerificationCriteria:
  repo?: string
  prNumber?: number
  prState?: "OPEN" | "CLOSED" | "MERGED"
  branch?: string
  commitShort?: string
  openThreads?: number
  totalThreads?: number
  checksAllGreen?: boolean
  commentUrl?: string
  commentId?: string
}
```

`completeActionIfVerified` (en `actions.ts`) cuenta cuántas evidencias
satisfacen exactamente `action.verification` (ver
`verification.ts::countSatisfyingEvidence`) y lanza si el total es menor que
`verification.minEvidence` — es la regla que impide que la app "finja" una
ejecución, y que impide que evidencia genérica ("alguna cosa se verificó
contra GitHub") cierre una acción que exige un PR, repo o estado concretos.

## AuditEntry

Registro append-only de cada mutación (quién, qué, cuándo, sobre qué
decisión/acción). Se expone en `/api/audit` y en la sección "Auditoría" del
frontend.

## Por qué no se guardan secretos

Ningún campo del modelo admite tokens, claves ni contenido de `.env`. La
integración de GitHub nunca persiste credenciales — usa la sesión de `gh CLI`
del sistema operativo en cada llamada.
