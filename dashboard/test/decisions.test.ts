import { describe, it, expect, beforeEach } from "vitest";
import {
  acceptDecision,
  rejectDecision,
  modifyDecision,
  postponeDecision,
  addProposal,
  addQuestion,
  InvalidTransitionError,
} from "../src/server/decisions.js";
import { buildSeedState } from "../src/server/seed.js";
import type { CommandCenterState } from "../src/server/types.js";

let state: CommandCenterState;
let decisionId: string;

beforeEach(() => {
  state = buildSeedState();
  // usa una decision en estado "propuesta" para probar el camino feliz
  decisionId = state.decisions.find((d) => d.state === "propuesta")!.id;
});

describe("motor de decisiones", () => {
  it("acepta una decision en propuesta y registra historial", () => {
    const d = acceptDecision(state, decisionId);
    expect(d.state).toBe("aceptada");
    expect(d.history.at(-1)?.action).toBe("accepted");
  });

  it("rechaza con motivo y lo conserva", () => {
    const d = rejectDecision(state, decisionId, "no es prioridad ahora");
    expect(d.state).toBe("rechazada");
    expect(d.rejectionReason).toBe("no es prioridad ahora");
  });

  it("no permite pasar de completada a otro estado", () => {
    const d = state.decisions.find((x) => x.id === decisionId)!;
    d.state = "completada";
    expect(() => acceptDecision(state, decisionId)).toThrow(InvalidTransitionError);
  });

  it("modificar exige al menos un campo no vacio", () => {
    acceptDecision(state, decisionId);
    expect(() => modifyDecision(state, decisionId, {})).toThrow();
    const d = modifyDecision(state, decisionId, { alcance: "solo el modulo 10" });
    expect(d.state).toBe("modificada");
    expect(d.modifications).toHaveLength(1);
  });

  it("posponer registra el motivo y pasa a pospuesta", () => {
    const d = postponeDecision(state, decisionId, { reason: "cuando_exista_acceso" });
    expect(d.state).toBe("pospuesta");
    expect(d.postponements).toHaveLength(1);
  });

  it("una propuesta de Hugo mueve una decision en propuesta a en_analisis", () => {
    const d = addProposal(state, decisionId, "Yo haria esto de otra forma");
    expect(d.state).toBe("en_analisis");
    expect(d.proposals).toHaveLength(1);
  });

  it("las preguntas no cambian el estado pero quedan registradas", () => {
    const before = state.decisions.find((x) => x.id === decisionId)!.state;
    const d = addQuestion(state, decisionId, "¿Se puede revertir?", "respuesta de prueba", "contexto_disponible");
    expect(d.state).toBe(before);
    expect(d.questions).toHaveLength(1);
  });
});
