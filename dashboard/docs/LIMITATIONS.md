# Limitaciones conocidas de esta primera versión

- **Un solo operador, un solo archivo.** `data/command-center-state.json` no
  está pensado para más de un proceso escribiendo a la vez desde procesos
  distintos (dentro de un mismo proceso, las mutaciones sí se serializan —
  ver `state.ts::mutate`). Si se abren dos instancias del servidor apuntando
  al mismo `data/`, pueden pisarse escrituras.
- **Sin autenticación de la app.** Es local, de un solo usuario (Hugo). No hay
  login ni control de acceso — cualquiera con acceso a `localhost:4173` en
  esa máquina puede aceptar/rechazar decisiones o publicar un comentario en
  un PR (con confirmación explícita, pero sin una segunda identidad que lo
  autorice).
- **Teacher OS y Supabase son instantáneas manuales**, no lecturas en vivo.
  Si Hugo actualiza `ESTADO.md` o el estado real de Supabase cambia, esta app
  no se entera hasta que alguien edite `src/server/fronts.ts` a mano.
- **El porcentaje de Nuevo Horizonte es una estimación manual** (9/12 módulos,
  tomada de `DECISIONES.md`), no derivada de un conteo automático de módulos
  en el código del repositorio — la app no clona ni inspecciona el contenido
  de `NUEVO-HORIZONTE`, solo consulta PRs/checks/hilos vía `gh`.
- **`gh pr comment` no siempre imprime una URL limpia** en todas las versiones
  de `gh` CLI — `postPullRequestComment` intenta tomar la última línea no
  vacía de la salida; si el formato cambia, la URL registrada podría venir
  vacía (la evidencia igual queda marcada como verificada porque la llamada
  no lanzó error).
- **`npm audit` reporta vulnerabilidades en la cadena de dependencias de
  desarrollo de `vitest`/`esbuild`/`vite`** (servidor de desarrollo, no código
  que se ejecuta en producción). No se resolvieron en esta entrega para no
  saltar a una versión mayor de `vitest` sin probarla; ver `ROADMAP.md`.
- **Sin paginación** en `gh pr list` (límite fijo de 30) ni en el listado de
  auditoría (`/api/audit` devuelve como máximo las últimas 200 entradas).
- **El frontend es vanilla JS sin build** — suficiente para esta versión, pero
  no tiene comprobación de tipos ni tests propios (solo el backend los tiene).
- **No hay reconciliación si un paquete de ejecución generado en
  `data/actions/*.md` se edita a mano** — la app no vuelve a leer ese archivo
  salvo para mostrarlo ("Ver paquete"); el estado de la acción vive en
  `command-center-state.json`, no en el Markdown.
- **La detección de "revisión de Codex" (`requireCodexReview`) es heurística**:
  busca `/codex/i` en el login del autor de cada review devuelta por
  `gh pr view --json reviews` (`github.ts::hasCodexReview`). Si el bot cambia
  de nombre de usuario, esta comprobación deja de encontrarlo — no valida
  contenido de la revisión, solo su procedencia.
- **Las cadenas de acciones dependientes (`additionalActionPlan`) son lineales
  y viven solo en la decisión que las define** — no hay soporte todavía para
  ramificar en más de una secuencia paralela ni para decisiones con más de
  un `additionalActionPlan` distinto según una condición.
- **El endpoint de readiness (`GET /actions/:id/readiness`) recalcula
  criterios en cada llamada** — la interfaz hace una petición por acción
  visible en la cola; con muchas acciones esto es más tráfico que un campo
  precalculado, aceptable a esta escala (un solo usuario).
