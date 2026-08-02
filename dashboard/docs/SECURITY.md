# Seguridad

## Principio rector

**La app nunca finge que una acción ocurrió.** Toda acción sigue: revisión →
pregunta/modificación/aceptación → plan de ejecución → confirmación →
ejecución solo si hay integración real → verificación de evidencia →
recién entonces se marca completada (`completeActionIfVerified`, ver
`DATA-MODEL.md`).

## Lista cerrada de operaciones

No hay ejecución de shell con entrada libre del usuario. Las únicas llamadas
externas son:

| Operación | Cómo se invoca | Entrada del usuario involucrada |
|---|---|---|
| `gh auth status` | `execFile`, args fijos | ninguna |
| `gh pr list --repo <repo>` | `execFile`, args fijos + repo validado contra lista cerrada | repo (validado) |
| `gh pr view <n> --repo <repo>` | idem | número de PR (validado como entero positivo), repo |
| `gh api graphql` | idem, query fija en el código | repo/número (interpolados como parámetros `-F`, no en la query) |
| `gh pr comment <n> --repo <repo> --body-file <tmp>` | idem | cuerpo del comentario, escrito a archivo temporal, nunca a un shell |

Ningún valor del usuario se concatena a una cadena que luego se ejecute en un
shell. `execFile` (a diferencia de `exec`) nunca invoca `/bin/sh` o `cmd.exe`.

## Explícitamente fuera de alcance en esta versión

Ver también la sección "No debe incluir todavía" de la tarea original — están
implementadas como ausencia total de código, no como flags apagados:

- Merges automáticos, borrado de ramas, force-push.
- Rotación de claves, cualquier escritura en Supabase.
- Escritura en Google Drive.
- Despliegues.
- Ejecución "destructiva" de cualquier tipo.
- Acceso a expedientes o datos de estudiantes.

## Secretos

- No hay `.env` en `dashboard/`. El único secreto conceptual (el token de
  `gh`) nunca lo toca esta app — vive en la sesión de `gh CLI` del SO.
- El estado persistido (`data/command-center-state.json`) no tiene ningún
  campo pensado para credenciales; el modelo de datos (`DATA-MODEL.md`) no
  incluye tokens ni valores de `.env`.
- SHA completos: la UI y los paquetes de ejecución solo muestran SHA cortos
  (`headRefOidShort`, 7 caracteres) — nunca el SHA completo, y nunca se
  enlaza directamente a un commit histórico que pudiera contener un valor
  sensible (consistente con R-13 en `RIESGOS.md` del Command Center).
- `.gitignore` del dashboard excluye `data/command-center-state.json`,
  `data/backups/*.json`, y cualquier `.env*` — de existir un `.env` en el
  futuro, esta app solo detectaría su existencia (`fs.access`), nunca leería
  ni mostraría su contenido (no implementado aún porque no hay `.env` que
  detectar todavía).

## Auditoría

Cada mutación (aceptar, rechazar, modificar, preguntar, proponer, posponer,
generar paquete, marcar enviada, verificar, completar, publicar comentario)
queda registrada en `state.audit[]` con actor, categoría, acción, detalle y
marca de tiempo — visible en `/api/audit` y en la sección "Auditoría" del
frontend. No se puede editar ni borrar una entrada de auditoría desde la API.

## Confirmación explícita para acciones remotas

`POST /api/actions/:id/publish-comment` exige `confirm: true` en el cuerpo.
Sin esa bandera, la API responde `400` sin llamar a `gh`. La UI solo la
manda después de mostrar la vista previa completa del comentario y que Hugo
pulse "Confirmar y publicar" en un modal dedicado.
