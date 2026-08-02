(() => {
  "use strict";

  const STATE_LABEL = {
    propuesta: "Propuesta", en_analisis: "En análisis", aceptada: "Aceptada",
    modificada: "Modificada", rechazada: "Rechazada", pospuesta: "Pospuesta",
    lista_para_ejecucion: "Lista para ejecución", enviada: "Enviada",
    en_ejecucion: "En ejecución", bloqueada: "Bloqueada", completada: "Completada",
    fallida: "Fallida", cancelada: "Cancelada",
  };
  const ACTION_STATE_LABEL = {
    generada: "Generada", enviada: "Enviada", en_ejecucion: "En ejecución",
    verificada: "Verificada", completada: "Completada", fallida: "Fallida", cancelada: "Cancelada",
  };
  const ALLOWED_REPOS = ["cyberbod2025/Command-center", "cyberbod2025/NUEVO-HORIZONTE", "cyberbod2025/SASE-ZERO"];

  let cache = { decisions: [], actions: [], ghAvailable: false, filter: "all" };

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function ul(arr) { return "<ul>" + (arr || []).map((x) => `<li>${esc(x)}</li>`).join("") + "</ul>"; }
  function ol(arr) { return "<ol>" + (arr || []).map((x) => `<li>${esc(x)}</li>`).join("") + "</ol>"; }
  function fmtTs(iso) { return iso ? iso.replace("T", " ").slice(0, 16) : "—"; }

  async function api(path, opts) {
    const res = await fetch(`/api${path}`, {
      method: opts?.method || "GET",
      headers: opts?.body ? { "Content-Type": "application/json" } : undefined,
      body: opts?.body ? JSON.stringify(opts.body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
    return data;
  }

  function toast(msg) {
    const root = document.getElementById("toast-root");
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    root.appendChild(t);
    requestAnimationFrame(() => t.classList.add("show"));
    setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 250); }, 4500);
  }

  function openModal(title, bodyHtml, footHtml) {
    document.getElementById("modal-title").textContent = title;
    document.getElementById("modal-body").innerHTML = bodyHtml;
    document.getElementById("modal-foot").innerHTML = footHtml || "";
    document.getElementById("modal-root").classList.add("open");
  }
  function closeModal() { document.getElementById("modal-root").classList.remove("open"); }
  document.getElementById("modal-close").addEventListener("click", closeModal);
  document.getElementById("modal-root").addEventListener("click", (e) => { if (e.target.id === "modal-root") closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

  // ================= GitHub status =================
  async function loadGithubStatus() {
    const el = document.getElementById("gh-status");
    try {
      const s = await api("/github/status");
      cache.ghAvailable = s.available;
      el.className = "gh-pill " + (s.available ? "ok" : "down");
      el.innerHTML = s.available
        ? `<span class="dot" style="background:var(--green)"></span> GitHub conectado (${esc(s.login || "gh")})`
        : `<span class="dot" style="background:var(--red)"></span> conexión no disponible`;
    } catch {
      cache.ghAvailable = false;
      el.className = "gh-pill down";
      el.textContent = "conexión no disponible";
    }
  }

  // ================= Fronts =================
  function progressBarHtml(front) {
    const pct = front.progress.percent;
    const live = front.progress.sourceType === "github_live";
    const manual = front.progress.sourceType === "manual" || front.progress.sourceType === "documental";
    const srcTag = live ? '<span class="src-tag live">vivo</span>' : manual ? '<span class="src-tag manual">manual</span>' : "";
    if (pct === null) {
      return `<div class="progress-row"><div class="pbar"><span style="width:0%"></span></div><span class="pval">n/d</span>${srcTag}</div>` +
        `<div class="criteria-tag">${esc(front.progress.criteria)}</div>`;
    }
    return `<div class="progress-row"><div class="pbar"><span style="width:${pct}%"></span></div><span class="pval">${pct}%</span>${srcTag}</div>` +
      `<div class="criteria-tag">${esc(front.progress.criteria)}</div>`;
  }

  function frontCardHtml(front) {
    const statusPill = front.blocked.length
      ? '<span class="pill blocked">Bloqueado</span>'
      : front.githubRepo ? '<span class="pill progress">En progreso</span>' : '<span class="pill doc">Documental</span>';
    const stripe = front.blocked.length ? "var(--red)" : front.githubRepo ? "var(--blue)" : "var(--amber)";

    return `
    <article class="fcard" style="--stripe:${stripe}">
      <div class="fhead">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
          <div><h3>${esc(front.name)}</h3><p class="purpose">${esc(front.purpose)}</p></div>
          ${statusPill}
        </div>
        ${progressBarHtml(front)}
      </div>
      <div class="fbody">
        ${front.completed.length ? `<div class="frow done"><div class="flabel">✓ Completado</div>${ul(front.completed)}</div>` : ""}
        ${front.inProgress.length ? `<div class="frow"><div class="flabel">◐ En progreso</div>${ul(front.inProgress)}</div>` : ""}
        ${front.blocked.length ? `<div class="frow blocked"><div class="flabel">⛔ Bloqueado</div>${ul(front.blocked)}</div>` : ""}
        <div class="frow next"><div class="flabel">Próximos pasos</div>${ul(front.nextSteps)}</div>
        <div class="gh-note">
          <b>Fuente canónica:</b> ${esc(front.canonicalSource.label)}
          <span class="src-tag ${front.canonicalSource.sourceType === "github_live" ? "live" : "manual"}">${front.canonicalSource.sourceType === "github_live" ? "vivo" : front.canonicalSource.sourceType}</span>
          <br><span style="opacity:.8">última actualización: ${esc(front.canonicalSource.lastUpdated)}</span>
          ${front.githubError ? `<br><span style="color:var(--red)">GitHub: ${esc(front.githubError)}</span>` : ""}
        </div>
      </div>
    </article>`;
  }

  async function loadFronts() {
    const grid = document.getElementById("frentes-grid");
    try {
      const { teacherOs, saseZero, nuevoHorizonte } = await api("/fronts");
      grid.innerHTML = [teacherOs, saseZero, nuevoHorizonte].map(frontCardHtml).join("");
      cache.lastFronts = { teacherOs, saseZero, nuevoHorizonte };
      renderKpis(cache.lastFronts);
    } catch (err) {
      grid.innerHTML = `<p class="empty-note">No se pudieron cargar los frentes: ${esc(err.message)}</p>`;
    }
  }

  function renderKpis(fronts) {
    const blockedCount = [fronts?.teacherOs, fronts?.saseZero, fronts?.nuevoHorizonte]
      .filter(Boolean).reduce((n, f) => n + (f.blocked.length ? 1 : 0), 0);
    const pendingDecisions = cache.decisions.filter((d) => ["propuesta", "en_analisis"].includes(d.state)).length;
    const openActions = cache.actions.filter((a) => a.status !== "completada" && a.status !== "cancelada" && a.status !== "fallida").length;

    document.getElementById("kpis").innerHTML = `
      <div class="kpi"><div class="n">3</div><div class="l">Frentes activos</div></div>
      <div class="kpi"><div class="n">${blockedCount}</div><div class="l">Bloqueos activos</div></div>
      <div class="kpi"><div class="n">${cache.decisions.length}</div><div class="l">Decisiones registradas</div></div>
      <div class="kpi"><div class="n">${pendingDecisions}</div><div class="l">Pendientes de Hugo</div></div>
      <div class="kpi"><div class="n">${openActions}</div><div class="l">Acciones en cola</div></div>
    `;
  }

  // ================= Command Center PRs (live) =================
  function prCardHtml(pr, detail) {
    const threadsLine = detail
      ? `${detail.reviewThreads.filter((t) => !t.isResolved).length} abiertos / ${detail.reviewThreads.length} total`
      : "—";
    const checksLine = detail && detail.checks.length
      ? detail.checks.map((c) => `${c.name}:${c.conclusion || c.status}`).join(", ")
      : detail ? "sin checks" : "—";
    return `<div class="prcard">
      <div class="prtitle">PR #${pr.number} <span class="prstate ${pr.state}">${pr.state}</span></div>
      <div>${esc(pr.title)}</div>
      <dl>
        <dt>base</dt><dd>${esc(pr.baseRefName)}</dd>
        <dt>head</dt><dd>${esc(pr.headRefName)}</dd>
        <dt>HEAD</dt><dd>${esc(pr.headRefOidShort)}</dd>
        <dt>mergeable</dt><dd>${detail ? esc(detail.mergeable ?? "desconocido") : "—"}</dd>
        <dt>revisión</dt><dd>${detail ? esc(detail.reviewDecision ?? "sin revisión") : "—"}</dd>
        <dt>hilos</dt><dd>${threadsLine}</dd>
        <dt>checks</dt><dd>${checksLine}</dd>
        <dt>url</dt><dd><a href="${esc(pr.url)}" target="_blank" rel="noopener">abrir en GitHub</a></dd>
      </dl>
    </div>`;
  }

  async function loadCommandCenterPRs() {
    const el = document.getElementById("cc-prs");
    if (!cache.ghAvailable) {
      el.innerHTML = `<span style="color:#e4a190">conexión no disponible — no se muestran datos de PRs sin sesión de gh</span>`;
      return;
    }
    try {
      const { prs } = await api("/github/prs?repo=cyberbod2025/Command-center");
      const openPrs = prs.filter((p) => p.state === "OPEN");
      if (!openPrs.length) {
        el.innerHTML = `<span>Sin PR abiertos en cyberbod2025/Command-center.</span>`;
        return;
      }
      const details = await Promise.all(
        openPrs.map((p) => api(`/github/pr?repo=cyberbod2025/Command-center&number=${p.number}`).then((r) => r.pr).catch(() => null))
      );
      el.innerHTML = `<div class="prlist">${openPrs.map((p, i) => prCardHtml(p, details[i])).join("")}</div>`;
    } catch (err) {
      el.innerHTML = `<span style="color:#e4a190">${esc(err.message)}</span>`;
    }
  }

  // ================= Decisions =================
  const QUICK_QUESTIONS = [
    "¿Por qué recomiendas esto?", "¿Qué riesgo existe si no lo hago?", "¿Qué alternativas hay?",
    "¿Qué información te falta?", "¿Qué archivos se modificarían?", "¿Esto puede romper algo?",
    "¿Se puede revertir?", "¿Qué harías tú y por qué?",
  ];
  const REVERS_LABEL = { reversible: "Reversible", parcial: "Parcialmente reversible", irreversible: "Irreversible", no_aplica: "No aplica" };
  const CONF_LABEL = { alta: "Alta", media: "Media", baja: "Baja" };

  function planBodyHtml(plan) {
    return `<h4>Objetivo</h4><p>${esc(plan.objetivo)}</p>
      <h4>Pasos</h4>${ol(plan.pasos)}
      <h4>Repositorio / fuente</h4><p><code class="src">${esc(plan.fuente)}</code></p>
      <h4>Responsable</h4><p>${esc(plan.responsable)}</p>
      <h4>Validaciones necesarias</h4>${ul(plan.validaciones)}
      <h4>Riesgos</h4>${ul(plan.riesgos)}
      <h4>Cómo revertirlo</h4><p>${esc(plan.revertir)}</p>
      <h4>Evidencia esperada</h4>${ul(plan.evidenciaEsperada)}`;
  }

  function decisionCardHtml(d) {
    const canGeneratePackage = d.state === "aceptada" || d.state === "modificada";
    const histBlock = d.history.length
      ? `<details class="dhistory"><summary>Historial (${d.history.length})</summary>${d.history
          .map((h) => `<div class="hist-item"><span class="ht">${fmtTs(h.ts)}</span><span>${esc(h.detail)}</span></div>`)
          .join("")}</details>`
      : "";
    const qaBlock = d.questions.length
      ? d.questions.map((q) => `<div class="qa-item"><div class="qa-q">${esc(q.question)}</div><div class="qa-a">${esc(q.answer)} ${q.source === "prototipo" ? '<span class="proto-tag">prototipo</span>' : ""}</div></div>`).join("")
      : "";

    return `<div class="dcard" data-id="${d.id}" data-dstate="${d.state}">
      <div class="dtop">
        <p class="dq">${esc(d.question)}</p>
        <span class="dstate-badge ${d.state}">${STATE_LABEL[d.state] || d.state}</span>
      </div>
      <div class="dmeta-row">
        <span class="dchip"><b>${esc(d.project)}</b></span>
        <span class="dchip">Confianza: ${CONF_LABEL[d.confidence]}</span>
        <span class="dchip">Urgencia: ${CONF_LABEL[d.urgency]}</span>
        <span class="dchip">Reversibilidad: ${REVERS_LABEL[d.reversibility]}</span>
      </div>
      <p class="dproblem"><b>Problema:</b> ${esc(d.problem)}</p>
      <details class="devidence"><summary>Evidencia disponible (${d.evidence.length})</summary>${ul(d.evidence)}</details>
      <div class="dcols">
        <div class="dcol"><div class="dcol-l">Ventajas</div>${ul(d.pros)}</div>
        <div class="dcol"><div class="dcol-l">Riesgos</div>${ul(d.cons)}</div>
      </div>
      <p class="dproblem"><b>Impacto esperado:</b> ${esc(d.impact)}</p>
      <div class="daffected">${d.affected.map((a) => `<span class="achip">${esc(a)}</span>`).join("")}</div>
      ${qaBlock}
      <div class="dactions">
        <button class="dbtn primary" data-act="accept">Aceptar sugerencia</button>
        <button class="dbtn" data-act="modify">Modificar sugerencia</button>
        <button class="dbtn ghost-reject" data-act="reject">Rechazar</button>
        <button class="dbtn" data-act="question">Hacer una pregunta</button>
        <button class="dbtn" data-act="propose">Escribir mi propuesta</button>
        <button class="dbtn" data-act="postpone">Posponer</button>
        <button class="dbtn" data-act="plan">Ver plan de ejecución</button>
        <button class="dbtn" data-act="exec" ${canGeneratePackage ? "" : "disabled title=\"Acepta o modifica la sugerencia primero\""}>Generar paquete y solicitar ejecución</button>
      </div>
      <div class="ddrawer" data-drawer></div>
      ${histBlock}
    </div>`;
  }

  function applyDecisionFilter() {
    document.querySelectorAll("#decisions-grid .dcard").forEach((card) => {
      const st = card.getAttribute("data-dstate");
      card.hidden = !(cache.filter === "all" || st === cache.filter);
    });
  }

  function renderDecisionFilters() {
    const groups = ["all", "propuesta", "en_analisis", "aceptada", "modificada", "rechazada", "pospuesta", "lista_para_ejecucion", "enviada", "completada"];
    const bar = document.getElementById("decision-filters");
    bar.innerHTML = `<span class="fb-label">Filtrar</span>` + groups.map((g) =>
      `<button class="fbtn ${cache.filter === g ? "active" : ""}" data-f="${g}">${g === "all" ? "Todas" : STATE_LABEL[g]}</button>`
    ).join("");
    bar.querySelectorAll("[data-f]").forEach((btn) => {
      btn.addEventListener("click", () => {
        cache.filter = btn.getAttribute("data-f");
        bar.querySelectorAll("[data-f]").forEach((b) => b.classList.toggle("active", b === btn));
        applyDecisionFilter();
      });
    });
  }

  async function loadDecisions() {
    const grid = document.getElementById("decisions-grid");
    try {
      const { decisions } = await api("/decisions");
      cache.decisions = decisions;
      grid.innerHTML = decisions.map(decisionCardHtml).join("") || '<p class="empty-note">Sin decisiones registradas.</p>';
      wireDecisionCards();
      applyDecisionFilter();
    } catch (err) {
      grid.innerHTML = `<p class="empty-note">No se pudieron cargar las decisiones: ${esc(err.message)}</p>`;
    }
  }

  function getDecision(id) { return cache.decisions.find((d) => d.id === id); }

  function wireDecisionCards() {
    document.querySelectorAll("#decisions-grid .dcard").forEach((card) => {
      const id = card.getAttribute("data-id");
      const drawer = card.querySelector("[data-drawer]");
      card.querySelectorAll(".dbtn").forEach((btn) => {
        btn.addEventListener("click", () => handleDecisionAction(id, btn.getAttribute("data-act"), drawer));
      });
    });
  }

  function closeDrawer(drawer) { drawer.classList.remove("open"); drawer.innerHTML = ""; }

  async function refreshAfterMutation() {
    await loadDecisions();
    renderKpis(cache.lastFronts);
  }

  async function handleDecisionAction(id, act, drawer) {
    const d = getDecision(id);
    if (!d) return;

    if (act === "accept") {
      try {
        await api(`/decisions/${id}/accept`, { method: "POST" });
        toast("Decisión aceptada. Genera el paquete de ejecución cuando quieras avanzar.");
        await refreshAfterMutation();
      } catch (err) { toast(err.message); }
      return;
    }

    if (act === "reject") {
      drawer.classList.add("open");
      drawer.innerHTML = `<label>Motivo (opcional)</label><textarea rows="2"></textarea>
        <div class="dsubmit-row"><button class="dbtn primary" data-ok>Confirmar rechazo</button><button class="dbtn" data-cancel>Cancelar</button></div>`;
      drawer.querySelector("[data-ok]").addEventListener("click", async () => {
        try {
          await api(`/decisions/${id}/reject`, { method: "POST", body: { reason: drawer.querySelector("textarea").value } });
          toast("Registrada como rechazada.");
          await refreshAfterMutation();
        } catch (err) { toast(err.message); }
      });
      drawer.querySelector("[data-cancel]").addEventListener("click", () => closeDrawer(drawer));
      return;
    }

    if (act === "question") {
      drawer.classList.add("open");
      drawer.innerHTML = `<div class="qa-quick">${QUICK_QUESTIONS.map((q) => `<button data-q="${esc(q)}">${esc(q)}</button>`).join("")}</div>
        <label>O escribe tu propia pregunta</label><textarea rows="2"></textarea>
        <div class="dsubmit-row"><button class="dbtn primary" data-send>Enviar pregunta</button><button class="dbtn" data-cancel>Cerrar</button></div>`;
      async function send(q) {
        if (!q.trim()) return;
        try {
          await api(`/decisions/${id}/question`, { method: "POST", body: { question: q } });
          await refreshAfterMutation();
        } catch (err) { toast(err.message); }
      }
      drawer.querySelectorAll("[data-q]").forEach((b) => b.addEventListener("click", () => send(b.getAttribute("data-q"))));
      drawer.querySelector("[data-send]").addEventListener("click", () => send(drawer.querySelector("textarea").value));
      drawer.querySelector("[data-cancel]").addEventListener("click", () => closeDrawer(drawer));
      return;
    }

    if (act === "propose") {
      drawer.classList.add("open");
      drawer.innerHTML = `<label>Tu propuesta alternativa</label><textarea rows="3"></textarea>
        <div class="dsubmit-row"><button class="dbtn primary" data-ok>Comparar con la recomendación</button><button class="dbtn" data-cancel>Cancelar</button></div>
        <div data-out></div>`;
      drawer.querySelector("[data-ok]").addEventListener("click", async () => {
        const val = drawer.querySelector("textarea").value.trim();
        if (!val) return;
        try {
          await api(`/decisions/${id}/propose`, { method: "POST", body: { text: val } });
          drawer.querySelector("[data-out]").innerHTML = `<table class="cmp-table"><tr><th>Recomendación del sistema</th><th>Tu propuesta</th></tr>
            <tr><td>${esc(d.question)}<br><br><i>Ventajas:</i>${ul(d.pros)}<i>Riesgos:</i>${ul(d.cons)}</td>
            <td>${esc(val)}<br><br><i>Ventajas y riesgos:</i> pendientes de tu propio análisis — este prototipo no evalúa automáticamente tu propuesta.</td></tr></table>`;
          await refreshAfterMutation();
        } catch (err) { toast(err.message); }
      });
      drawer.querySelector("[data-cancel]").addEventListener("click", () => closeDrawer(drawer));
      return;
    }

    if (act === "modify") {
      drawer.classList.add("open");
      drawer.innerHTML = `
        <label>Alcance</label><textarea rows="2" data-f="alcance"></textarea>
        <label>Prioridad</label><input type="text" data-f="prioridad">
        <label>Condiciones</label><textarea rows="2" data-f="condiciones"></textarea>
        <label>Orden (lista de posiciones separadas por coma, ej. "2,1,3,4" — reemplaza por completo la secuencia)</label><textarea rows="2" data-f="orden" placeholder="ej. 2,1,3,4,5,6"></textarea>
        <label>Restricciones</label><textarea rows="2" data-f="restricciones"></textarea>
        <label>Resultado esperado</label><textarea rows="2" data-f="resultadoEsperado"></textarea>
        <div class="dsubmit-row"><button class="dbtn primary" data-ok>Aplicar modificación</button><button class="dbtn" data-cancel>Cancelar</button></div>`;
      drawer.querySelector("[data-ok]").addEventListener("click", async () => {
        const fields = {};
        drawer.querySelectorAll("[data-f]").forEach((el) => { fields[el.getAttribute("data-f")] = el.value; });
        try {
          await api(`/decisions/${id}/modify`, { method: "POST", body: fields });
          toast("Modificación aplicada.");
          await refreshAfterMutation();
        } catch (err) { toast(err.message); }
      });
      drawer.querySelector("[data-cancel]").addEventListener("click", () => closeDrawer(drawer));
      return;
    }

    if (act === "postpone") {
      drawer.classList.add("open");
      drawer.innerHTML = `
        <label class="radio-line"><input type="radio" name="pp" value="mas_tarde" checked> Más tarde</label>
        <label class="radio-line"><input type="radio" name="pp" value="despues_de_otro_pr"> Después de cerrar otro PR</label>
        <label class="radio-line"><input type="radio" name="pp" value="cuando_exista_acceso"> Cuando exista acceso</label>
        <label class="radio-line"><input type="radio" name="pp" value="fecha_aproximada"> Fecha aproximada</label>
        <input type="date" data-date>
        <label class="radio-line"><input type="radio" name="pp" value="condicion"> Condición necesaria</label>
        <input type="text" data-cond placeholder="Describe la condición...">
        <div class="dsubmit-row"><button class="dbtn primary" data-ok>Confirmar posponer</button><button class="dbtn" data-cancel>Cancelar</button></div>`;
      drawer.querySelector("[data-ok]").addEventListener("click", async () => {
        const reason = drawer.querySelector("input[name=pp]:checked").value;
        const targetDate = drawer.querySelector("[data-date]").value || undefined;
        const detail = drawer.querySelector("[data-cond]").value || undefined;
        try {
          await api(`/decisions/${id}/postpone`, { method: "POST", body: { reason, targetDate, detail } });
          toast("Decisión pospuesta.");
          await refreshAfterMutation();
        } catch (err) { toast(err.message); }
      });
      drawer.querySelector("[data-cancel]").addEventListener("click", () => closeDrawer(drawer));
      return;
    }

    if (act === "plan") {
      openModal("Plan de ejecución", planBodyHtml(d.plan), '<button class="dbtn" id="modal-ok">Cerrar</button>');
      document.getElementById("modal-ok").addEventListener("click", closeModal);
      return;
    }

    if (act === "exec") {
      if (d.state !== "aceptada" && d.state !== "modificada") {
        toast("Acepta o modifica la sugerencia antes de generar el paquete de ejecución.");
        return;
      }
      openModal(
        "Solicitar ejecución",
        planBodyHtml(d.plan) +
          '<div class="exec-warning"><b>Esto genera un archivo real</b> en <code class="src">data/actions/</code> con el paquete de ejecución, pero NO ejecuta nada por sí solo. Un agente (Claude Code) debe tomarlo en una sesión real. Esta app luego verifica evidencia en GitHub antes de marcar la acción como completada.</div>',
        '<button class="dbtn" id="modal-cancel">Cancelar</button><button class="dbtn primary" id="modal-confirm">Generar paquete</button>'
      );
      document.getElementById("modal-cancel").addEventListener("click", closeModal);
      document.getElementById("modal-confirm").addEventListener("click", async () => {
        try {
          const r = await api(`/decisions/${id}/generate-package`, { method: "POST" });
          toast(`Paquete generado: ${r.packagePath}`);
          closeModal();
          await refreshAfterMutation();
          await loadActions();
        } catch (err) { toast(err.message); }
      });
      return;
    }
  }

  // ================= Actions queue =================
  const READINESS_LABEL = {
    ready: { text: "Evidencia suficiente", cls: "completada" },
    insufficient: { text: "Evidencia insuficiente", cls: "generada" },
    missing: { text: "Criterios faltantes", cls: "fallida" },
  };

  function readinessPillHtml(readiness) {
    if (!readiness) return "";
    let kind = "insufficient";
    if (readiness.ready) kind = "ready";
    else if (readiness.missingManualTags?.length) kind = "missing";
    const label = READINESS_LABEL[kind];
    const detail = readiness.missingManualTags?.length
      ? ` (faltan: ${readiness.missingManualTags.join(", ")})`
      : ` (${readiness.satisfying}/${readiness.minEvidence})`;
    return `<span class="astatus ${label.cls}" title="${esc(readiness.criteria)}">${label.text}${esc(detail)}</span>`;
  }

  function actionRowHtml(a) {
    const decision = cache.decisions.find((d) => d.id === a.decisionId);
    const readiness = cache.readiness?.[a.id];
    const acceptsManual = a.verification.allowedEvidenceKinds.includes("manual");
    const dependency = a.dependsOnActionId ? cache.actions.find((x) => x.id === a.dependsOnActionId) : null;
    const chainNote = a.chainIndex !== undefined && dependency
      ? `<div style="color:var(--text-dim); font-size:11px;">depende de: ${esc(dependency.id)} (${esc(ACTION_STATE_LABEL[dependency.status] || dependency.status)})</div>`
      : "";
    return `<div class="action-row" data-id="${a.id}">
      <span class="astatus ${a.status}">${ACTION_STATE_LABEL[a.status] || a.status}</span>
      <div>
        <div><b>${esc(decision ? decision.question : a.decisionId)}</b> ${readinessPillHtml(readiness)}</div>
        <div style="color:var(--text-dim); font-size:11px;">${esc(a.packagePath)}${a.sentTo ? ` · enviada a ${esc(a.sentTo.agent)} (${fmtTs(a.sentTo.ts)})` : ""}</div>
        ${chainNote}
      </div>
      <div style="display:flex; gap:6px; flex-wrap:wrap;">
        <button class="dbtn" data-a="view">Ver paquete</button>
        ${a.status === "generada" ? '<button class="dbtn" data-a="sent">Marcar enviada</button>' : ""}
        ${a.verification.expectedRepo ? '<button class="dbtn" data-a="verify">Verificar en GitHub</button>' : ""}
        ${acceptsManual ? '<button class="dbtn" data-a="manual">Registrar evidencia manual</button>' : ""}
        <button class="dbtn primary" data-a="complete" ${readiness?.ready ? "" : "disabled title=\"Evidencia insuficiente para los criterios de esta acción\""}>Completar</button>
        <button class="dbtn" data-a="comment" ${cache.ghAvailable && a.verification.allowedEvidenceKinds.includes("comment") ? "" : "disabled title=\"no disponible para esta acción\""}>Publicar comentario en PR</button>
      </div>
    </div>`;
  }

  async function loadActions() {
    const el = document.getElementById("actions-list");
    try {
      const { actions } = await api("/actions");
      cache.actions = actions;
      cache.readiness = {};
      await Promise.all(
        actions.map((a) =>
          api(`/actions/${a.id}/readiness`)
            .then((r) => { cache.readiness[a.id] = r; })
            .catch(() => { cache.readiness[a.id] = null; })
        )
      );
      el.innerHTML = actions.length ? actions.slice().reverse().map(actionRowHtml).join("") : '<p class="empty-note">Sin acciones generadas todavía.</p>';
      wireActions();
      renderKpis(cache.lastFronts);
    } catch (err) {
      el.innerHTML = `<p class="empty-note">No se pudieron cargar las acciones: ${esc(err.message)}</p>`;
    }
  }

  function wireActions() {
    document.querySelectorAll(".action-row").forEach((row) => {
      const id = row.getAttribute("data-id");
      row.querySelectorAll("[data-a]").forEach((btn) => {
        btn.addEventListener("click", () => handleActionButton(id, btn.getAttribute("data-a")));
      });
    });
  }

  async function handleActionButton(id, kind) {
    if (kind === "view") {
      try {
        const res = await fetch(`/api/actions/${id}/package`);
        const text = await res.text();
        openModal("Paquete de ejecución", `<pre style="white-space:pre-wrap; font-family:var(--mono); font-size:11.5px;">${esc(text)}</pre>`, '<button class="dbtn" id="modal-ok">Cerrar</button>');
        document.getElementById("modal-ok").addEventListener("click", closeModal);
      } catch (err) { toast(err.message); }
      return;
    }
    if (kind === "sent") {
      const agent = prompt("¿A qué agente se envió el paquete?", "Claude Code") || "Claude Code";
      try {
        await api(`/actions/${id}/mark-sent`, { method: "POST", body: { agent } });
        toast("Registrada como enviada.");
        await loadActions();
      } catch (err) { toast(err.message); }
      return;
    }
    if (kind === "verify") {
      const repo = prompt(`Repositorio a verificar (${ALLOWED_REPOS.join(" | ")})`, ALLOWED_REPOS[0]);
      if (!repo) return;
      const prNumber = Number(prompt("Número de PR a verificar", "2"));
      if (!prNumber) return;
      try {
        const r = await api(`/actions/${id}/verify`, { method: "POST", body: { repo, prNumber } });
        toast(`Evidencia registrada desde GitHub (PR #${prNumber}).`);
        await loadActions();
      } catch (err) { toast(err.message); }
      return;
    }
    if (kind === "manual") {
      openModal(
        "Registrar evidencia manual",
        `<h4>Descripción</h4><textarea id="me-description" rows="2" style="width:100%; font-family:var(--sans); font-size:12.5px; padding:7px 9px; border-radius:var(--radius); border:1px solid var(--line); background:var(--panel); color:var(--text);"></textarea>
        <h4>Tipo de evidencia</h4><input id="me-type" type="text" placeholder="p. ej. confirmacion_acceso, inventario_drive" style="width:100%; font-family:var(--sans); font-size:12.5px; padding:7px 9px; border-radius:var(--radius); border:1px solid var(--line); background:var(--panel); color:var(--text);">
        <h4>Fuente</h4><input id="me-source" type="text" placeholder="p. ej. Supabase dashboard, carpeta de Drive" style="width:100%; margin-bottom:8px; padding:6px 8px;">
        <h4>Fecha</h4><input id="me-date" type="date" style="margin-bottom:8px;">
        <h4>Responsable</h4><input id="me-responsible" type="text" placeholder="Hugo" style="width:100%; margin-bottom:8px; padding:6px 8px;">
        <h4>Referencia o ruta (opcional)</h4><input id="me-reference" type="text" style="width:100%; margin-bottom:8px; padding:6px 8px;">
        <h4>Notas</h4><textarea id="me-notes" rows="2" style="width:100%; padding:6px 8px;"></textarea>
        <div id="me-preview" style="display:none; margin-top:12px; padding:10px; border:1px dashed var(--line); border-radius:var(--radius); font-size:12px;"></div>`,
        '<button class="dbtn" id="modal-cancel">Cancelar</button><button class="dbtn" id="modal-preview">Vista previa</button><button class="dbtn primary" id="modal-confirm" disabled>Confirmar registro</button>'
      );
      document.getElementById("modal-cancel").addEventListener("click", closeModal);
      const readField = (fieldId) => document.getElementById(fieldId).value.trim();
      document.getElementById("modal-preview").addEventListener("click", () => {
        const payload = {
          description: readField("me-description"),
          evidenceType: readField("me-type"),
          source: readField("me-source"),
          occurredAt: readField("me-date"),
          responsible: readField("me-responsible"),
          reference: readField("me-reference"),
          notes: readField("me-notes"),
        };
        if (!payload.description || !payload.evidenceType) {
          toast("Descripción y tipo de evidencia son obligatorios.");
          return;
        }
        const preview = document.getElementById("me-preview");
        preview.style.display = "block";
        preview.innerHTML = `<b>Vista previa</b><br>
          <b>Descripción:</b> ${esc(payload.description)}<br>
          <b>Tipo:</b> ${esc(payload.evidenceType)}<br>
          ${payload.source ? `<b>Fuente:</b> ${esc(payload.source)}<br>` : ""}
          ${payload.occurredAt ? `<b>Fecha:</b> ${esc(payload.occurredAt)}<br>` : ""}
          ${payload.responsible ? `<b>Responsable:</b> ${esc(payload.responsible)}<br>` : ""}
          ${payload.reference ? `<b>Referencia:</b> ${esc(payload.reference)}<br>` : ""}
          ${payload.notes ? `<b>Notas:</b> ${esc(payload.notes)}` : ""}`;
        document.getElementById("modal-confirm").disabled = false;
        document.getElementById("modal-confirm").onclick = async () => {
          try {
            const r = await api(`/actions/${id}/evidence/manual`, { method: "POST", body: payload });
            toast(r.readiness?.ready ? "Evidencia registrada — la acción ya está lista para completarse." : "Evidencia registrada — todavía no cumple todos los criterios.");
            closeModal();
            await loadActions();
          } catch (err) { toast(err.message); }
        };
      });
      return;
    }
    if (kind === "complete") {
      const summary = prompt("Resumen de cierre (se guarda en el historial):", "Verificado en GitHub.") || "Verificado en GitHub.";
      try {
        await api(`/actions/${id}/complete`, { method: "POST", body: { summary } });
        toast("Acción marcada como completada.");
        await loadActions();
        await loadDecisions();
      } catch (err) { toast(err.message); }
      return;
    }
    if (kind === "comment") {
      const repo = prompt(`Repositorio (${ALLOWED_REPOS.join(" | ")})`, ALLOWED_REPOS[0]);
      if (!repo) return;
      const prNumber = Number(prompt("Número de PR", "2"));
      if (!prNumber) return;
      const body = prompt("Texto del comentario a publicar:");
      if (!body) return;
      openModal(
        "Confirmar comentario en PR",
        `<h4>Repositorio</h4><p><code class="src">${esc(repo)}#${prNumber}</code></p><h4>Vista previa</h4><pre style="white-space:pre-wrap; font-size:12px;">${esc(body)}</pre>`,
        '<button class="dbtn" id="modal-cancel">Cancelar</button><button class="dbtn primary" id="modal-confirm">Confirmar y publicar</button>'
      );
      document.getElementById("modal-cancel").addEventListener("click", closeModal);
      document.getElementById("modal-confirm").addEventListener("click", async () => {
        try {
          const r = await api(`/actions/${id}/publish-comment`, { method: "POST", body: { repo, prNumber, body, confirm: true } });
          toast(`Comentario publicado: ${r.url}`);
          closeModal();
          await loadActions();
        } catch (err) { toast(err.message); }
      });
      return;
    }
  }

  // ================= Audit =================
  async function loadAudit() {
    const el = document.getElementById("audit-list");
    try {
      const { audit } = await api("/audit");
      el.innerHTML = audit.length
        ? audit.map((a) => `<div class="audit-item"><span class="ht">${fmtTs(a.ts)}</span><span class="cat">${esc(a.category)}</span><span>${esc(a.action)} — ${esc(a.detail)}</span></div>`).join("")
        : '<p class="empty-note">Sin entradas de auditoría todavía.</p>';
    } catch (err) {
      el.innerHTML = `<p class="empty-note">${esc(err.message)}</p>`;
    }
  }

  // ================= Boot =================
  async function boot() {
    await loadGithubStatus();
    renderDecisionFilters();
    await Promise.all([loadFronts(), loadDecisions(), loadActions(), loadAudit(), loadCommandCenterPRs()]);
  }

  boot();
})();
