import { getAuthStatus, getPullRequest, listPullRequests, type PullRequestSummary } from "./github.js";

export type SourceType = "github_live" | "manual" | "documental" | "no_disponible";

export interface ProgressInfo {
  percent: number | null;
  criteria: string;
  sourceType: SourceType;
}

export interface FrontSnapshot {
  id: "teacher-os" | "sase-zero" | "nuevo-horizonte";
  name: string;
  purpose: string;
  progress: ProgressInfo;
  completed: string[];
  inProgress: string[];
  blocked: string[];
  nextSteps: string[];
  canonicalSource: { label: string; sourceType: SourceType; lastUpdated: string };
  githubRepo: string | null;
  githubPRs: PullRequestSummary[] | null;
  githubError: string | null;
}

export async function getTeacherOsFront(): Promise<FrontSnapshot> {
  return {
    id: "teacher-os",
    name: "Teacher OS",
    purpose: "Sistema operativo docente de Hugo para planeación, diagnóstico y memoria pedagógica.",
    progress: {
      percent: null,
      criteria:
        "n/d — sin definición de terminado aprobada (R-04 en RIESGOS.md). No se calcula porcentaje hasta que exista un criterio de cierre confirmado por Hugo.",
      sourceType: "no_disponible",
    },
    completed: [
      "Memoria de continuidad pedagógica 3°A / 3°B terminada",
      "RC1 — Programa Analítico 2° declarado canónico (27-jul-2026)",
      "Protocolo diagnóstico 2°A/2°B terminado a nivel documental",
      "Biblioteca oficial de referencia establecida",
    ],
    inProgress: [
      "Sustituir Programa_Sintetico_Fase_6.pdf (texto plano disfrazado de PDF, no el original de la SEP)",
    ],
    blocked: ["Planeación anual / semanal, hasta conseguir el PDF auténtico del folio 58"],
    nextSteps: [
      "Conseguir y subir el PDF auténtico del Programa Sintético Fase 6",
      "Auditar Drive antes de redactar la definición de terminado (ver panel de decisiones)",
      "Evaluar integración con iDoceo y operación diaria",
    ],
    canonicalSource: {
      label: "G:\\Mi unidad\\TEACHER OS HUGO — CICLO 2026-2027 (Google Drive)",
      sourceType: "manual",
      lastUpdated: "2026-07-31",
    },
    githubRepo: null,
    githubPRs: null,
    githubError: "Teacher OS vive en Drive, no en un repositorio — sin conexión automática en esta fase.",
  };
}

export async function getSaseZeroFront(): Promise<FrontSnapshot> {
  let githubPRs: PullRequestSummary[] | null = null;
  let githubError: string | null = null;
  try {
    const auth = await getAuthStatus();
    if (!auth.available) {
      githubError = auth.detail;
    } else {
      githubPRs = await listPullRequests("cyberbod2025/SASE-ZERO");
    }
  } catch (err) {
    githubError = err instanceof Error ? err.message : "conexión no disponible";
  }

  return {
    id: "sase-zero",
    name: "SASE Zero",
    purpose: "Sistema de gestión escolar — arquitectura y documentación completas, implementación de producto todavía sin iniciar.",
    progress: {
      percent: null,
      criteria:
        "n/d — sin definición de terminado aprobada (R-04). La fase actual es solo arquitectura y documentación, no implementación de producto.",
      sourceType: "no_disponible",
    },
    completed: [
      "Arquitectura funcional y técnica documentada",
      "Módulos, dominios, roles y flujos definidos",
      "RLS: revocado ALL, dejado solo SELECT (commit a60c003)",
    ],
    inProgress: ["Cerrar decisiones de arquitectura restantes antes de escribir módulos grandes de código"],
    blocked: [
      "Proyecto Supabase propietario vive en otra cuenta de Hugo — no verificable desde la cuenta conectada",
    ],
    nextSteps: [
      "Obtener acceso verificable al proyecto Supabase propietario",
      "Auditar conectividad, RLS, políticas y dependencias de despliegue una vez haya acceso",
    ],
    canonicalSource: {
      label: "Projects/SASE-ZERO (repo local) · rama feat/vertical-slice — Supabase: acceso no verificable, RLS y políticas pendientes de auditar; clave publishable con riesgo residual aceptado (R-13)",
      sourceType: "documental",
      lastUpdated: "2026-08-02",
    },
    githubRepo: "cyberbod2025/SASE-ZERO",
    githubPRs,
    githubError,
  };
}

export async function getNuevoHorizonteFront(): Promise<FrontSnapshot> {
  let githubPRs: PullRequestSummary[] | null = null;
  let githubError: string | null = null;
  let pr10Blocked = true;
  let pr10Note = "PR #10 no consultado (sin conexión) — se asume bloqueante por ESTADO.md.";

  try {
    const auth = await getAuthStatus();
    if (!auth.available) {
      githubError = auth.detail;
    } else {
      githubPRs = await listPullRequests("cyberbod2025/NUEVO-HORIZONTE");
      const pr10 = githubPRs.find((p) => p.number === 10);
      if (pr10) {
        const detail = await getPullRequest("cyberbod2025/NUEVO-HORIZONTE", 10);
        const openThreads = detail.reviewThreads.filter((t) => !t.isResolved).length;
        pr10Blocked = detail.state === "OPEN";
        pr10Note = detail.state === "OPEN"
          ? `PR #10 abierto — ${openThreads} hilo(s) de revisión sin resolver.`
          : `PR #10 en estado ${detail.state}.`;
      } else {
        pr10Blocked = false;
        pr10Note = "PR #10 no encontrado en la lista actual (puede haberse cerrado o fusionado).";
      }
    }
  } catch (err) {
    githubError = err instanceof Error ? err.message : "conexión no disponible";
  }

  return {
    id: "nuevo-horizonte",
    name: "Nuevo Horizonte",
    purpose: "Academia de código interactiva. Un solo frente: Nuevo Horizonte = Proyecto Horizonte = CodeBrain DevAcademy (nombres históricos, D-009).",
    progress: {
      percent: 75,
      criteria:
        "Estimación manual: 9 de 12 módulos migrados a lecciones v2 (9÷12), según D-005/D-009 a D-012 en DECISIONES.md. No pondera la calidad de los evaluadores — " + pr10Note,
      sourceType: githubError ? "manual" : "github_live",
    },
    completed: [
      "9 de 12 módulos migrados al contrato v2 (27 lecciones)",
      "Módulo 9 (prompts, RAG, límites de API LLM simulados) — commit d75cae0, PR #9 mergeado",
    ],
    inProgress: [],
    blocked: pr10Blocked ? ["Migración de módulos 10–12 en pausa hasta cerrar PR #10"] : [],
    nextSteps: [
      "Corregir el hallazgo P2 de RAG en src/data/lessonReviewFixes.ts",
      "Ejecutar npx tsc --noEmit, npm test, npm run build",
      "Solicitar de nuevo @codex review",
      "Fusionar PR #10 solo sin hallazgos accionables y con las tres verificaciones en verde",
      "Retomar la migración del módulo 10",
    ],
    canonicalSource: {
      label: "github.com/cyberbod2025/NUEVO-HORIZONTE, rama main",
      sourceType: githubError ? "manual" : "github_live",
      lastUpdated: "2026-08-02",
    },
    githubRepo: "cyberbod2025/NUEVO-HORIZONTE",
    githubPRs,
    githubError,
  };
}
