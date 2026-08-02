# Command Center

Este repositorio es la **fuente canónica** del Hugo Command Center: el panel de estado, decisiones, riesgos y despliegue de todo el portafolio.

- **Ruta local:** `C:\HUGO_SYSTEM\Projects\Command-center`
- **Remoto:** [`github.com/cyberbod2025/Command-center`](https://github.com/cyberbod2025/Command-center)
- **`C:\HUGO_SYSTEM\Projects` es solo el espacio de trabajo contenedor** — no es un repositorio git. Sirve para que Claude (u otro agente) pueda consultar todos los frentes desde un mismo lugar, pero ninguna operación git se ejecuta desde su raíz.
- **Cada frente de código conserva su propio repositorio independiente.** SASE Zero y Nuevo Horizonte tienen repositorio git propio; Teacher OS **no tiene repositorio** — su trabajo vive en Drive (`G:\Mi unidad\TEACHER OS HUGO — CICLO 2026-2027`), y `Projects/TEACHER-OS` es solo una carpeta técnica vacía (ver `ESTADO.md`, fila "Repositorio git"). El Command Center **coordina** los tres frentes — registra su estado, sus decisiones y sus riesgos — pero **no contiene copias de su código**.

## Contenido

- `ESTADO.md` — estado verificado del portafolio, frente por frente.
- `DECISIONES.md` — registro de decisiones (`propuesta` → `aprobada` → `aplicada` → `verificada`).
- `RIESGOS.md` — panel de riesgos activos y aprendizajes operativos.
- `DESPLIEGUE.md` — runbook de despliegue (Supabase/Vercel) por frente.

## Regla de oro

Antes de cualquier operación git, confirma la raíz real del repositorio sobre el que vas a trabajar:

```bash
git rev-parse --show-toplevel
```

No asumas que una carpeta padre (como `Projects`) es un repositorio. Ver `AGENTS.md` para las reglas completas.
