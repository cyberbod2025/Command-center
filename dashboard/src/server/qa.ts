import type { Decision } from "./types.js";

export const QUICK_QUESTIONS = [
  "¿Por qué recomiendas esto?",
  "¿Qué riesgo existe si no lo hago?",
  "¿Qué alternativas hay?",
  "¿Qué información te falta?",
  "¿Qué archivos se modificarían?",
  "¿Esto puede romper algo?",
  "¿Se puede revertir?",
  "¿Qué harías tú y por qué?",
] as const;

const REVERSIBILITY_LABEL: Record<Decision["reversibility"], string> = {
  reversible: "Reversible",
  parcial: "Parcialmente reversible",
  irreversible: "Irreversible",
  no_aplica: "No aplica",
};

/**
 * Respuestas para las preguntas rapidas: se derivan de los campos ya
 * registrados de la decision (evidencia disponible en este repositorio),
 * por lo que se marcan como "contexto_disponible", no como analisis nuevo.
 */
export function answerQuickQuestion(d: Decision, question: string): { answer: string; source: "contexto_disponible" | "prototipo" } {
  switch (question) {
    case "¿Por qué recomiendas esto?":
      return { answer: `${d.problem} Evidencia: ${d.evidence.join("; ")}.`, source: "contexto_disponible" };
    case "¿Qué riesgo existe si no lo hago?":
      return {
        answer: `Si no se actúa: ${d.cons.join("; ")}. Impacto esperado de actuar: ${d.impact}`,
        source: "contexto_disponible",
      };
    case "¿Qué alternativas hay?":
      return {
        answer:
          "Prototipo: no hay alternativas modeladas para esta decisión en el repositorio. Usa 'Escribir mi propuesta' para registrar la tuya.",
        source: "prototipo",
      };
    case "¿Qué información te falta?":
      return {
        answer:
          "Esta app lee GitHub en vivo cuando hay sesión de gh disponible, pero Teacher OS y Supabase siguen siendo fuentes manuales/documentales — cualquier cambio ahí no se refleja hasta actualizarlo a mano.",
        source: "contexto_disponible",
      };
    case "¿Qué archivos se modificarían?":
      return { answer: d.affected.join(", ") + ".", source: "contexto_disponible" };
    case "¿Esto puede romper algo?":
      return {
        answer: `Reversibilidad: ${REVERSIBILITY_LABEL[d.reversibility]} — ${d.reversibilityNote}. Riesgos del plan: ${d.plan.riesgos.join("; ")}.`,
        source: "contexto_disponible",
      };
    case "¿Se puede revertir?":
      return { answer: d.plan.revertir, source: "contexto_disponible" };
    case "¿Qué harías tú y por qué?":
      return {
        answer: `Recomiendo: "${d.question}" — ventajas: ${d.pros.join("; ")}.`,
        source: "contexto_disponible",
      };
    default:
      return {
        answer:
          "Respuesta simulada — prototipo, no hay modelo conectado en esta vista. Formula la pregunta directamente a Claude Code en una sesión de trabajo para una respuesta real.",
        source: "prototipo",
      };
  }
}
