# Arquitectura

## Objetivo

Primera versión operativa (no productiva) del Command Center: una app web local
que muestra el estado real de los tres frentes del portafolio, conserva
decisiones e historial en disco, lee GitHub en vivo cuando hay sesión
disponible, y permite preparar/ejecutar solo un conjunto cerrado de acciones
seguras — nunca fingiendo que algo se ejecutó sin evidencia.

## Estructura

```text
dashboard/
  src/
    server/     backend Express + TypeScript (única fuente de lógica)
    public/     frontend vanilla (HTML/CSS/JS), sin build step, consume la API
  data/
    command-center-state.json   estado persistido (gitignored)
    backups/                    respaldos automáticos del estado (gitignored)
    actions/                    paquetes de ejecución en Markdown (versionados)
  docs/         esta documentación
  test/         pruebas vitest
```

## Separación de responsabilidades (backend)

| Módulo | Responsabilidad |
|---|---|
| `types.ts` | Modelo de datos compartido (Decision, ActionRecord, AuditEntry, etc.) |
| `ids.ts` | IDs únicos (`crypto.randomUUID`) y timestamps ISO |
| `state.ts` | Persistencia: carga, mutación serializada, escritura atómica, respaldo, siembra inicial |
| `seed.ts` | Estado inicial derivado de `ESTADO.md` / `DECISIONES.md` / `RIESGOS.md` del Command Center |
| `github.ts` | Única puerta de entrada a GitHub — lista cerrada de repos y comandos `gh`, sin shell string interpolation |
| `decisions.ts` | Motor de decisiones: máquina de estados, transiciones válidas, historial |
| `qa.ts` | Respuestas a las preguntas rápidas, derivadas de los campos ya registrados de cada decisión |
| `actions.ts` | Cola de acciones: generación de paquetes Markdown, marcado de envío, evidencia, cierre verificado |
| `audit.ts` | Registro de auditoría append-only |
| `routes.ts` | Capa HTTP — traduce peticiones REST a llamadas de los módulos anteriores, sin lógica de negocio propia |
| `index.ts` | Arranque del servidor Express, monta `/api` y sirve `src/public` como estático |

El frontend (`src/public/app.js`) **no contiene lógica de GitHub ni de la
máquina de estados** — solo hace `fetch` a `/api/*` y renderiza lo que recibe.
Toda decisión sobre qué transición es válida, qué evidencia cuenta como
verificada, o qué repos están permitidos, vive en el backend.

## Flujo de una acción (ver también `docs/DATA-MODEL.md`)

```
propuesta → (Hugo: pregunta / modifica / propone / pospone) → aceptada / modificada
   → generar paquete (crea archivo real en data/actions/) → lista_para_ejecucion
   → marcar enviada (a un agente humano/Claude Code) → enviada
   → verificar evidencia contra GitHub (repetible) → evidencia acumulada
   → completar (solo si hay ≥1 evidencia verificada) → completada
```

Ningún paso "completa" una acción sin evidencia verificada contra una fuente
real. Ver `SECURITY.md` para el detalle de qué queda fuera de esta versión.

## Por qué un archivo JSON y no una base de datos

Alcance de la primera versión: un solo operador (Hugo), uso local, sin
necesidad de consultas complejas. Un archivo JSON con escritura atómica y
respaldo cubre los requisitos de persistencia sin añadir una dependencia de
infraestructura. Ver `ROADMAP.md` para cuándo tendría sentido migrar.
