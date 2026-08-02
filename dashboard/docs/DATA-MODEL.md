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

`ExecutionPlan` es lo que se muestra en "Ver plan de ejecución" y lo que se
vuelca al paquete Markdown: `objetivo, pasos[], responsable, fuente,
validaciones[], riesgos[], revertir, evidenciaEsperada[]`.

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
  verifiedAgainstGithub: boolean   // clave: solo esto permite completar
}
```

`completeActionIfVerified` (en `actions.ts`) revisa
`evidence.some(e => e.verifiedAgainstGithub)` y lanza si no hay ninguna — es
la regla que impide que la app "finja" una ejecución.

## AuditEntry

Registro append-only de cada mutación (quién, qué, cuándo, sobre qué
decisión/acción). Se expone en `/api/audit` y en la sección "Auditoría" del
frontend.

## Por qué no se guardan secretos

Ningún campo del modelo admite tokens, claves ni contenido de `.env`. La
integración de GitHub nunca persiste credenciales — usa la sesión de `gh CLI`
del sistema operativo en cada llamada.
