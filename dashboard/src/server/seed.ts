import { newId, nowIso } from "./ids.js";
import type { CommandCenterState, Decision, SCHEMA_VERSION as _v } from "./types.js";
import { SCHEMA_VERSION } from "./types.js";

function baseDecision(partial: Omit<Decision, "id" | "createdAt" | "updatedAt" | "history" | "questions" | "proposals" | "modifications" | "postponements" | "actionIds">): Decision {
  const ts = nowIso();
  return {
    id: newId("dec"),
    createdAt: ts,
    updatedAt: ts,
    history: [],
    questions: [],
    proposals: [],
    modifications: [],
    postponements: [],
    actionIds: [],
    ...partial,
  };
}

/**
 * Estado inicial sembrado la primera vez que se ejecuta la app.
 * Contenido derivado de ESTADO.md / DECISIONES.md / RIESGOS.md del Command Center
 * verificados el 2026-08-02, y de la sesion en la que Hugo acepto el riesgo
 * residual de la clave publishable de SASE Zero.
 */
export function buildSeedState(): CommandCenterState {
  const now = nowIso();

  const prOrder: Decision = baseDecision({
    project: "Command Center",
    question: "Fusionar el PR #2 primero y el PR #3 despues, en ese orden, sin excepcion.",
    problem:
      "El PR #3 (docs/auditoria-clave-supabase) esta apilado sobre la rama del PR #2 (docs/command-center-tres-frentes). Fusionar fuera de orden mezclaria commits de ambas ramas en main.",
    evidence: [
      "gh pr view 2 3 --json baseRefName,headRefName (verificado en vivo)",
      "DECISIONES.md - D-004, gobierno de ramas",
    ],
    confidence: "alta",
    confidenceNote: "verificado directamente con gh pr view, no citado de memoria",
    pros: [
      "Evita mezclar commits de ambas ramas en main",
      "Sigue el gobierno de ramas ya aprobado (D-004)",
    ],
    cons: ["Ninguno identificado - es la unica secuencia consistente con la estructura actual de las ramas"],
    impact: "Desbloquea el cierre limpio de ambos PR sin reescribir historial.",
    urgency: "alta",
    reversibility: "parcial",
    reversibilityNote: "un merge ya hecho no se deshace sin revert; el orden en si no tiene alternativa segura",
    affected: ["Command-center PR #2", "Command-center PR #3", "rama main de Command-center"],
    plan: {
      objetivo: "Fusionar PR #2 y luego PR #3 en el repositorio Command-center",
      pasos: [
        "Confirmar cero hilos de revision abiertos y verificacion en verde en PR #2",
        "Squash/merge PR #2 a main (accion manual de Hugo - esta app no fusiona)",
        "Borrar la rama del PR #2 (accion manual de Hugo)",
        "Verificar PR #3 contra el main actualizado",
        "Squash/merge PR #3 (accion manual de Hugo)",
        "Borrar la rama del PR #3 (accion manual de Hugo)",
      ],
      responsable: "Hugo ejecuta los merges; esta app solo prepara el paquete y verifica evidencia despues",
      fuente: "github.com/cyberbod2025/Command-center",
      validaciones: ["gh pr view --json files,commits antes de cada merge (regla fija #1 de CLAUDE.md)"],
      riesgos: ["Fusionar fuera de orden mezclaria el historial de ambas ramas"],
      revertir: "git revert del commit de squash correspondiente",
      evidenciaEsperada: [
        "gh pr view --json state mostrando MERGED en el orden correcto",
        "git log en main mostrando ambos squashes en orden",
      ],
    },
    // Accion A: cerrar PR #2. Criterios verificables, no prosa: repo+PR exactos,
    // estado fusionado, cero hilos abiertos y revision de Codex detectada.
    verification: {
      project: "Command Center",
      expectedRepo: "cyberbod2025/Command-center",
      allowedEvidenceKinds: ["pr_updated", "merge"],
      expectedPrNumber: 2,
      requiredState: "pr_merged",
      requireZeroOpenThreads: true,
      requireCodexReview: true,
      extraConditions: [],
      minEvidence: 1,
    },
    // Accion B: cerrar PR #3, bloqueada hasta que la Accion A este completada
    // (ver actions.ts::commitPreparedAction / dependsOnActionId). Ademas de
    // repo+PR+estado+hilos+Codex, exige que la base ya apunte a main y una
    // confirmacion manual explicita de que el diff quedo limitado a los
    // cambios propios de la auditoria (no se infiere del texto).
    additionalActionPlan: [
      {
        project: "Command Center",
        expectedRepo: "cyberbod2025/Command-center",
        allowedEvidenceKinds: ["pr_updated", "merge", "manual"],
        expectedPrNumber: 3,
        expectedBaseBranch: "main",
        requiredState: "pr_merged",
        requireZeroOpenThreads: true,
        requireCodexReview: true,
        requiredManualConfirmationTags: ["diff_scope_confirmado"],
        extraConditions: [],
        minEvidence: 1,
      },
    ],
    state: "propuesta",
  });

  const sasePorSupabaseAccess: Decision = baseDecision({
    project: "SASE Zero",
    question: "Registrar la necesidad de recuperar acceso verificable a la cuenta Supabase real de SASE Zero y preparar un plan de auditoria para cuando eso ocurra.",
    problem: "Sin acceso verificable a la cuenta Supabase propietaria, no se puede auditar RLS, politicas ni dependencias reales de SASE Zero.",
    evidence: [
      "RIESGOS.md - R-11",
      "ESTADO.md - fila \"Bloqueador\", columna SASE Zero",
    ],
    confidence: "alta",
    confidenceNote: "confirmado directamente por Hugo en sesiones previas: el backend vive en otra cuenta",
    pros: [
      "Desbloquea auditoria real de RLS y politicas cuando llegue el momento",
      "Deja un plan listo para ejecutar en cuanto exista acceso, sin perder contexto",
    ],
    cons: ["Depende enteramente de que Hugo localice o recupere el acceso - no es accionable por el agente"],
    impact: "Desbloquearia todo el frente SASE Zero mas alla de arquitectura documental.",
    urgency: "baja",
    reversibility: "no_aplica",
    reversibilityNote: "no implica ningun cambio, solo obtencion de acceso - no hay nada que revertir",
    affected: ["Cuenta Supabase propietaria de Hugo (fuera de este repositorio)"],
    plan: {
      objetivo: "Obtener acceso verificable a la cuenta Supabase correcta y auditar",
      pasos: [
        "Hugo comparte acceso o credenciales verificables de la cuenta correcta",
        "Verificar identidad y salud del proyecto",
        "Revisar RLS, politicas y Security Advisor",
        "Inventariar Vercel, GitHub environments, Edge Functions y demas consumidores",
      ],
      responsable: "Hugo comparte acceso; Claude Code ejecuta la auditoria de solo lectura en una sesion con esas credenciales",
      fuente: "Cuenta Supabase de Hugo (externa), SASE-ZERO/app/.env",
      validaciones: ["Confirmar que el proyecto encontrado corresponde realmente a SASE Zero antes de tratarlo como tal (no repetir el error de D-007)"],
      riesgos: ["Ninguno mientras la auditoria sea de solo lectura"],
      revertir: "No aplica - es un paso de verificacion, no de cambio",
      evidenciaEsperada: ["Salida de list_projects / get_advisors de Supabase", "Actualizacion de R-11 en RIESGOS.md y de ESTADO.md"],
    },
    verification: {
      project: "SASE Zero",
      expectedRepo: null,
      allowedEvidenceKinds: ["manual"],
      requiredState: "manual_confirmation",
      extraConditions: [
        "Esta accion es sobre acceso a una cuenta Supabase, no sobre GitHub. No acepta evidencia de PRs, commits ni comentarios.",
        "La confirmacion la registra Hugo manualmente tras verificar el acceso el mismo.",
      ],
      minEvidence: 1,
    },
    state: "bloqueada",
  });
  sasePorSupabaseAccess.history.push({
    id: newId("hist"),
    ts: now,
    actor: "sistema",
    action: "seed",
    detail: "Marcada bloqueada al sembrar el estado inicial: no hay acceso verificable a la cuenta Supabase propietaria (R-11).",
  });

  const saseKeyRisk: Decision = baseDecision({
    project: "SASE Zero",
    question: "No purgar el historial remoto ni rotar la clave publishable todavia; aceptar el riesgo residual temporalmente.",
    problem: "La exposicion historica de la clave sb_publishable se retiro del historial canonico, pero el commit que la contuvo sigue direccionable por SHA en GitHub - persiste un riesgo residual remoto.",
    evidence: [
      "RIESGOS.md - R-13",
      "PR #3 de Command-center - hallazgo P2 de Codex respondido inline y resuelto",
    ],
    confidence: "alta",
    confidenceNote: "decision ya tomada explicitamente por Hugo el 2026-08-02",
    pros: [
      "Evita romper consumidores activos por una rotacion a ciegas",
      "Es clave sb_publishable, no secreta - Supabase la disena para exponerse en cliente",
    ],
    cons: ["El commit historico sigue siendo direccionable por SHA en GitHub mientras no se purgue o rote"],
    impact: "Mantiene SASE Zero operable localmente sin bloquear por un riesgo de severidad baja/media.",
    urgency: "baja",
    reversibility: "reversible",
    reversibilityNote: "se puede rotar o solicitar purga en cualquier momento posterior, sin costo retroactivo",
    affected: ["SASE-ZERO/app/.env (clave local, no se toca)", "Historial remoto de GitHub (commit historico, no se toca)"],
    plan: {
      objetivo: "Accion futura obligatoria cuando se recupere acceso a la cuenta Supabase correcta",
      pasos: [
        "Verificar identidad y salud del proyecto",
        "Revisar RLS, politicas y Security Advisor",
        "Inventariar Vercel, GitHub environments, Edge Functions y demas consumidores",
        "Preparar una rotacion controlada de la clave publishable",
        "Actualizar y probar todos los consumidores",
        "Revocar la clave anterior",
        "Reevaluar si es necesario solicitar a GitHub la purga del commit historico",
      ],
      responsable: "Hugo autoriza cada paso; Claude Code ejecuta y verifica",
      fuente: "RIESGOS.md - R-13, cuenta Supabase propietaria",
      validaciones: ["No ejecutar ningun paso de esta lista hasta tener acceso verificable a la cuenta correcta"],
      riesgos: ["Rotar sin inventariar consumidores podria romper aplicaciones activas"],
      revertir: "No aplica a esta decision - es una aceptacion de riesgo, no un cambio",
      evidenciaEsperada: ["RIESGOS.md R-13 actualizado en cada etapa futura"],
    },
    verification: {
      project: "SASE Zero",
      expectedRepo: null,
      allowedEvidenceKinds: ["manual"],
      requiredState: "manual_confirmation",
      extraConditions: [
        "Aceptacion de riesgo, no accion de GitHub ni de Supabase todavia. La rotacion real es una decision futura distinta.",
      ],
      minEvidence: 1,
    },
    state: "aceptada",
  });
  saseKeyRisk.history.push({
    id: newId("hist"),
    ts: "2026-08-02T00:00:00.000Z",
    actor: "hugo",
    action: "accepted",
    detail: "Hugo acepto el riesgo residual temporalmente: no purgar el historial remoto ni rotar la clave todavia.",
  });

  const teacherOsDrive: Decision = baseDecision({
    project: "Teacher OS",
    question: "Auditar la carpeta de Drive de Teacher OS antes de redactar la definicion de terminado, para no definir un criterio sobre trabajo que no se ha inventariado.",
    problem: "Sin definicion de terminado, R-04 impide reportar cualquier porcentaje de avance real de Teacher OS. Redactar esa definicion sin antes inventariar Drive arriesga repetir el error de D-002 (declarar algo \"no materializado\" sin buscarlo).",
    evidence: [
      "RIESGOS.md - R-04",
      "DECISIONES.md - D-002 corregida el 2026-07-31 (la busqueda original no cubrio Drive)",
      "ESTADO.md - tabla \"Definicion de terminado\", fila Teacher OS vacia",
    ],
    confidence: "media",
    confidenceNote: "propuesta del sistema; requiere que Hugo confirme el criterio final",
    pros: [
      "Evita definir terminado sobre una foto incompleta del trabajo real en Drive",
      "Genera el inventario que D-002 senalo como pendiente y nunca se completo",
    ],
    cons: [
      "Anade un paso antes de poder reportar avance de Teacher OS",
      "Requiere tiempo de Hugo para revisar el inventario resultante",
    ],
    impact: "Desbloquea una definicion de terminado con evidencia real, en vez de una estimacion sin inventario.",
    urgency: "media",
    reversibility: "reversible",
    reversibilityNote: "es un paso de lectura sobre Drive; no modifica nada",
    affected: ["G:\\Mi unidad\\TEACHER OS HUGO - CICLO 2026-2027 (lectura)", "ESTADO.md (tabla Definicion de terminado, tras el inventario)"],
    plan: {
      objetivo: "Inventariar la carpeta de Drive de Teacher OS y luego redactar la definicion de terminado",
      pasos: [
        "Listar el contenido real de la carpeta de Drive (indice documental)",
        "Contrastar contra lo que ESTADO.md da por \"completado\" (memorias 3A/3B, Programa Analitico, protocolo diagnostico)",
        "Redactar con Hugo el alcance minimo por ciclo escolar usando ese inventario",
        "Llenar la fila Teacher OS en la tabla \"Definicion de terminado\" de ESTADO.md",
        "Registrar la decision final en DECISIONES.md",
      ],
      responsable: "Claude Code inventaria y redacta; Hugo aprueba el criterio final antes de escribirlo",
      fuente: "Google Drive (fuera de git), Command-center/ESTADO.md, Command-center/DECISIONES.md",
      validaciones: ["Confirmacion explicita de Hugo del criterio antes de escribirlo (no se infiere)"],
      riesgos: ["Ninguno tecnico - son pasos de lectura y un cambio documental"],
      revertir: "Editar o eliminar la fila en un commit posterior; no afecta nada fuera del documento",
      evidenciaEsperada: ["Indice documental de Drive", "Diff de ESTADO.md", "Nueva entrada en DECISIONES.md"],
    },
    verification: {
      project: "Teacher OS",
      expectedRepo: null,
      allowedEvidenceKinds: ["manual"],
      requiredState: "manual_confirmation",
      extraConditions: [
        "Esta accion es sobre Google Drive, no sobre GitHub. No acepta evidencia de PRs, commits ni comentarios.",
      ],
      minEvidence: 1,
    },
    state: "propuesta",
  });

  const decisions = [prOrder, sasePorSupabaseAccess, saseKeyRisk, teacherOsDrive];

  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    decisions,
    actions: [],
    audit: decisions.map((d) => ({
      id: newId("audit"),
      ts: now,
      actor: "sistema" as const,
      category: "system" as const,
      action: "seed_decision",
      detail: `Decision sembrada: ${d.question}`,
      refId: d.id,
    })),
  };
}
