# Hugo Command Center — Estado del Portafolio

> **Fuente única de estado.** Si algo no está aquí, no está verificado.
> Regla: ninguna celda se llena con lo que dijo una IA. Solo con lo que se comprobó en disco, git, build o prueba.

Última verificación real: **2026-08-01**.

**Los tres frentes aparecen siempre en este panel.** Hasta el 2026-08-01 se trataban como cuatro porque "Nuevo Horizonte" y "Proyecto Horizonte / CodeBrain" se leían como proyectos distintos. Hugo aclaró que "CodeBrain" fue un nombre genérico dejado por una sesión anterior y que ambos son el mismo frente — ver D-009.

---

## El Command Center ya tiene repositorio propio (2026-08-01)

El Command Center dejó de vivir solo como carpeta de documentos y ahora cuenta con:

- **Repositorio independiente:** clonado dentro de `Projects` en `C:\HUGO_SYSTEM\Projects\Command-center`, con remoto propio [`github.com/cyberbod2025/Command-center`](https://github.com/cyberbod2025/Command-center).
- **Separación correcta respecto de los repositorios de los demás frentes:** `Command-center` es un `.git` independiente de `TEACHER-OS`, `SASE-ZERO` y `NUEVO-HORIZONTE`. Ninguno de esos repos vive dentro de `Command-center` ni al revés.
- **`Projects` sigue sin ser un repositorio git** — es solo la carpeta contenedora desde la que un agente puede consultar todos los frentes. Toda operación git confirma primero su raíz con `git rev-parse --show-toplevel` (ver D-013 en `DECISIONES.md`).
- La copia histórica de estos documentos en `_Shared/COMMAND-CENTER` (fuera de git) queda pendiente de retirar una vez confirmada por Hugo; no se borra en esta tarea.

**Próxima acción concreta:** confirmar con Hugo si `_Shared/COMMAND-CENTER` se retira ahora que el repositorio `Command-center` es la fuente canónica, o si se mantiene temporalmente como respaldo. Mientras no haya confirmación, tratar `Command-center` (este repo) como la fuente de verdad y `_Shared/COMMAND-CENTER` como copia histórica no autoritativa.

---

## Vista general

| Campo | Teacher OS | SASE Zero | Nuevo Horizonte |
|---|---|---|---|
| Estado | Documental — en marcha (Drive), sin código | Desarrollo | Desarrollo |
| Semáforo | 🟡 Amarillo | 🟡 Amarillo | 🟢 Verde |
| Carpeta oficial | `G:\Mi unidad\TEACHER OS HUGO — CICLO 2026-2027` (real, ver corrección de D-002) · `Projects/TEACHER-OS` queda como carpeta técnica vacía | `Projects/SASE-ZERO` | `Projects/NUEVO-HORIZONTE` (renombrada de `PROYECTO-HORIZONTE`, D-009) |
| Repositorio git | ❌ no aplica — trabajo en Drive, no en código | ✅ local | ✅ `github.com/cyberbod2025/NUEVO-HORIZONTE` (el nombre del remoto ahora coincide con el frente) |
| Rama activa | — | `feat/vertical-slice` | `main` — árbol limpio y sincronizado, sin ramas sobrantes tras PR #9 |
| Progreso | No medible en % — hay estructura, memoria pedagógica de 3°A/3°B terminada, RC1 (Programa Analítico 2°) declarado canónico 27-jul-2026, protocolo diagnóstico 2°A/2°B terminado a nivel documental | no medible aún | 9 de 12 módulos migrados (27 lecciones v2) |
| Objetivo actual | Sustituir el PDF inválido de `Programa_Sintetico_Fase_6.pdf` (es texto plano disfrazado de PDF, verificado con pdfinfo/pdffonts) antes de cerrar el cotejo curricular | Cerrar decisiones de arquitectura antes de módulos grandes | Migrar módulos 10–12 a v2 (D-005) |
| Último avance verificado | `03_ESTADO_ACTUAL.md` actualizado 27-jul-2026 en Drive | `a60c003` RLS: revocar ALL, dejar solo SELECT | `d75cae0` — módulo 9 (prompts, RAG y límites de API LLM simulados en JS) migrado a 3 lecciones v2; PR #9 mergeado por squash y rama borrada |
| Bloqueador | Programa Sintético Fase 6 sin PDF auténtico de la SEP; Planeación anual/semanal bloqueada hasta resolverlo | R-11: proyecto Supabase real declarado por Hugo en **otra cuenta**, sin acceso verificable desde este agente | Ninguno activo |
| Próxima acción | Conseguir y subir el PDF auténtico del Programa Sintético Fase 6 (folio 58) | Fijar definición de terminado del vertical slice | Migrar módulo 10 a v2, en rama corta (D-005) |
| Responsable | Hugo | Hugo + Claude Code | Hugo + Claude Code |
| Evidencia | `00_INICIO_Y_CONTROL/03_ESTADO_ACTUAL.md`, `09_CHECKPOINT_ULTIMA_SESION.md` (Drive) | `git log` | `git log`, `npx tsc --noEmit`, 74 pruebas con `lessonsV2.ts` al 100 % de cobertura, build, [PR #8](https://github.com/cyberbod2025/NUEVO-HORIZONTE/pull/8) |
| Fecha de revisión | 2026-07-31 | 2026-07-31 | 2026-08-01 |

### Nota histórica sobre Nuevo Horizonte / CodeBrain / Proyecto Horizonte

Entre el 2026-07-31 y el 2026-08-01 el panel trató este frente como dos proyectos distintos: "Proyecto Horizonte (CodeBrain)" con código, y "Nuevo Horizonte" como frente nuevo `pendiente de definición`. Esa separación se originó en un nombre de carpeta ambiguo (`NUEVO HORIZONTE` contenía código de un producto llamado internamente "CodeBrain DevAcademy"). Hugo aclaró el 2026-08-01 que "CodeBrain" fue un nombre genérico entregado por una sesión de Gemini y que no hay dos frentes: siempre fue uno solo, Nuevo Horizonte. D-009 fusiona ambos registros, retira D-003/D-006/D-008 (superadas, no borradas — ver `DECISIONES.md`) y consolida el portafolio en tres frentes.

---

## Gobierno de ramas (vigente desde 2026-07-31)

Todo cambio en cualquier repositorio sigue este ciclo. Ver D-004.

1. Rama corta con nombre descriptivo.
2. Pruebas y build en verde.
3. Commit.
4. PR.
5. Squash o merge.
6. **Borrado inmediato de la rama.**

No se trabaja directo sobre `main`. El riesgo de ramas abandonadas se resuelve cerrándolas, no evitando la rama.

---

## Hallazgos de la primera auditoría (2026-07-31)

1. ~~La carpeta `NUEVO HORIZONTE` contiene Proyecto Horizonte (CodeBrain), un frente distinto.~~ **Corregido 2026-08-01 (D-009):** no son frentes distintos. "CodeBrain" era solo un nombre de marca genérico dentro del mismo frente Nuevo Horizonte.
2. **Teacher OS nunca se materializó.** Se crea desde cero, sin arrastrar documentación previa. *(Nota: esto también resultó parcialmente falso — ver aprendizaje del 2026-07-31 en `RIESGOS.md` sobre el trabajo real en Drive.)*
3. ~~Nuevo Horizonte tiene cambios sin commitear.~~ **Resuelto.** Eran 465 líneas reales (migración del módulo 5). Verificado de forma independiente — `tsc` limpio, 59 pruebas, build exitoso — y commiteado como `669b73a`.
4. **Seis carpetas SASE conviven** sin declarar cuál es oficial: `SASE_LIGHT`, `sase-light`, `SASE_ABACUS_SANDBOX`, `SASE-310-SYSTEM-VALIDATION`, `SASE-310-SYSTEM-BACKUP.git`, `SASE-310-SYSTEM-PURGE-DRYRUN.git`. Revisado, no intervenido: pendiente como microtarea estructural, no como excavación.
5. **Ningún proyecto tenía definición de terminado.** La de la migración v2 de Nuevo Horizonte ya está escrita (D-005); faltan las demás.

---

## Definición de terminado

| Proyecto | Alcance mínimo | Criterios de aceptación | Fuera de alcance | Condición de cierre |
|---|---|---|---|---|
| Teacher OS | — | — | — | — |
| SASE Zero | — | — | — | — |
| Nuevo Horizonte | Migración v2 completa: ver D-005 | ver D-005 | Supabase, auth, mentor IA, Sandpack | 12 de 12 módulos en v2, sin coexistencia de contratos |

---

## Límite de trabajo activo

- Máximo 1 tarea profunda activa por proyecto.
- Máximo 2 proyectos en ejecución técnica intensa el mismo día.
- **Hoy:** migración del módulo 8 cerrada en Nuevo Horizonte (D-012). SASE Zero queda revisado sin abrir excavación. Teacher OS con decisión docente #1 pendiente.

---

## Estado de despliegue (Supabase / Vercel)

> Verificado por API directa (`list_projects` de Supabase y Vercel), no por lo que declare un chat. 2026-07-31.

| Frente | Proyecto Supabase | Estado Supabase | Proyecto Vercel | Notas |
|---|---|---|---|---|
| Teacher OS | ninguno | — | ninguno | Consistente con alcance no definido. No abrir infraestructura antes de `ALCANCE.md`. |
| SASE Zero | `SASE-Light` (`plyjvvpkaafnkxmmqkbh`) | 🟢 ACTIVE_HEALTHY | `sase-light` | Coinciden por nombre. Proyecto `SASE` (`uvnetpnjinxzhggoqmwz`, INACTIVE) no está asociado a ningún frente vigente — ver R-10. |
| Nuevo Horizonte | ninguno | — | ninguno | Correcto: D-005 aplaza Supabase hasta terminar migración v2. Sin proyecto Vercel — el despliegue, si existe, no está identificado por nombre. |

Proyectos Supabase/Vercel existentes en la cuenta sin vínculo declarado a un frente del panel: Supabase `FERIA`, `SASE` (INACTIVE), `Laboratorio-digital-310` (INACTIVE); Vercel `sase-310-system`, `stron-registro`, `atemi-mx-v-3-0`, `laboratorio-digital-310`, `laboratorio-digital-310-umsg`, `modulos-math`, `feria-alternativa`, `diagnostico-colectivo`. No se tocan: pueden ser trabajo previo legítimo fuera del portafolio actual. Ver R-10.

---

## Bandeja de incubación

Ideas registradas que **no** son proyectos activos. Nada sale de aquí sin revisar capacidad y relación con los frentes vigentes.

| Idea | Fecha | Relación con frentes actuales | Estado |
|---|---|---|---|
| *(vacía)* | | | |
