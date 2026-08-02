# Registro de Decisiones

Estados: `propuesta` → `aprobada` → `aplicada` → `verificada`.
Una decisión sin evidencia no pasa de `aprobada`.

---

## D-001 — Fuente única de estado del portafolio

- **Proyecto:** Portafolio (los cuatro frentes)
- **Fecha:** 2026-07-31
- **Decisión:** `_Shared/COMMAND-CENTER/ESTADO.md` es la única fuente válida del estado de los cuatro proyectos. Cualquier otro documento de estado queda subordinado.
- **Motivo:** El estado estaba disperso entre chats, repos y documentos; no era posible saber el avance real.
- **Alternativas descartadas:** README por proyecto (no da vista de portafolio); herramienta externa tipo Notion/Trello (agrega una fuente de verdad más).
- **Riesgos:** Que el archivo se desactualice y se convierta en otra fuente muerta. Mitigación: se toca en cada cierre de día o no se toca nunca.
- **Responsable:** Hugo
- **Evidencia:** `_Shared/COMMAND-CENTER/ESTADO.md`
- **Estado:** `superada por D-013` (2026-08-01) — la fuente única de estado ya no es `_Shared/COMMAND-CENTER/ESTADO.md` (fuera de git), sino este repositorio, `Command-center/ESTADO.md`. `_Shared/COMMAND-CENTER` queda como copia histórica no autoritativa, pendiente de retirar (ver nota en `ESTADO.md`).

---

## D-002 — Ubicación oficial de Teacher OS y Proyecto Horizonte

- **Proyecto:** Teacher OS, Proyecto Horizonte
- **Fecha:** 2026-07-31
- **Decisión:** Teacher OS nunca se materializó: se crea desde cero en `Projects/TEACHER-OS`. Proyecto Horizonte sí existe — es la carpeta `NUEVO HORIZONTE` (ver D-003).
- **Motivo:** Hugo confirmó que Teacher OS vivía solo en conversaciones. No hay documentación previa que recuperar ni riesgo de duplicar.
- **Alternativas descartadas:** Buscar en Drive o GitHub antes de crear (descartado por confirmación directa).
- **Riesgos:** Empezar sin alcance definido reproduce el problema de "documentación que crece más rápido que el producto". Mitigación: el primer y único documento de Teacher OS es su alcance mínimo.
- **Responsable:** Hugo
- **Evidencia:** `Projects/TEACHER-OS/ALCANCE.md`
- **Estado:** `retirada` — la instrucción de crear Teacher OS desde cero en `Projects/TEACHER-OS` **no debe interpretarse como directiva vigente**. Ningún agente debe inicializar git ni poblar esa carpeta como si fuera el proyecto.
- **Corregida y retirada 2026-07-31:** la premisa "Teacher OS nunca se materializó" era **falsa**. Existe `G:\Mi unidad\TEACHER OS HUGO — CICLO 2026-2027`, con control de sesión, memoria pedagógica de continuidad (3°A/3°B terminada), currículo NEM/PDA, RC1 (Programa Analítico 2°) declarado canónico el 27-jul-2026, y bitácora activa hasta esa fecha. La búsqueda original solo cubrió disco local (`C:/HUGO_SYSTEM`), no Drive. Esta decisión queda **anulada por evidencia posterior**: **Teacher OS vive en Google Drive, no tiene repositorio Git, y la carpeta local `Projects/TEACHER-OS` es únicamente técnica — no debe inicializarse ni poblarse como proyecto**. La decisión vigente es la que reconoce Drive como fuente canónica. `Projects/TEACHER-OS/ALCANCE.md`, creado bajo la premisa errónea, no debe usarse como fuente sin revisarse contra el estado real en Drive. Ver aprendizaje correspondiente en `RIESGOS.md`.

---

## D-003 — "Nuevo Horizonte" y "Proyecto Horizonte" son el mismo proyecto

