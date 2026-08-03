# Integraciones

## GitHub (lectura en vivo + una escritura guardada)

Implementada en `src/server/github.ts`. Reglas duras:

- **Lista cerrada de repositorios** (`ALLOWED_REPOS`): `cyberbod2025/Command-center`,
  `cyberbod2025/NUEVO-HORIZONTE`, `cyberbod2025/SASE-ZERO`. Cualquier otro repo
  se rechaza antes de tocar `gh` (`RepoNotAllowedError`, HTTP 400).
- **Sin shell**: todas las llamadas usan `execFile("gh", [...])` con argumentos
  como array — nunca se interpola una cadena a un shell, así que no hay
  inyección de comandos posible aunque el texto venga de Hugo.
- **Sin tokens en el frontend**: el navegador nunca ve una credencial. El
  backend delega en la sesión de `gh auth status` del sistema operativo.
- **Sin conexión → sin datos inventados**: si `gh auth status` falla, cada
  endpoint que depende de GitHub devuelve `available:false` /
  `503 { error: "conexión no disponible: ..." }`, y el frontend muestra ese
  mensaje literal en vez de placeholders o números estimados.

### Lecturas

- `listPullRequests(repo)` → `gh pr list --json ...`
- `getPullRequest(repo, number)` → `gh pr view --json ...` + una consulta
  GraphQL (`gh api graphql`) para `reviewThreads { isResolved }`, porque
  `gh pr view` no expone si un hilo de revisión está resuelto.
- Ambas se usan en `/api/fronts` (para Nuevo Horizonte y SASE Zero), en
  `/api/github/prs` y `/api/github/pr` (sección "Command Center / GitHub"), y
  en `/api/actions/:id/verify` (evidencia de cierre).

### Única escritura: comentario en PR

`postPullRequestComment(repo, number, body)` → `gh pr comment --body-file`.
El cuerpo se escribe a un archivo temporal (nunca se pasa como argumento
directo con contenido de longitud arbitraria) y el archivo se borra después.

Expuesta como `POST /api/actions/:id/publish-comment`, requiere:

1. Repositorio en la lista cerrada.
2. `confirm: true` explícito en el cuerpo de la petición (la UI solo lo manda
   tras mostrar la vista previa completa y pedir confirmación).
3. Sesión de `gh` disponible — si no, `503` con el motivo, y el botón queda
   deshabilitado en la UI con el mismo mensaje.

No hay ninguna otra escritura remota: no se implementó merge, borrado de
rama, edición de archivos, ni push.

## Teacher OS (manual/documental)

`src/server/fronts.ts::getTeacherOsFront()` devuelve datos **hardcodeados**,
derivados de `ESTADO.md`/`DECISIONES.md`/`RIESGOS.md` del Command Center,
explícitamente etiquetados `sourceType: "manual"` o `"no_disponible"` (para el
avance, que es `n/d`). No hay lectura ni escritura de Google Drive en esta
fase — el campo `canonicalSource.lastUpdated` indica cuándo se actualizó ese
dato a mano.

## Supabase (solo estado documental)

No hay cliente de Supabase en esta app. El frente SASE Zero muestra
literalmente lo que dicen `RIESGOS.md` (R-11, R-13) y `DECISIONES.md`:
acceso no verificable, RLS/políticas pendientes de auditar, riesgo residual
de la clave publishable aceptado temporalmente. Ningún endpoint de esta app
puede leer ni modificar un proyecto Supabase.
