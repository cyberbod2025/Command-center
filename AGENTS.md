# Reglas permanentes — Command Center

Este archivo aplica a cualquier agente (Claude Code, OpenCode u otro) que trabaje dentro de `C:\HUGO_SYSTEM\Projects`.

## Separación entre carpeta contenedora y repositorios

- `C:\HUGO_SYSTEM\Projects` es únicamente un espacio de trabajo contenedor. **No es un repositorio git y nunca debe convertirse en uno.**
- Cada frente de código y cada herramienta de soporte (incluido este Command Center) tiene su propio `.git` independiente. **Excepción: Teacher OS no tiene repositorio git** — su trabajo vive en Drive (`G:\Mi unidad\TEACHER OS HUGO — CICLO 2026-2027`); `Projects/TEACHER-OS` es solo una carpeta técnica vacía. No buscar ni inicializar un `.git` ahí sin confirmación explícita (ver `ESTADO.md`).
- **Nunca ejecutar `git add`, `git commit`, `git push`, `git pull`, creación de ramas o merges desde `C:\HUGO_SYSTEM\Projects`.** Toda operación git se ejecuta dentro del repositorio concreto sobre el que se quiere actuar.
- **Confirmar siempre la raíz con `git rev-parse --show-toplevel`** antes de cualquier operación git. No asumir que una carpeta padre es un repositorio.
- No asumir que una carpeta padre es un repositorio solo porque contiene subcarpetas con código.

## Disciplina de edición

- **Releer el archivo inmediatamente antes de editarlo.** El estado en disco puede haber cambiado desde la última lectura.
- **Aplicar cambios acotados** — modificar solo la sección relevante, no reescribir documentos completos si basta con una edición puntual.
- **Revisar el diff después de cada cambio.**
- **No sobrescribir cambios concurrentes de otras sesiones.** Si un documento tiene ediciones que no corresponden a la tarea actual, conservarlas.

## Datos sensibles

- **No almacenar claves, tokens, archivos `.env`, expedientes ni datos sensibles** en este repositorio ni en ningún documento del Command Center. Si una clave real es necesaria como evidencia, registrar el método para obtenerla (endpoint/función de API), nunca el valor literal.

## Alcance del Command Center

- El Command Center registra estados, decisiones, riesgos y evidencias del portafolio. **No reemplaza los repositorios de cada proyecto** ni contiene copias de su código.