- **Proyecto:** Proyecto Horizonte
- **Fecha:** 2026-07-31
- **Decisión:** Se declara un solo frente: **Proyecto Horizonte (CodeBrain DevAcademy)**, ubicado en `Projects/NUEVO HORIZONTE`. El portafolio queda en **tres** frentes: Teacher OS, SASE Zero, Proyecto Horizonte.
- **Motivo:** La carpeta `NUEVO HORIZONTE` contiene literalmente CodeBrain: `package.json` name `codebrain-devacademy`, `<title>CodeBrain DevAcademy</title>`, claves `codebrain_*`. No son dos productos.
- **Contradicción resuelta:** El documento maestro exigía "no mezclar código, documentación ni repositorios de Nuevo Horizonte con Proyecto Horizonte". Esa regla partía de un supuesto falso: nunca hubo dos proyectos, solo una carpeta con nombre engañoso. La regla queda **sin efecto**.
- **Alternativas descartadas:** Mantener cuatro frentes (obligaría a inventar alcance para un producto inexistente); crear un Nuevo Horizonte separado (abrir un frente sin problema que resolver).
- **Riesgos:** El nombre de la carpeta seguirá confundiendo a agentes y sesiones futuras. **Mitigación pendiente:** renombrar a `PROYECTO-HORIZONTE`. No se ejecuta aún porque rompe rutas, configuración `.claude` y sesiones abiertas — requiere aprobación explícita de Hugo.
- **Responsable:** Hugo
- **Evidencia:** `NUEVO HORIZONTE/package.json:2`, `NUEVO HORIZONTE/index.html:11`, `NUEVO HORIZONTE/CLAUDE.md:7`
- **Estado:** `aplicada`
- **Corregida por D-006:** el portafolio vuelve a cuatro frentes. Lo que D-003 estableció y sigue vigente es que *la carpeta* `NUEVO HORIZONTE` contiene CodeBrain, no un producto distinto.

---

## D-004 — Gobierno de ramas: no se trabaja directo sobre `main`

