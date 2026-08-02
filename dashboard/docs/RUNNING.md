# Cómo ejecutar localmente

## Requisitos

- Node.js ≥ 20 (probado con 24.18.0).
- `gh` CLI instalado y autenticado (`gh auth status`) para la lectura/escritura
  en GitHub. Sin esto, la app arranca igual pero muestra "conexión no
  disponible" en vez de datos de GitHub — no falla ni inventa nada.

## Instalación

```bash
cd dashboard
npm install
```

## Desarrollo (recarga automática del backend)

```bash
npm run dev
```

Sirve en `http://localhost:4173` (configurable con la variable de entorno
`PORT`). El frontend (`src/public/`) no tiene build step — se sirve tal cual
como estático, así que basta recargar el navegador tras editarlo.

## Producción local (build + start)

```bash
npm run build     # compila src/server a dist/
npm run start     # node dist/index.js
```

## Pruebas y verificación

```bash
npm run typecheck   # tsc --noEmit sobre src/server + test
npm test             # vitest run
npm run build        # tsc -p tsconfig.build.json
npm audit --omit=dev # dependencias de produccion
```

## Primer arranque

Al no existir `data/command-center-state.json`, la app lo crea con un estado
inicial sembrado (`src/server/seed.ts`) que refleja las decisiones reales
documentadas en `ESTADO.md`/`DECISIONES.md`/`RIESGOS.md` del Command Center a
fecha 2026-08-02. Ese archivo queda fuera de git (ver `.gitignore`) — es tuyo,
local, y se respalda automáticamente en `data/backups/` en cada escritura.

## Dónde miran los datos

- **GitHub** (Nuevo Horizonte, SASE Zero, Command Center PRs): en vivo, vía
  `gh` CLI, cada vez que se carga la página o se pulsa "Verificar en GitHub".
- **Teacher OS**: manual, hardcodeado en `src/server/fronts.ts`, con fecha de
  última actualización visible en la tarjeta.
- **SASE Zero (Supabase)**: documental, mismo mecanismo que Teacher OS.
