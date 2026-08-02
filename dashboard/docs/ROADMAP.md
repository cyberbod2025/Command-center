# Roadmap (propuesto, no aprobado)

Cada ítem requiere aprobación explícita de Hugo antes de implementarse —
ninguno se ejecuta como consecuencia automática de esta entrega.

## Corto plazo (siguiente microtarea segura)

- Probar los tres flujos de ejemplo (`PR #2/#3`, `SASE Zero → Supabase`,
  `Teacher OS → auditar Drive`) desde la UI real con Hugo operándola, no solo
  vía `curl`, y ajustar textos/controles según fricción real.

## Mediano plazo

- Lectura real de Teacher OS: en cuanto exista una integración de solo
  lectura con Google Drive autorizada por Hugo, sustituir el bloque manual de
  `fronts.ts::getTeacherOsFront()` por una lectura real, manteniendo la
  etiqueta de fuente (`github_live`/`manual`) visible.
- Contar módulos migrados de Nuevo Horizonte inspeccionando el propio
  repositorio (p. ej. `lessonsV2.ts`) en vez de una constante manual — solo
  si se decide que vale la pena el costo de mantenimiento frente a mantenerlo
  documental.
- Subir el límite de `gh pr list` con paginación real si el número de PRs por
  repo crece más allá de 30.

## Largo plazo / condicional

- Migrar de archivo JSON a SQLite si el número de decisiones/acciones crece
  lo suficiente para que las lecturas completas del archivo sean lentas, o si
  se necesita más de un proceso escribiendo concurrentemente.
- Autenticación de la app si deja de ser de un solo usuario en `localhost`.
- Ampliar la lista cerrada de operaciones remotas (merge asistido con doble
  confirmación, por ejemplo) — **nunca** como cambio silencioso; cada
  ampliación de la lista cerrada en `github.ts` debe registrarse como
  decisión en `DECISIONES.md` del Command Center, no solo en este roadmap.
- Actualizar la cadena de dependencias de `vitest`/`vite`/`esbuild` a la
  siguiente versión mayor una vez validada, para cerrar los avisos de
  `npm audit` descritos en `LIMITATIONS.md`.