- **Proyecto:** Todos los repositorios del portafolio
- **Fecha:** 2026-07-31
- **Decisión:** Todo cambio sigue el ciclo rama corta → pruebas en verde → commit → PR → squash o merge → **borrado inmediato de la rama**. Ningún commit directo a `main`.
- **Motivo:** El commit `669b73a` se hizo directo a `main` argumentando que era el patrón previo del repositorio y que ramificar alimentaría el riesgo de ramas abandonadas. Hugo rechazó ambos argumentos: que los commits anteriores estén en `main` no vuelve correcto el flujo, y el riesgo de ramas abandonadas se resuelve cerrándolas, no evitándolas.
- **Alcance de la excepción:** `669b73a` **no se revierte** — está probado, es coherente y dejó el árbol limpio. No constituye precedente.
- **Alternativas descartadas:** Seguir el patrón histórico del repo (deja `main` sin protección); revertir `669b73a` (costo sin beneficio, el trabajo está verificado).
- **Riesgos:** Ramas que se abren y no se cierran. Mitigación: el borrado de la rama es parte del ciclo, no un paso opcional.
- **Responsable:** Hugo
- **Evidencia:** [PR #1](https://github.com/cyberbod2025/NUEVO-HORIZONTE/pull/1) (`chore/gitattributes-eol`, `c645ded`) y [PR #2](https://github.com/cyberbod2025/NUEVO-HORIZONTE/pull/2) (`docs/adr-0004-evidencia-pruebas`, `b135838`), primeras en aplicar el ciclo — ambas mergeadas 2026-08-01, ramas borradas local y remoto tras el merge.
- **Estado:** `aplicada`

---

## D-005 — Completar la migración v2 antes de abrir Supabase

- **Proyecto:** Nuevo Horizonte (antes registrado también como Proyecto Horizonte/CodeBrain)
- **Fecha:** 2026-07-31
- **Decisión (alternativa elegida):** Migrar los **7 módulos restantes** (6–12) al contrato de lecciones v2 antes de abrir el frente de Supabase.
- **Alternativa aplazada:** Supabase — persistencia remota, autenticación y mentor IA.
- **Motivo:** Hoy conviven dos modelos de lección (v1 `MODULES` y v2 `LESSONS_V2`) dentro del mismo producto. Abrir Supabase ahora añadiría una segunda transformación estructural antes de cerrar la primera, elevando complejidad, errores, duplicación, número de pruebas y dificultad de diagnóstico — con el riesgo concreto de modelar la persistencia remota sobre un contrato de lección todavía incompleto. Primero se estabiliza el modelo de dominio; después se conecta persistencia.
- **Criterio para reabrir Supabase:** Solo se adelanta si aparece una función inmediata que **no pueda** resolverse con `localStorage` y que **bloquee una validación real con usuarios** (por ejemplo, progreso compartido entre dispositivos en un piloto con estudiantes reales). Hoy ese bloqueo no existe.
- **Riesgos:** (a) La migración de 7 módulos es más larga que las anteriores y puede perder impulso — mitigación: un módulo por rama corta, nunca varios juntos. (b) El sandbox solo ejecuta JS plano, sin DOM ni JSX, así que los módulos restantes que dependan de navegador exigirán el mismo patrón de simulación ya validado en los módulos 3, 4 y 5. (c) `curriculum.ts` v1 no se toca hasta que los 12 estén migrados, para no quedar a medias entre dos contratos. (d) **Nuevo 2026-08-02:** una fusión rápida de módulos sin endurecer los evaluadores permite que soluciones incompletas aprueben (hallazgos P2 de Codex en PR #6/#7/#9) — mitigación: ningún módulo se da por migrado hasta que su PR correctivo (ver PR #10) esté cerrado sin hallazgos accionables.
- **Definición de terminado de la migración:**
  1. Los 12 módulos legacy tienen su territorio cubierto por lecciones v2.
  2. Una sola cadena secuencial de `prerequisiteLessonIds`, sin huecos ni bifurcaciones.
  3. `lessonsV2.ts` mantiene 100 % de cobertura.
  4. `npx tsc --noEmit`, `vitest run` y `npm run build` en verde, ejecutados en la iteración, no citados de un reporte previo.
  5. `docs/backlog.md` y el ADR 0004 actualizados con el conteo de pruebas del momento.
  6. Decidido y documentado qué pasa con v1: se retira `curriculum.ts` o se declara explícitamente por qué permanece.
  7. Ninguna rama de migración queda abierta.
  8. **Añadido 2026-08-02:** ningún PR correctivo de hallazgos P2/P1 de Codex queda abierto sobre módulos ya "migrados" antes de avanzar al siguiente módulo.
- **Responsable:** Hugo + Claude Code
- **Evidencia:** módulos 6–9 aplicados: [PR #6](https://github.com/cyberbod2025/NUEVO-HORIZONTE/pull/6) (`c610946`), [PR #7](https://github.com/cyberbod2025/NUEVO-HORIZONTE/pull/7) (`697410f`), [PR #8](https://github.com/cyberbod2025/NUEVO-HORIZONTE/pull/8) (`1fb416f`) y [PR #9](https://github.com/cyberbod2025/NUEVO-HORIZONTE/pull/9) (mergeado); [PR #10](https://github.com/cyberbod2025/NUEVO-HORIZONTE/pull/10) **abierto, sin mergear**, corrige 8 hallazgos P2 de Codex sobre los módulos 6, 7 y 9 — bloquea la migración del módulo 10 hasta cerrarse con `tsc`/pruebas/build en verde y sin hallazgos accionables. Faltan módulos 10–12.
- **Estado:** `aprobada` — en ejecución, con evidencia acumulada rama por rama. **Bloqueada temporalmente en PR #10.**

---

## D-006 — Nuevo Horizonte permanece como cuarto frente visible

- **Proyecto:** Nuevo Horizonte
- **Fecha:** 2026-07-31
- **Decisión:** El Command Center muestra **siempre los cuatro frentes**. Nuevo Horizonte aparece con estado `pendiente de definición`, sin carpeta ni repositorio propios, hasta tener diagnóstico inicial.
- **Motivo:** Al confirmarse que la carpeta `NUEVO HORIZONTE` contenía CodeBrain, el frente Nuevo Horizonte quedó fuera del panel. Un frente sin diagnóstico no es un frente inexistente: si desaparece del tablero, deja de gobernarse.
- **Alternativas descartadas:** Dejar el portafolio en tres frentes (hace invisible un frente vivo); crearle carpeta ahora (abriría un proyecto sin problema definido, justo el hábito a corregir).
- **Riesgos:** Confusión permanente entre el frente "Nuevo Horizonte" y la carpeta homónima que contiene Horizonte. Mitigación: nota explícita en `ESTADO.md` y renombrado pendiente de la carpeta a `PROYECTO-HORIZONTE` (R-05).
- **Responsable:** Hugo
- **Evidencia:** `ESTADO.md`, columna "Nuevo Horizonte"
- **Estado:** `superada por D-009` (2026-08-01) — no se revierte, pero el supuesto que la originó (dos frentes separados) era incorrecto. Ver D-009.

---

## D-008 — Renombrar la carpeta de Proyecto Horizonte

> Renumerada de D-007 a D-008 el 2026-08-01: dos sesiones concurrentes usaron "D-007" para decisiones distintas (esta y la de R-11/SASE Zero, más abajo). Esta es la que se movió; la otra conserva su número original y su estado `retirada`.

- **Proyecto:** Proyecto Horizonte
- **Fecha:** 2026-07-31
- **Decisión:** Se ejecuta la mitigación pendiente de R-05: `Projects/NUEVO HORIZONTE` → `Projects/PROYECTO-HORIZONTE`. El repositorio remoto de GitHub **no** se renombra; conserva `github.com/cyberbod2025/NUEVO-HORIZONTE`.
- **Motivo:** Hugo confirmó explícitamente que esa carpeta contiene todo el frente de Proyecto Horizonte, y aprobó el renombrado tras evaluar las opciones. El nombre anterior seguía induciendo a confundirlo con el frente Nuevo Horizonte.
- **Verificación previa al movimiento:** sin `.claude` local en la carpeta; sin referencias hardcodeadas a la ruta fuera de logs/histórico de sesión (que no se tocan) y de un título en `README.md`.
- **Incidente durante la ejecución:** el primer intento de `Rename-Item` falló ("in use") porque el propio shell de Bash tenía el `cwd` dentro de la carpeta. Se resolvió saliendo del directorio antes de reintentar — no había ningún proceso externo bloqueándola.
- **Verificación posterior:** `git status`, `git remote -v` y `git log` idénticos antes y después del movimiento; el repositorio no sufrió daño.
- **Alcance no incluido:** renombrar el repositorio remoto de GitHub. Es una acción distinta (afecta URLs de clonado, cualquier integración externa) y no fue lo que se pidió.
- **Alternativas descartadas:** renombrar también el remoto en la misma sesión (mayor blast radius sin necesidad inmediata).
- **Riesgos:** El remoto sigue llamándose `NUEVO-HORIZONTE`, lo que puede confundir a quien mire solo la URL de GitHub sin leer el Command Center. Mitigación: nota explícita en `ESTADO.md`.
- **Responsable:** Hugo
- **Evidencia:** `Get-ChildItem Projects` tras el movimiento; `git log`/`git status` en la nueva ruta; commit `aa61a91` (README) mergeado vía [PR #4](https://github.com/cyberbod2025/NUEVO-HORIZONTE/pull/4) (versión v2 del README, creada fuera de esta sesión, sustituyó el PR #3 original) — squash en `6226f30`.
- **Estado:** `superada por D-009` (2026-08-01) — la carpeta `PROYECTO-HORIZONTE` se renombró de nuevo a `NUEVO-HORIZONTE` al fusionarse los frentes. `git fetch --prune` + `git branch -vv`/`-r` habían confirmado `main` sincronizado con `origin/main` y cero ramas sobrantes antes del segundo renombrado.

---

## D-007 — Corrección propuesta para R-11 (Supabase desalineado en SASE Zero)

- **Proyecto:** SASE Zero
- **Fecha:** 2026-07-31
- **Decisión propuesta:** Reemplazar en `SASE-ZERO/app/.env` la ref inexistente `nchofzlpswojqrigbbbk` por el proyecto `SASE-Light` (`plyjvvpkaafnkxmmqkbh`), único proyecto Supabase de la cuenta conectada cuyo nombre coincide con el frente y está `ACTIVE_HEALTHY`.
  - `VITE_SUPABASE_URL=https://plyjvvpkaafnkxmmqkbh.supabase.co`
  - `VITE_SUPABASE_ANON_KEY=<publishable key obtenida por API vía get_publishable_keys(plyjvvpkaafnkxmmqkbh), no inventada — valor real no se registra en este documento>`
- **Motivo por el que no se aplicó directo:** `SASE-ZERO/CLAUDE.md` declara explícitamente que la fase actual **no autoriza implementación de producto**, solo arquitectura y documentación. Cambiar `.env` es un cambio funcional, no documental — necesita autorización explícita de Hugo o cambio de fase del proyecto.
- **Riesgo si no se aplica:** El frente sigue "verde" en el panel mientras su backend real está roto — contradice la regla de evidencia del Command Center.
- **Riesgo si se aplica sin confirmar:** `SASE-Light` es la coincidencia más probable por nombre, pero no está confirmado que sea el proyecto correcto (podría ser otra cuenta, un proyecto ya borrado, o un error de copiar/pegar de otro repo).
- **Responsable de aprobar:** Hugo
- **Evidencia:** `list_projects` Supabase (no aparece `nchofzlpswojqrigbbbk`), `get_publishable_keys(plyjvvpkaafnkxmmqkbh)`
- **Estado:** `retirada` — Hugo confirmó 2026-07-31 y de nuevo 2026-08-02 que el proyecto Supabase real de SASE Zero vive en **otra cuenta** de Hugo, no en la conectada a este agente. **`SASE-Light` no es el proyecto correcto y no debe presentarse como el backend de SASE Zero en ningún documento del Command Center.** Aplicar este fix habría introducido una desalineación nueva. No se ejecuta. Ver R-11 actualizado en `RIESGOS.md`. Pendiente real: acceso o credenciales verificables de la cuenta correcta.

---

## D-009 — Fusión definitiva: Nuevo Horizonte y Proyecto Horizonte/CodeBrain son un solo frente; portafolio queda en tres

- **Proyecto:** Nuevo Horizonte (antes registrado también como "Proyecto Horizonte")
- **Fecha:** 2026-08-01
- **Decisión:** No hay dos frentes. "CodeBrain DevAcademy" fue un nombre de marca genérico dejado por una sesión anterior de Gemini al terminar el producto; nunca fue un proyecto distinto de Nuevo Horizonte. Se fusionan los dos registros del Command Center en uno solo: **Nuevo Horizonte**. El portafolio vuelve a tener **tres** frentes: Teacher OS, SASE Zero, Nuevo Horizonte.
- **Motivo:** Confirmado explícitamente por Hugo. Corrige la lectura de D-006/D-008, que asumían que "Proyecto Horizonte" y "Nuevo Horizonte" eran proyectos separados porque una carpeta tenía un nombre ambiguo — esa separación nunca reflejó la intención real de Hugo.
- **Ejecutado en esta decisión:**
  1. Renombrado de marca en el repositorio (rama corta `chore/rename-a-nuevo-horizonte`, commit `85b694b`, [PR #5](https://github.com/cyberbod2025/NUEVO-HORIZONTE/pull/5) mergeado como `c838dba`): `package.json`/`package-lock.json` (`name: nuevo-horizonte`), `README.md`, `CLAUDE.md`, ADR 0004, `index.html` (title/meta), y textos de UI (`AppHeader`, `AppFooter`, `WelcomeScreen`, banner CLI en `App.tsx`).
  2. Verificado antes de commitear: `npx tsc --noEmit` limpio, `npx vitest run` 59/59 pruebas en verde, `npm run build` exitoso.
  3. Carpeta local renombrada: `Projects/PROYECTO-HORIZONTE` → `Projects/NUEVO-HORIZONTE`. Repo verificado íntegro tras el movimiento (`git status`/`git remote -v`).
  4. El remoto de GitHub `github.com/cyberbod2025/NUEVO-HORIZONTE` **no se toca** — ya tenía el nombre correcto; deja de tratarse como "nombre histórico" y pasa a ser simplemente el nombre correcto del frente.
- **Explícitamente fuera de esta decisión:** renombrar las claves de `localStorage` (`codebrain_xp`, `codebrain_streak`, etc.) usadas por `src/services/progressStorage.ts`. Cambiarlas equivale a resetear el progreso guardado de cualquier usuario real — es el mismo mecanismo que `PROGRESS_VERSION` usa para resets intencionales. Quedan documentadas tal cual en `CLAUDE.md`/`AGENTS.md`. Se retoma solo si Hugo lo pide explícitamente.
- **Decisiones que quedan superadas (no se revierten, se marcan `superada por D-009`):** D-006 (Nuevo Horizonte como cuarto frente separado) y D-008 (renombrar la carpeta a `PROYECTO-HORIZONTE`, que asumía dos frentes). D-003 ya había establecido correctamente que la carpeta contenía CodeBrain; D-009 completa esa lectura declarando que CodeBrain **es** Nuevo Horizonte, no un tercer nombre distinto.
- **Riesgos:** Ninguna referencia a "Proyecto Horizonte" o "CodeBrain" debería sobrevivir fuera de esta nota histórica y de `RIESGOS.md`/aprendizajes. Mitigación: `ESTADO.md` reescrito con nota explicativa; búsqueda de código confirmó que solo quedan las claves de `localStorage` (intencionalmente sin tocar) y artefactos de build ignorados por git (`dist/`, `coverage/`, se regeneran).
- **Responsable:** Hugo + Claude Code
- **Evidencia:** `git log` (`85b694b`, `c838dba`), [PR #5](https://github.com/cyberbod2025/NUEVO-HORIZONTE/pull/5) verificado con `gh pr view --json files,commits` (10 archivos, 1 commit), 59 pruebas, build, `Get-ChildItem Projects` tras el renombrado de carpeta.
- **Estado:** `aplicada` — **reconfirmada por Hugo el 2026-08-02** tras una propuesta de una sesión distinta de restaurar cuatro frentes citando una carpeta `PROYECTO-HORIZONTE` que ya no existe. Verificado en disco (`Projects/NUEVO-HORIZONTE` es la única carpeta) y en GitHub (`github.com/cyberbod2025/NUEVO-HORIZONTE` es el único repositorio, con [PR #10](https://github.com/cyberbod2025/NUEVO-HORIZONTE/pull/10) abierto). Hugo confirmó explícitamente: no se crea D-014, no se restauran cuatro frentes, no se separa Proyecto Horizonte de Nuevo Horizonte. "Proyecto Horizonte", "CodeBrain" y "CodeBrain DevAcademy" son nombres históricos del mismo frente único.

---

## D-010 — Aplicar D-005 al módulo 6 de Nuevo Horizonte

- **Proyecto:** Nuevo Horizonte
- **Fecha:** 2026-08-01
- **Decisión:** Cubrir el territorio del módulo 6 legacy (Backend con Node.js & Express REST API) con tres lecciones v2 encadenadas: HTTP y métodos REST (16), rutas Express y respuestas JSON (17), y CRUD con parámetro `:id` (18). La cadena continúa 15→16→17→18; `curriculum.ts` v1, Supabase y la infraestructura de backend real no se tocan.
- **Motivo:** D-005 exige migrar un módulo por rama corta antes de abrir Supabase. El contrato v2 ya soporta las prácticas y checks requeridos; el sandbox solo ejecuta JavaScript, por lo que el contenido debe simular el comportamiento observable de HTTP/Express sin afirmar que levanta Node o un servidor real.
- **Alternativas descartadas:** Abrir Supabase antes de estabilizar el currículo; migrar varios módulos en la misma rama; añadir un runtime Node/Express real al sandbox; modificar `curriculum.ts` v1 antes de completar los 12 módulos.
- **Riesgos:** Confundir una simulación JS con un servidor HTTP real o romper la cadena de prerrequisitos. Mitigación: restricciones explícitas en ADR/retos, pruebas de la secuencia 16→17→18 y `lessonsV2.ts` al 100 % de cobertura. **Materializado 2026-08-02:** Codex encontró 3 hallazgos P2 donde soluciones incompletas aprobaban los checks — ver PR #10.
- **Responsable:** Hugo + Claude Code
- **Evidencia:** rama `feat/migrar-modulo-6-backend`, commit `237f03e`, [PR #6](https://github.com/cyberbod2025/NUEVO-HORIZONTE/pull/6) mergeado por squash como `c610946`; `npx tsc --noEmit` limpio, `npx vitest run --coverage` 65/65 y `lessonsV2.ts` 100 %, `npm run build` exitoso; `git fetch --prune` confirmó solo `main` local/remoto tras el borrado de la rama.
- **Estado:** `verificada` — con correcciones de evaluador pendientes en PR #10 (no invalida la migración, endurece los checks).

---

## D-011 — Aplicar D-005 al módulo 7 de Nuevo Horizonte

- **Proyecto:** Nuevo Horizonte
- **Fecha:** 2026-08-01
- **Decisión:** Cubrir el territorio del módulo 7 legacy (Bases de Datos: SQL, Postgres & Supabase) con tres lecciones v2 encadenadas: SQL básico `SELECT`/`WHERE`/`INSERT INTO` (19), claves foráneas y `JOIN` conceptual (20), y cliente de Supabase (`from`/`select`/`eq`) con Row Level Security (21). La cadena continúa 18→19→20→21; `curriculum.ts` v1 no se toca.
- **Motivo:** D-005 exige migrar un módulo por rama corta antes de abrir Supabase. El contenido de este módulo **enseña el concepto** de SQL/Supabase/RLS de forma simulada en JS puro — no implica abrir el frente de infraestructura Supabase real para la app. Es el mismo patrón que el módulo 6 aplicó a HTTP/Express.
- **Alternativas descartadas:** Abrir un cliente Supabase real para esta lección (contradice D-005: la infraestructura se aplaza hasta terminar la migración v2); migrar varios módulos en la misma rama; omitir RLS por ser "solo seguridad" (se incluyó explícitamente porque es el concepto de mayor riesgo real si se ignora).
- **Riesgos:** Que un estudiante o una sesión futura confunda esta simulación con una conexión Supabase real y configurada. Mitigación: nota explícita de alcance en el ADR 0004 y en `docs/backlog.md` aclarando que el contenido es curricular, no infraestructura. **Materializado 2026-08-02:** Codex encontró 2 hallazgos P2 — ver PR #10.
- **Responsable:** Hugo + Claude Code
- **Evidencia:** rama `feat/migrar-modulo-7-database`, commit `af657bb`, [PR #7](https://github.com/cyberbod2025/NUEVO-HORIZONTE/pull/7) verificado (5 archivos, 1 commit) y mergeado por squash como `697410f`; `npx tsc --noEmit` limpio, `npx vitest run --coverage` 70/70 (antes 65), `npm run build` exitoso; `git fetch --prune` + `git branch -vv`/`-r` confirmaron solo `main` local/remoto tras el borrado de la rama.
- **Estado:** `verificada` — con correcciones de evaluador pendientes en PR #10 (no invalida la migración, endurece los checks).

---

## D-012 — Aplicar D-005 al módulo 8 de Nuevo Horizonte

- **Proyecto:** Nuevo Horizonte
- **Fecha:** 2026-08-01
- **Decisión:** Cubrir el territorio del módulo 8 legacy (Pruebas Automatizadas con Vitest & RTL) con tres lecciones v2 encadenadas: prueba unitaria Arrange-Act-Assert y `toBe` (22), casos límite e identificación de regresiones (23), y mocks con consultas accesibles de React Testing Library (24). La cadena continúa 21→22→23→24; `curriculum.ts` v1, paquetes de ejecución de Vitest/RTL, JSX y red no se tocan.
- **Motivo:** D-005 exige migrar un módulo por rama corta antes de abrir Supabase. El contenido debe enseñar la sintaxis y el razonamiento de pruebas sin presentar el Worker de JavaScript como una suite Vitest ni como un navegador con React Testing Library.
- **Alternativas descartadas:** Instalar o ejecutar Vitest/RTL dentro del sandbox; añadir render React/JSX o red a los retos; migrar más de un módulo en la misma rama; modificar `curriculum.ts` v1 antes de completar los 12 módulos.
- **Riesgos:** Que la simulación se confunda con una suite Vitest o una interfaz RTL reales, o que una prueba cubra solo el camino feliz. Mitigación: límites explícitos en ADR/backlog, retos con PASS y FAIL, valores de frontera e inválidos, y mocks de éxito/error en JS local.
- **Responsable:** Hugo + Claude Code
- **Evidencia:** rama `feat/migrar-modulo-8-testing`, commit `539d7fb`, [PR #8](https://github.com/cyberbod2025/NUEVO-HORIZONTE/pull/8) verificado con `gh pr view --json files,commits` (6 archivos, 1 commit) y mergeado por squash como `1fb416f`; `npx tsc --noEmit` limpio, `npx vitest run --coverage` 74/74 y `lessonsV2.ts` 100 %, `npm run build` exitoso; `git fetch --prune` confirmó solo `main` local/remoto tras el borrado de la rama.
- **Estado:** `verificada`

---

## D-013 — Command Center con repositorio independiente dentro de `Projects`

- **Proyecto:** Command Center (portafolio completo)
- **Fecha:** 2026-08-01
- **Decisión:** El Command Center pasa a tener su propio repositorio git, clonado dentro de `C:\HUGO_SYSTEM\Projects\Command-center`, con remoto propio `github.com/cyberbod2025/Command-center`. `C:\HUGO_SYSTEM\Projects` permanece como carpeta contenedora sin `.git` propio — sirve para que un agente consulte todos los frentes, pero ninguna operación git se ejecuta desde su raíz.
- **Motivo:** Permite control de versiones y trazabilidad de las decisiones, riesgos y estado del portafolio (hasta ahora vivían solo como archivos sueltos fuera de git en `_Shared/COMMAND-CENTER`). Evita mezclar el historial del Command Center con el historial de cualquiera de los frentes. Permite que Claude (u otro agente) consulte el espacio completo de `Projects` sin que la carpeta contenedora se convierta en un monorepositorio accidental.
- **Alternativas descartadas:** Mantener el Command Center como carpeta sin git (pierde trazabilidad de cambios y no admite PR/revisión); convertir `Projects` en un monorepositorio que incluya todos los frentes (mezclaría historiales independientes y complicaría el gobierno de ramas por proyecto, D-004).
- **Consecuencia:** `Projects` no tendrá git propio. Cada proyecto —incluido el Command Center— mantiene su propio `.git`. Toda operación git debe confirmar primero su raíz con `git rev-parse --show-toplevel` antes de ejecutarse.
- **Responsable:** Hugo
- **Evidencia:** `C:\HUGO_SYSTEM\Projects\Command-center\.git`, remoto `github.com/cyberbod2025/Command-center` confirmado con `git remote -v`.
- **Estado:** `aplicada`

---

## Nota — D-014 no se crea (2026-08-02)

Una sesión distinta propuso restaurar el portafolio a cuatro frentes (Teacher OS, SASE Zero, Proyecto Horizonte, Nuevo Horizonte) y registrar una decisión "D-014" declarando `Projects/PROYECTO-HORIZONTE` como carpeta separada de `Projects/NUEVO-HORIZONTE`, con `github.com/cyberbod2025/NUEVO-HORIZONTE` como "solo el nombre histórico del remoto de Proyecto Horizonte".

Verificación antes de escribir esa decisión: `Projects/PROYECTO-HORIZONTE` **no existe** en disco; solo existe `Projects/NUEVO-HORIZONTE`, con un único repositorio git (`github.com/cyberbod2025/NUEVO-HORIZONTE`) que incluye [PR #10](https://github.com/cyberbod2025/NUEVO-HORIZONTE/pull/10) abierto. Hugo confirmó explícitamente el 2026-08-02: D-009 permanece vigente, no se crea D-014, no se restauran cuatro frentes, no se separa Proyecto Horizonte de Nuevo Horizonte — son nombres históricos del mismo frente único. Ver la nota de reconfirmación en el `Estado` de D-009 y en `ESTADO.md`.

Este apartado documenta la propuesta y su rechazo por evidencia, sin ocupar un número de decisión, porque no se aprobó ni se aplicó ningún cambio.
