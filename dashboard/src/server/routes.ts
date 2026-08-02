import { Router } from "express";
import type { StateStore } from "./state.js";
import {
  ALLOWED_REPOS,
  getAuthStatus,
  getPullRequest,
  isAllowedRepo,
  listPullRequests,
  postPullRequestComment,
  RepoNotAllowedError,
} from "./github.js";
import {
  acceptDecision,
  addProposal,
  addQuestion,
  DecisionNotFoundError,
  InvalidTransitionError,
  modifyDecision,
  postponeDecision,
  rejectDecision,
} from "./decisions.js";
import { QUICK_QUESTIONS, answerQuickQuestion } from "./qa.js";
import {
  ActionNotFoundError,
  ActionNotWritableError,
  addActionEvidence,
  assertCanPublishComment,
  completeActionIfVerified,
  findAction,
  generateExecutionPackage,
  markActionSent,
} from "./actions.js";
import { assertRequestMatchesCriteria, EvidenceMismatchError } from "./verification.js";
import { recordAudit } from "./audit.js";
import { getSaseZeroFront, getTeacherOsFront, getNuevoHorizonteFront } from "./fronts.js";
import path from "node:path";
import { promises as fsPromises } from "node:fs";

export function buildRouter(store: StateStore, actionsDir: string): Router {
  const router = Router();

  function handleError(res: import("express").Response, err: unknown): void {
    if (err instanceof DecisionNotFoundError || err instanceof ActionNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    if (
      err instanceof InvalidTransitionError ||
      err instanceof RepoNotAllowedError ||
      err instanceof EvidenceMismatchError ||
      err instanceof ActionNotWritableError
    ) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (err instanceof Error) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: "Error desconocido" });
  }

  // ---------------- Fronts ----------------
  router.get("/fronts", async (_req, res) => {
    const [teacherOs, saseZero, nuevoHorizonte] = await Promise.all([
      getTeacherOsFront(),
      getSaseZeroFront(),
      getNuevoHorizonteFront(),
    ]);
    res.json({ teacherOs, saseZero, nuevoHorizonte });
  });

  // ---------------- GitHub (read-only) ----------------
  router.get("/github/status", async (_req, res) => {
    const status = await getAuthStatus();
    res.json({ ...status, allowedRepos: ALLOWED_REPOS });
  });

  router.get("/github/prs", async (req, res) => {
    const repo = String(req.query.repo || "");
    if (!isAllowedRepo(repo)) {
      res.status(400).json({ error: `Repositorio no permitido: ${repo}` });
      return;
    }
    try {
      const prs = await listPullRequests(repo);
      res.json({ repo, prs });
    } catch (err) {
      res.status(503).json({ error: err instanceof Error ? err.message : "conexión no disponible" });
    }
  });

  router.get("/github/pr", async (req, res) => {
    const repo = String(req.query.repo || "");
    const number = Number(req.query.number);
    if (!isAllowedRepo(repo)) {
      res.status(400).json({ error: `Repositorio no permitido: ${repo}` });
      return;
    }
    if (!Number.isInteger(number) || number <= 0) {
      res.status(400).json({ error: "Numero de PR invalido" });
      return;
    }
    try {
      const pr = await getPullRequest(repo, number);
      res.json({ pr });
    } catch (err) {
      res.status(503).json({ error: err instanceof Error ? err.message : "conexión no disponible" });
    }
  });

  // ---------------- Decisions ----------------
  router.get("/decisions", async (_req, res) => {
    const state = await store.load();
    res.json({ decisions: state.decisions });
  });

  router.get("/decisions/:id", async (req, res) => {
    const state = await store.load();
    const d = state.decisions.find((x) => x.id === req.params.id);
    if (!d) {
      res.status(404).json({ error: "Decision no encontrada" });
      return;
    }
    res.json({ decision: d });
  });

  router.post("/decisions/:id/accept", async (req, res) => {
    try {
      const d = await store.mutate((state) => {
        const decision = acceptDecision(state, req.params.id);
        recordAudit(state, { actor: "hugo", category: "decision", action: "accept", detail: `Aceptada: ${decision.question}`, refId: decision.id });
        return decision;
      });
      res.json({ decision: d });
    } catch (err) {
      handleError(res, err);
    }
  });

  router.post("/decisions/:id/reject", async (req, res) => {
    try {
      const reason = typeof req.body?.reason === "string" ? req.body.reason : undefined;
      const d = await store.mutate((state) => {
        const decision = rejectDecision(state, req.params.id, reason);
        recordAudit(state, { actor: "hugo", category: "decision", action: "reject", detail: `Rechazada: ${decision.question}`, refId: decision.id });
        return decision;
      });
      res.json({ decision: d });
    } catch (err) {
      handleError(res, err);
    }
  });

  router.post("/decisions/:id/modify", async (req, res) => {
    try {
      const input = {
        alcance: req.body?.alcance,
        prioridad: req.body?.prioridad,
        condiciones: req.body?.condiciones,
        orden: req.body?.orden,
        restricciones: req.body?.restricciones,
        resultadoEsperado: req.body?.resultadoEsperado,
      };
      const d = await store.mutate((state) => {
        const decision = modifyDecision(state, req.params.id, input);
        recordAudit(state, { actor: "hugo", category: "decision", action: "modify", detail: `Modificada: ${decision.question}`, refId: decision.id });
        return decision;
      });
      res.json({ decision: d });
    } catch (err) {
      handleError(res, err);
    }
  });

  router.get("/decisions/:id/quick-questions", (_req, res) => {
    res.json({ questions: QUICK_QUESTIONS });
  });

  router.post("/decisions/:id/question", async (req, res) => {
    try {
      const question = String(req.body?.question || "").trim();
      if (!question) {
        res.status(400).json({ error: "La pregunta no puede estar vacia" });
        return;
      }
      const d = await store.mutate((state) => {
        const decision = state.decisions.find((x) => x.id === req.params.id);
        if (!decision) throw new DecisionNotFoundError(req.params.id);
        const { answer, source } = answerQuickQuestion(decision, question);
        const updated = addQuestion(state, req.params.id, question, answer, source);
        recordAudit(state, { actor: "hugo", category: "decision", action: "question", detail: question, refId: updated.id });
        return updated;
      });
      res.json({ decision: d });
    } catch (err) {
      handleError(res, err);
    }
  });

  router.post("/decisions/:id/propose", async (req, res) => {
    try {
      const text = String(req.body?.text || "");
      const d = await store.mutate((state) => {
        const decision = addProposal(state, req.params.id, text);
        recordAudit(state, { actor: "hugo", category: "decision", action: "propose", detail: text, refId: decision.id });
        return decision;
      });
      res.json({ decision: d });
    } catch (err) {
      handleError(res, err);
    }
  });

  router.post("/decisions/:id/postpone", async (req, res) => {
    try {
      const input = {
        reason: req.body?.reason,
        detail: req.body?.detail,
        targetDate: req.body?.targetDate,
      };
      const d = await store.mutate((state) => {
        const decision = postponeDecision(state, req.params.id, input);
        recordAudit(state, { actor: "hugo", category: "decision", action: "postpone", detail: `Pospuesta: ${decision.question}`, refId: decision.id });
        return decision;
      });
      res.json({ decision: d });
    } catch (err) {
      handleError(res, err);
    }
  });

  router.get("/decisions/:id/plan", async (req, res) => {
    const state = await store.load();
    const d = state.decisions.find((x) => x.id === req.params.id);
    if (!d) {
      res.status(404).json({ error: "Decision no encontrada" });
      return;
    }
    res.json({ plan: d.plan, decisionState: d.state });
  });

  router.post("/decisions/:id/generate-package", async (req, res) => {
    try {
      const override = {
        expectedPrNumber: req.body?.expectedPrNumber !== undefined ? Number(req.body.expectedPrNumber) : undefined,
        expectedBranch: typeof req.body?.expectedBranch === "string" ? req.body.expectedBranch : undefined,
        expectedCommitShort: typeof req.body?.expectedCommitShort === "string" ? req.body.expectedCommitShort : undefined,
      };
      const result = await store.mutate(async (state) => {
        const r = await generateExecutionPackage(state, req.params.id, actionsDir, override);
        recordAudit(state, {
          actor: "hugo",
          category: "action",
          action: "generate_package",
          detail: `Paquete generado en ${r.packagePath}`,
          refId: r.action.id,
        });
        return r;
      });
      res.json(result);
    } catch (err) {
      handleError(res, err);
    }
  });

  // ---------------- Actions ----------------
  router.get("/actions", async (_req, res) => {
    const state = await store.load();
    res.json({ actions: state.actions });
  });

  router.get("/actions/:id", async (req, res) => {
    const state = await store.load();
    try {
      const a = findAction(state, req.params.id);
      res.json({ action: a });
    } catch (err) {
      handleError(res, err);
    }
  });

  router.get("/actions/:id/package", async (req, res) => {
    const state = await store.load();
    try {
      const a = findAction(state, req.params.id);
      const fullPath = path.join(actionsDir, "..", a.packagePath);
      const content = await fsPromises.readFile(fullPath, "utf8");
      res.type("text/markdown").send(content);
    } catch (err) {
      handleError(res, err);
    }
  });

  router.post("/actions/:id/mark-sent", async (req, res) => {
    try {
      const agent = String(req.body?.agent || "Claude Code");
      const notes = typeof req.body?.notes === "string" ? req.body.notes : undefined;
      const a = await store.mutate((state) => {
        const action = markActionSent(state, req.params.id, agent, notes);
        recordAudit(state, { actor: "hugo", category: "action", action: "mark_sent", detail: `Enviada a ${agent}`, refId: action.id });
        return action;
      });
      res.json({ action: a });
    } catch (err) {
      handleError(res, err);
    }
  });

  router.post("/actions/:id/verify", async (req, res) => {
    const repo = String(req.body?.repo || "");
    const prNumber = Number(req.body?.prNumber);
    if (!isAllowedRepo(repo)) {
      res.status(400).json({ error: `Repositorio no permitido: ${repo}` });
      return;
    }
    if (!Number.isInteger(prNumber) || prNumber <= 0) {
      res.status(400).json({ error: "Numero de PR invalido" });
      return;
    }
    try {
      // Rechaza ANTES de llamar a GitHub si el repo/PR no coinciden con lo
      // que esta accion concreta espera (evita "cualquier PR del mismo
      // repositorio" y "PR de otro proyecto").
      const stateForCheck = await store.load();
      const actionForCheck = findAction(stateForCheck, req.params.id);
      assertRequestMatchesCriteria(actionForCheck.verification, repo, prNumber);

      const pr = await getPullRequest(repo, prNumber);
      const openThreads = pr.reviewThreads.filter((t) => !t.isResolved).length;
      const checksAllGreen = pr.checks.length > 0 && pr.checks.every((c) => c.conclusion === "SUCCESS" || c.conclusion === "success");
      const description =
        `PR #${pr.number} (${repo}) estado=${pr.state}, mergeable=${pr.mergeable ?? "desconocido"}, ` +
        `reviewDecision=${pr.reviewDecision ?? "ninguna"}, hilos abiertos=${openThreads}/${pr.reviewThreads.length}, ` +
        `checks=${pr.checks.map((c) => `${c.name}:${c.conclusion ?? c.status}`).join(", ") || "sin checks"}`;

      const a = await store.mutate((state) => {
        const action = addActionEvidence(state, req.params.id, {
          kind: pr.state === "MERGED" ? "merge" : "pr_updated",
          description,
          url: pr.url,
          verifiedAgainstGithub: true,
          repo,
          prNumber: pr.number,
          prState: pr.state,
          branch: pr.headRefName,
          commitShort: pr.headRefOidShort,
          openThreads,
          totalThreads: pr.reviewThreads.length,
          checksAllGreen,
        });
        recordAudit(state, { actor: "sistema", category: "github_read", action: "verify", detail: description, refId: action.id });
        return action;
      });
      res.json({ action: a, pr });
    } catch (err) {
      handleError(res, err);
    }
  });

  router.post("/actions/:id/evidence/manual", async (req, res) => {
    try {
      const description = String(req.body?.description || "").trim();
      if (!description) {
        res.status(400).json({ error: "La descripcion de evidencia no puede estar vacia" });
        return;
      }
      const a = await store.mutate((state) => {
        const action = addActionEvidence(state, req.params.id, {
          kind: "manual",
          description,
          verifiedAgainstGithub: false,
        });
        recordAudit(state, { actor: "hugo", category: "action", action: "evidence_manual", detail: description, refId: action.id });
        return action;
      });
      res.json({ action: a });
    } catch (err) {
      handleError(res, err);
    }
  });

  router.post("/actions/:id/complete", async (req, res) => {
    try {
      const summary = String(req.body?.summary || "Verificado contra GitHub.");
      const a = await store.mutate((state) => {
        const action = completeActionIfVerified(state, req.params.id, summary);
        recordAudit(state, { actor: "hugo", category: "action", action: "complete", detail: summary, refId: action.id });
        return action;
      });
      res.json({ action: a });
    } catch (err) {
      handleError(res, err);
    }
  });

  router.post("/actions/:id/publish-comment", async (req, res) => {
    const repo = String(req.body?.repo || "");
    const prNumber = Number(req.body?.prNumber);
    const body = String(req.body?.body || "");
    const confirm = req.body?.confirm === true;

    if (!isAllowedRepo(repo)) {
      res.status(400).json({ error: `Repositorio no permitido: ${repo}` });
      return;
    }
    if (!Number.isInteger(prNumber) || prNumber <= 0) {
      res.status(400).json({ error: "Numero de PR invalido" });
      return;
    }
    if (!confirm) {
      res.status(400).json({ error: "Esta accion requiere confirmacion explicita (confirm: true) tras revisar la vista previa." });
      return;
    }

    // Pasos 1-4: la accion existe, su estado lo permite, admite escritura
    // remota, y el repo/PR coinciden con lo que espera — todo ANTES de
    // considerar siquiera llamar a `gh`. Si algo falla aqui, no hay ningun
    // efecto remoto.
    try {
      await store.mutate((state) => {
        assertCanPublishComment(state, req.params.id, repo, prNumber);
      });
    } catch (err) {
      handleError(res, err);
      return;
    }

    const auth = await getAuthStatus();
    if (!auth.available) {
      res.status(503).json({ error: `Accion deshabilitada: ${auth.detail}` });
      return;
    }

    // Paso 5: registrar intencion de auditoria antes de la llamada remota.
    await store.mutate((state) => {
      recordAudit(state, {
        actor: "hugo",
        category: "github_write",
        action: "publish_comment_intent",
        detail: `Intencion de publicar comentario en ${repo}#${prNumber} (accion ${req.params.id})`,
        refId: req.params.id,
      });
    });

    try {
      // Paso 6: publicar.
      const { url } = await postPullRequestComment(repo, prNumber, body);
      const commentIdMatch = url.match(/#(?:issuecomment|discussion_r)-?(\d+)/);
      const commentId = commentIdMatch?.[1];

      // Pasos 7-8: guardar URL/ID como evidencia y registrar el resultado.
      const a = await store.mutate((state) => {
        const action = addActionEvidence(state, req.params.id, {
          kind: "comment",
          description: `Comentario publicado en ${repo}#${prNumber}`,
          url,
          commentUrl: url,
          commentId,
          verifiedAgainstGithub: true,
          repo,
          prNumber,
        });
        recordAudit(state, {
          actor: "hugo",
          category: "github_write",
          action: "publish_comment_result",
          detail: `Comentario publicado en ${repo}#${prNumber}: ${url}`,
          refId: action.id,
        });
        return action;
      });
      res.json({ action: a, url });
    } catch (err) {
      await store.mutate((state) => {
        recordAudit(state, {
          actor: "sistema",
          category: "github_write",
          action: "publish_comment_failed",
          detail: `Fallo al publicar comentario en ${repo}#${prNumber}: ${err instanceof Error ? err.message : "error desconocido"}`,
          refId: req.params.id,
        });
      });
      handleError(res, err);
    }
  });

  // ---------------- Audit ----------------
  router.get("/audit", async (_req, res) => {
    const state = await store.load();
    res.json({ audit: state.audit.slice(-200).reverse() });
  });

  return router;
}

export function actionsDirFromDataDir(dataDir: string): string {
  return path.join(dataDir, "actions");
}
